import { supabase } from '../supabase/client';
import { APPROVAL_SOURCE_TYPE_LABELS } from '../constants/approvalRoles';
import {
  BATCH_APPROVABLE_SOURCE_TYPES,
  BATCH_APPROVE_MAX,
} from '../constants/approvalPhase3';
import { canSendReminder } from './approvalReminderRules';
import {
  approve,
  getApprovalById,
  getApprovalHistory,
  getApprovalSteps,
  getPendingApprovals,
  getSourceTypeLabel,
  type Approval,
} from './approvalService';
import {
  resolveApproverUserIds,
  type ApprovalFlowStep,
} from './approvalWorkflow';

export interface OpinionTemplate {
  id: string;
  user_id: string;
  title: string;
  content: string;
  sort_order: number;
}

export interface ApprovalDelegation {
  id: string;
  delegator_id: string;
  delegate_id: string;
  source_type: string | null;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

export interface ApprovalDashboardStats {
  pendingCount: number;
  todayApproved: number;
  weekApproved: number;
  monthApproved: number;
  avgPendingHours: number;
  bySourceType: { source_type: string; label: string; count: number }[];
}

async function logApprovalOp(
  approvalId: string | null,
  operatorId: string,
  operationType: string,
  detail: Record<string, unknown> = {},
) {
  const { error } = await supabase.from('approval_operation_logs').insert({
    approval_id: approvalId,
    operator_id: operatorId,
    operation_type: operationType,
    detail,
  });
  if (error) console.warn('[approval_operation_logs]', error.message);
}

async function notifyUsers(
  userIds: string[],
  title: string,
  body: string,
  category: string,
  dedupePrefix: string,
  payload: Record<string, unknown>,
) {
  const today = new Date().toISOString().slice(0, 10);
  for (const userId of userIds) {
    const dedupeKey = `${dedupePrefix}|${userId}|${today}|${payload.approval_id ?? ''}`;
    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      title,
      body,
      category,
      dedupe_key: dedupeKey,
      payload,
    });
    if (error && (error as { code?: string }).code !== '23505') {
      console.warn('[notifyUsers]', error.message);
    }
  }
}

/** 当前日期内生效的代理：delegator → delegate */
export async function loadActiveDelegationMap(
  sourceType?: string,
): Promise<Map<string, string[]>> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('approval_delegations')
    .select('delegator_id, delegate_id, source_type')
    .eq('is_active', true)
    .lte('start_date', today)
    .gte('end_date', today);
  if (error) throw error;

  const map = new Map<string, string[]>();
  for (const row of data || []) {
    if (row.source_type && sourceType && row.source_type !== sourceType) continue;
    const list = map.get(row.delegator_id) || [];
    list.push(row.delegate_id);
    map.set(row.delegator_id, list);
  }
  return map;
}

/** 用户是否可处理当前步骤（含代理） */
export async function userCanApproveStep(
  userId: string,
  step: ApprovalFlowStep,
  sourceType: string,
): Promise<boolean> {
  const primary = await resolveApproverUserIds(step);
  if (primary.includes(userId)) return true;
  const delegMap = await loadActiveDelegationMap(sourceType);
  for (const delegatorId of primary) {
    const delegates = delegMap.get(delegatorId) || [];
    if (delegates.includes(userId)) return true;
  }
  return false;
}

export async function sendApprovalReminder(approvalId: string, requesterId: string) {
  const approval = await getApprovalById(approvalId);
  if (!approval) throw new Error('审批记录不存在');
  if (approval.status !== 'pending') throw new Error('仅审批中的申请可催办');
  if (approval.created_by !== requesterId) throw new Error('仅发起人可催办');

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const { data: recent, error: qErr } = await supabase
    .from('approval_reminders')
    .select('approval_id, created_at')
    .eq('requester_id', requesterId)
    .gte('created_at', dayStart.toISOString());
  if (qErr) throw qErr;

  const check = canSendReminder(approvalId, requesterId, recent || []);
  if (!check.ok) throw new Error(check.message);

  const steps = await getApprovalSteps(approval.source_type);
  const current = steps.find((s) => s.step_order === approval.current_step);
  if (!current) throw new Error('当前审批步骤无效');

  const approverIds = await resolveApproverUserIds(current);
  if (approverIds.length === 0) throw new Error('当前步骤未配置审批人');

  const { error: insErr } = await supabase.from('approval_reminders').insert({
    approval_id: approvalId,
    requester_id: requesterId,
  });
  if (insErr) throw insErr;

  const { data: requester } = await supabase
    .from('users')
    .select('real_name, username')
    .eq('id', requesterId)
    .single();
  const requesterName = requester?.real_name || requester?.username || '发起人';
  const label = APPROVAL_SOURCE_TYPE_LABELS[approval.source_type] || approval.source_type;

  await notifyUsers(
    approverIds,
    '您有审批待办被催办',
    `${requesterName} 催办您处理【${label}】${approval.source_name}，请尽快处理`,
    'approval_remind',
    'approval-remind',
    { approval_id: approvalId, step_order: approval.current_step },
  );

  await logApprovalOp(approvalId, requesterId, 'remind', { step_order: approval.current_step });
}

export async function batchApprove(
  approvalIds: string[],
  approverId: string,
  approverName: string,
  comment?: string,
) {
  if (approvalIds.length === 0) throw new Error('请选择待审批项');
  if (approvalIds.length > BATCH_APPROVE_MAX) {
    throw new Error(`单次最多批量通过 ${BATCH_APPROVE_MAX} 条`);
  }

  const approvals: Approval[] = [];
  for (const id of approvalIds) {
    const a = await getApprovalById(id);
    if (!a) throw new Error(`审批 ${id} 不存在`);
    if (a.status !== 'pending') throw new Error(`「${a.source_name}」已非审批中状态`);
    if (!BATCH_APPROVABLE_SOURCE_TYPES.includes(a.source_type as (typeof BATCH_APPROVABLE_SOURCE_TYPES)[number])) {
      throw new Error(`「${getSourceTypeLabel(a.source_type)}」不支持批量审批`);
    }
    approvals.push(a);
  }

  const firstType = approvals[0].source_type;
  if (!approvals.every((a) => a.source_type === firstType)) {
    throw new Error('批量审批仅支持同一业务类型');
  }

  for (const a of approvals) {
    const steps = await getApprovalSteps(a.source_type);
    const current = steps.find((s) => s.step_order === a.current_step);
    if (!current || !(await userCanApproveStep(approverId, current, a.source_type))) {
      throw new Error(`您无权批量处理「${a.source_name}」`);
    }
  }

  for (const a of approvals) {
    await approve(a.id, approverId, approverName, comment?.trim() || '批量审批通过');
  }

  await logApprovalOp(null, approverId, 'batch_approve', {
    approval_ids: approvalIds,
    source_type: firstType,
    count: approvalIds.length,
  });
}

export async function listOpinionTemplates(userId: string): Promise<OpinionTemplate[]> {
  const { data, error } = await supabase
    .from('approval_opinion_templates')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as OpinionTemplate[];
}

export async function saveOpinionTemplate(
  userId: string,
  input: { id?: string; title: string; content: string; sort_order?: number },
) {
  const row = {
    user_id: userId,
    title: input.title.trim(),
    content: input.content.trim(),
    sort_order: input.sort_order ?? 0,
  };
  if (!row.title || !row.content) throw new Error('请填写模板标题与内容');

  if (input.id) {
    const { error } = await supabase
      .from('approval_opinion_templates')
      .update(row)
      .eq('id', input.id)
      .eq('user_id', userId);
    if (error) throw error;
    return input.id;
  }

  const { data, error } = await supabase
    .from('approval_opinion_templates')
    .insert(row)
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function deleteOpinionTemplate(userId: string, templateId: string) {
  const { error } = await supabase
    .from('approval_opinion_templates')
    .delete()
    .eq('id', templateId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function listDelegations(delegatorId: string): Promise<ApprovalDelegation[]> {
  const { data, error } = await supabase
    .from('approval_delegations')
    .select('*')
    .eq('delegator_id', delegatorId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as ApprovalDelegation[];
}

export async function saveDelegation(
  delegatorId: string,
  input: {
    id?: string;
    delegate_id: string;
    source_type?: string | null;
    start_date: string;
    end_date: string;
    is_active?: boolean;
  },
) {
  if (delegatorId === input.delegate_id) throw new Error('不能指定自己为代理人');
  if (input.start_date > input.end_date) throw new Error('结束日期不能早于开始日期');

  const row = {
    delegator_id: delegatorId,
    delegate_id: input.delegate_id,
    source_type: input.source_type || null,
    start_date: input.start_date,
    end_date: input.end_date,
    is_active: input.is_active ?? true,
  };

  if (input.id) {
    const { error } = await supabase
      .from('approval_delegations')
      .update(row)
      .eq('id', input.id)
      .eq('delegator_id', delegatorId);
    if (error) throw error;
    await logApprovalOp(null, delegatorId, 'delegation_update', { delegation_id: input.id });
    return input.id;
  }

  const { data, error } = await supabase
    .from('approval_delegations')
    .insert(row)
    .select('id')
    .single();
  if (error) throw error;
  await logApprovalOp(null, delegatorId, 'delegation_create', { delegation_id: data.id });
  return data.id as string;
}

export async function notifyMentionedUsers(
  approval: Approval,
  mentionUserIds: string[],
  authorName: string,
  excerpt: string,
) {
  if (mentionUserIds.length === 0) return;
  const label = APPROVAL_SOURCE_TYPE_LABELS[approval.source_type] || approval.source_type;
  const summary = excerpt.length > 80 ? `${excerpt.slice(0, 80)}…` : excerpt;
  await notifyUsers(
    mentionUserIds,
    '有人在审批中提到了你',
    `${authorName} 在【${label}】${approval.source_name} 审批中提到了你：${summary}`,
    'approval_mention',
    'approval-mention',
    { approval_id: approval.id },
  );
}

export async function addApprovalDiscussionComment(
  approvalId: string,
  authorId: string,
  authorName: string,
  content: string,
  mentionedUserIds: string[] = [],
) {
  const trimmed = content.trim();
  if (!trimmed) throw new Error('请填写评论内容');

  const approval = await getApprovalById(approvalId);
  if (!approval) throw new Error('审批记录不存在');

  const steps = await getApprovalSteps(approval.source_type);
  const current = steps.find((s) => s.step_order === approval.current_step);

  const { error } = await supabase.from('approval_comments').insert({
    approval_id: approvalId,
    step_order: approval.current_step,
    step_name: current?.step_name || '',
    author_id: authorId,
    author_name: authorName,
    action: 'comment',
    content: trimmed,
    mentioned_user_ids: mentionedUserIds,
  });
  if (error) throw error;

  const uniqueMentions = [...new Set(mentionedUserIds.filter((id) => id && id !== authorId))];
  await notifyMentionedUsers(approval, uniqueMentions, authorName, trimmed);
  await logApprovalOp(approvalId, authorId, 'comment', { mention_count: uniqueMentions.length });
}

export async function getApprovalDiscussionComments(approvalId: string) {
  const { data, error } = await supabase
    .from('approval_comments')
    .select('*')
    .eq('approval_id', approvalId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getApprovalDashboardStats(userId: string): Promise<ApprovalDashboardStats> {
  const pending = await getPendingApprovals(userId);
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const { data: myRecords } = await supabase
    .from('approval_records')
    .select('created_at, action')
    .eq('approver_id', userId)
    .eq('action', 'approve')
    .order('created_at', { ascending: false })
    .limit(500);

  const records = myRecords || [];
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = now - 7 * dayMs;
  const monthStart = now - 30 * dayMs;

  let todayApproved = 0;
  let weekApproved = 0;
  let monthApproved = 0;
  for (const r of records) {
    const t = new Date(r.created_at).getTime();
    if (t >= todayStart.getTime()) todayApproved += 1;
    if (t >= weekStart) weekApproved += 1;
    if (t >= monthStart) monthApproved += 1;
  }

  let pendingHoursSum = 0;
  for (const p of pending) {
    pendingHoursSum += (now - new Date(p.created_at).getTime()) / (60 * 60 * 1000);
  }
  const avgPendingHours =
    pending.length > 0 ? Math.round((pendingHoursSum / pending.length) * 10) / 10 : 0;

  const typeCount = new Map<string, number>();
  for (const p of pending) {
    typeCount.set(p.source_type, (typeCount.get(p.source_type) || 0) + 1);
  }
  const bySourceType = [...typeCount.entries()]
    .map(([source_type, count]) => ({
      source_type,
      label: getSourceTypeLabel(source_type),
      count,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    pendingCount: pending.length,
    todayApproved,
    weekApproved,
    monthApproved,
    avgPendingHours,
    bySourceType,
  };
}

export async function buildApprovalExportRows(
  userId: string,
  tab: 'pending' | 'initiated',
): Promise<Record<string, unknown>[]> {
  const list =
    tab === 'pending'
      ? await getPendingApprovals(userId)
      : await (async () => {
          const { getMyInitiatedApprovals } = await import('./approvalService');
          return getMyInitiatedApprovals(userId);
        })();

  const rows: Record<string, unknown>[] = [];
  for (const a of list) {
    const history = await getApprovalHistory(a.id);
    const historyText = (history || [])
      .map(
        (h) =>
          `${h.step_name}:${h.approver_name}:${h.action}${h.comment ? `(${h.comment})` : ''}`,
      )
      .join(' | ');
    rows.push({
      业务类型: getSourceTypeLabel(a.source_type),
      标题: a.source_name,
      状态: a.status,
      当前步骤: a.current_step,
      创建时间: a.created_at,
      审批历史: historyText,
    });
  }
  return rows;
}
