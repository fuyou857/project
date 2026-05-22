import { supabase } from '../supabase/client';
import { APPROVAL_SOURCE_TYPE_LABELS } from '../constants/approvalRoles';
import {
  buildSlaMap,
  slaStatus,
  waitHoursSince,
  type SlaConfigRow,
} from './approvalSla';
import type { Approval } from './approvalService';
import { getApprovalHistory, getSourceTypeLabel } from './approvalService';

export interface ApprovalCcUser {
  user_id: string;
  real_name?: string;
  username?: string;
}

export interface PendingSlaInfo {
  approvalId: string;
  waitHours: number;
  slaHours: number;
  status: 'ok' | 'warning' | 'overdue';
}

export interface StepDurationStat {
  step_name: string;
  avgHours: number;
  count: number;
}

let slaCache: Map<string, SlaConfigRow> | null = null;

export async function loadSlaConfigMap(): Promise<Map<string, SlaConfigRow>> {
  if (slaCache) return slaCache;
  const { data, error } = await supabase.from('approval_sla_config').select('*');
  if (error) {
    console.warn('[approval_sla_config]', error.message);
    slaCache = new Map();
    return slaCache;
  }
  slaCache = buildSlaMap((data || []) as SlaConfigRow[]);
  return slaCache;
}

export function clearSlaCache() {
  slaCache = null;
}

export async function getPendingSlaInfo(
  approval: Pick<Approval, 'id' | 'source_type' | 'current_step' | 'updated_at' | 'created_at'>,
  stepEnteredAt?: string,
): Promise<PendingSlaInfo | null> {
  const map = await loadSlaConfigMap();
  const cfg = map.get(`${approval.source_type}:${approval.current_step}`);
  if (!cfg) return null;
  const since = stepEnteredAt || approval.updated_at || approval.created_at;
  const waitHours = Math.round(waitHoursSince(since) * 10) / 10;
  return {
    approvalId: approval.id,
    waitHours,
    slaHours: cfg.sla_hours,
    status: slaStatus(waitHours, cfg.sla_hours, cfg.remind_before_hours),
  };
}

/** 当前步骤进入时间：上一条审批记录之后，无记录则用申请创建时间 */
export async function resolveStepEnteredAt(approval: Approval): Promise<string> {
  const history = await getApprovalHistory(approval.id);
  const prior = (history || []).filter(
    (r) => r.step_order < approval.current_step && r.action !== 'comment',
  );
  if (prior.length === 0) return approval.created_at;
  const last = prior[prior.length - 1];
  return last.created_at;
}

export async function listApprovalCc(approvalId: string): Promise<ApprovalCcUser[]> {
  const { data, error } = await supabase
    .from('approval_cc')
    .select('user_id')
    .eq('approval_id', approvalId);
  if (error) throw error;
  const ids = (data || []).map((r) => r.user_id);
  if (ids.length === 0) return [];
  const { data: users } = await supabase
    .from('users')
    .select('id, real_name, username')
    .in('id', ids);
  return (users || []).map((u) => ({
    user_id: u.id,
    real_name: u.real_name,
    username: u.username,
  }));
}

export async function setApprovalCc(approvalId: string, userIds: string[], operatorId: string) {
  const unique = [...new Set(userIds.filter(Boolean))];
  await supabase.from('approval_cc').delete().eq('approval_id', approvalId);
  if (unique.length > 0) {
    const { error } = await supabase.from('approval_cc').insert(
      unique.map((user_id) => ({
        approval_id: approvalId,
        user_id,
        cc_step: 0,
      })),
    );
    if (error) throw error;
  }
  await supabase.from('approval_operation_logs').insert({
    approval_id: approvalId,
    operator_id: operatorId,
    operation_type: 'set_cc',
    detail: { user_ids: unique },
  });
}

async function notifyCcUsers(
  approval: Approval,
  title: string,
  body: string,
  dedupeSuffix: string,
) {
  const { data: ccRows } = await supabase
    .from('approval_cc')
    .select('user_id')
    .eq('approval_id', approval.id);
  const userIds = (ccRows || []).map((r) => r.user_id).filter((id) => id !== approval.created_by);
  if (userIds.length === 0) return;
  const today = new Date().toISOString().slice(0, 10);
  for (const userId of userIds) {
    const dedupeKey = `approval-cc|${userId}|${approval.id}|${dedupeSuffix}|${today}`;
    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      title,
      body,
      category: 'approval_cc',
      dedupe_key: dedupeKey,
      payload: { approval_id: approval.id },
    });
    if (error && (error as { code?: string }).code !== '23505') {
      console.warn('[notifyCcUsers]', error.message);
    }
  }
}

export async function notifyCcOnApproved(approval: Approval) {
  const label = APPROVAL_SOURCE_TYPE_LABELS[approval.source_type] || approval.source_type;
  await notifyCcUsers(
    approval,
    '抄送：审批已通过',
    `【${label}】${approval.source_name} 已全部审批通过，供您知悉。`,
    'approved',
  );
}

export async function notifyCcOnRejected(approval: Approval, comment: string) {
  const label = APPROVAL_SOURCE_TYPE_LABELS[approval.source_type] || approval.source_type;
  await notifyCcUsers(
    approval,
    '抄送：审批已驳回',
    `【${label}】${approval.source_name} 已被驳回${comment ? `：${comment}` : ''}`,
    'rejected',
  );
}

export async function notifySlaOverdueToApprovers(
  approval: Approval,
  approverIds: string[],
  waitHours: number,
) {
  const label = APPROVAL_SOURCE_TYPE_LABELS[approval.source_type] || approval.source_type;
  const today = new Date().toISOString().slice(0, 10);
  for (const userId of approverIds) {
    const dedupeKey = `approval-sla|${userId}|${approval.id}|${approval.current_step}|${today}`;
    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      title: '审批待办即将超时',
      body: `【${label}】${approval.source_name} 已等待 ${Math.round(waitHours)} 小时，请尽快处理`,
      category: 'approval_sla',
      dedupe_key: dedupeKey,
      payload: { approval_id: approval.id, step_order: approval.current_step },
    });
    if (error && (error as { code?: string }).code !== '23505') {
      console.warn('[notifySlaOverdue]', error.message);
    }
  }
}

/** 为当前用户待办检查 SLA 并发送预警（每日去重） */
export async function runSlaChecksForPending(
  pending: Approval[],
  resolveApproverIds: (approval: Approval) => Promise<string[]>,
) {
  for (const a of pending) {
    const entered = await resolveStepEnteredAt(a);
    const info = await getPendingSlaInfo(a, entered);
    if (!info || info.status === 'ok') continue;
    const ids = await resolveApproverIds(a);
    if (ids.length === 0) continue;
    if (info.status === 'overdue' || info.status === 'warning') {
      await notifySlaOverdueToApprovers(a, ids, info.waitHours);
    }
  }
}

export async function getMyStepDurationStats(userId: string): Promise<StepDurationStat[]> {
  const { data: records } = await supabase
    .from('approval_records')
    .select('approval_id, step_name, created_at, action')
    .eq('approver_id', userId)
    .in('action', ['approve', 'reject'])
    .order('created_at', { ascending: true })
    .limit(800);

  if (!records?.length) return [];

  const byApproval = new Map<string, { step_name: string; created_at: string }[]>();
  for (const r of records) {
    const list = byApproval.get(r.approval_id) || [];
    list.push({ step_name: r.step_name, created_at: r.created_at });
    byApproval.set(r.approval_id, list);
  }

  const durations: { step_name: string; hours: number }[] = [];
  for (const list of byApproval.values()) {
    for (let i = 1; i < list.length; i += 1) {
      const hours =
        (new Date(list[i].created_at).getTime() - new Date(list[i - 1].created_at).getTime()) /
        (60 * 60 * 1000);
      if (hours > 0 && hours < 24 * 30) {
        durations.push({ step_name: list[i].step_name, hours });
      }
    }
  }

  const agg = new Map<string, { sum: number; count: number }>();
  for (const d of durations) {
    const cur = agg.get(d.step_name) || { sum: 0, count: 0 };
    cur.sum += d.hours;
    cur.count += 1;
    agg.set(d.step_name, cur);
  }

  return [...agg.entries()]
    .map(([step_name, { sum, count }]) => ({
      step_name,
      avgHours: Math.round((sum / count) * 10) / 10,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

export async function getOverduePendingCount(userId: string): Promise<number> {
  const { getPendingApprovals } = await import('./approvalService');
  const pending = await getPendingApprovals(userId);
  let n = 0;
  for (const a of pending) {
    const entered = await resolveStepEnteredAt(a);
    const info = await getPendingSlaInfo(a, entered);
    if (info?.status === 'overdue') n += 1;
  }
  return n;
}

export function slaStatusLabel(status: 'ok' | 'warning' | 'overdue'): string {
  if (status === 'overdue') return '已超时';
  if (status === 'warning') return '即将超时';
  return '';
}
