import { supabase } from '../supabase/client';
import { APPROVAL_SOURCE_TYPE_LABELS } from '../constants/approvalRoles';
import {
  resolveApproverUserIds,
  getUserApproverRoles,
  shouldSkipApprovalStep,
  type ApprovalFlowStep,
} from './approvalWorkflow';
import { userCanApproveStep } from './approvalPhase3Service';
import { resolveApprovalSteps } from './approvalStepResolve';
import {
  isCountersignStep,
  recordStepApproveVote,
  countersignStepComplete,
  userAlreadyVotedCurrentStep,
} from './approvalCountersign';


export interface Approval {
  id: string;
  source_type: string;
  source_id: string;
  source_name: string;
  current_step: number;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  created_by: string | null;
  created_at: string;
  updated_at?: string;
}

export interface ApprovalStep {
  id: string;
  source_type: string;
  step_order: number;
  step_name: string;
  approver_role: string;
  approver_id: string | null;
}

export interface ApprovalRecord {
  id: string;
  approval_id: string;
  step_order: number;
  step_name: string;
  approver_id: string;
  approver_name: string;
  action: string;
  comment: string;
  created_at: string;
}

async function loadSteps(sourceType: string, sourceId: string): Promise<ApprovalFlowStep[]> {
  return resolveApprovalSteps(sourceType, sourceId);
}

async function insertAutoSkipRecords(
  approvalId: string,
  initiatorId: string,
  initiatorName: string,
  records: { step_order: number; step_name: string }[],
) {
  if (records.length === 0) return;
  await supabase.from('approval_records').insert(
    records.map((r) => ({
      approval_id: approvalId,
      step_order: r.step_order,
      step_name: r.step_name,
      approver_id: initiatorId,
      approver_name: initiatorName,
      action: 'skip',
      comment: '与发起人为同一人，系统自动跳过',
    })),
  );
}

async function advanceAfterStep(
  approval: Approval,
  steps: ApprovalFlowStep[],
  completedStepOrder: number,
  actorId: string,
  actorName: string,
): Promise<Approval> {
  const initiatorId = approval.created_by || actorId;
  const resolvedAuto: { step_order: number; step_name: string }[] = [];
  let next: number | null = null;
  const sorted = [...steps].sort((a, b) => a.step_order - b.step_order);
  for (const step of sorted) {
    if (step.step_order <= completedStepOrder) continue;
    const ids = await resolveApproverUserIds(step);
    if (shouldSkipApprovalStep(step, initiatorId, ids)) {
      resolvedAuto.push({ step_order: step.step_order, step_name: step.step_name });
      continue;
    }
    next = step.step_order;
    break;
  }

  await insertAutoSkipRecords(approval.id, initiatorId, actorName, resolvedAuto);

  const now = new Date().toISOString();
  if (next == null) {
    await supabase
      .from('approvals')
      .update({
        status: 'approved',
        current_step: completedStepOrder + 1,
        updated_at: now,
      })
      .eq('id', approval.id);
    await updateSourceStatus(approval.source_type, approval.source_id, 'approved');
    const done = (await getApprovalById(approval.id))!;
    await notifyCreator(done, 'approved', actorName);
    const { notifyCcOnApproved } = await import('./approvalPhase4Service');
    await notifyCcOnApproved(done);
    return done;
  }

  await supabase
    .from('approvals')
    .update({ current_step: next, updated_at: now })
    .eq('id', approval.id);
  const updated = (await getApprovalById(approval.id))!;
  const step = steps.find((s) => s.step_order === next);
  if (step) await notifyApprover(updated, step);
  return updated;
}

export async function getLatestApprovalBySource(sourceType: string, sourceId: string) {
  const { data, error } = await supabase
    .from('approvals')
    .select('*')
    .eq('source_type', sourceType)
    .eq('source_id', sourceId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/** 驳回/撤回后重新提交，从驳回步骤继续 */
export async function resubmitApproval(
  approvalId: string,
  createdBy: string,
  createdByName: string,
) {
  const approval = await getApprovalById(approvalId);
  if (!approval) throw new Error('审批记录不存在');
  if (approval.created_by !== createdBy) throw new Error('仅发起人可重新提交');
  if (approval.status !== 'rejected' && approval.status !== 'withdrawn') {
    throw new Error('仅已驳回或已撤回的申请可重新提交');
  }

  const history = await getApprovalHistory(approvalId);
  let restartStep = 2;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i].action === 'reject') {
      restartStep = history[i].step_order;
      break;
    }
  }

  const steps = await loadSteps(approval.source_type, approval.source_id);
  const firstBiz = steps.find((s) => s.approver_role !== 'initiator');
  if (restartStep <= 1 && firstBiz) restartStep = firstBiz.step_order;

  await supabase.from('approval_records').insert({
    approval_id: approvalId,
    step_order: 1,
    step_name: '重新提交',
    approver_id: createdBy,
    approver_name: createdByName,
    action: 'resubmit',
    comment: '发起人修改后重新提交',
  });

  const now = new Date().toISOString();
  await supabase
    .from('approvals')
    .update({ status: 'pending', current_step: restartStep, updated_at: now })
    .eq('id', approvalId);

  const updated = (await getApprovalById(approvalId))! as Approval;
  const step = steps.find((s) => s.step_order === restartStep);
  if (step) await notifyApprover(updated, step);
  return updated;
}

export async function createApproval(
  sourceType: string,
  sourceId: string,
  sourceName: string,
  createdBy: string,
  createdByName?: string,
) {
  const name =
    createdByName ||
    (await supabase.from('users').select('real_name, username').eq('id', createdBy).single()).data
      ?.real_name ||
    '发起人';

  const existing = await getLatestApprovalBySource(sourceType, sourceId);
  if (existing?.status === 'pending') {
    return getApprovalById(existing.id);
  }
  if (existing?.status === 'rejected' || existing?.status === 'withdrawn') {
    await supabase
      .from('approvals')
      .update({ source_name: sourceName })
      .eq('id', existing.id);
    return resubmitApproval(existing.id, createdBy, name);
  }

  const steps = await loadSteps(sourceType, sourceId);
  if (steps.length === 0) return null;

  const { data, error } = await supabase
    .from('approvals')
    .insert({
      source_type: sourceType,
      source_id: sourceId,
      source_name: sourceName,
      current_step: 1,
      status: 'pending',
      created_by: createdBy,
    })
    .select()
    .single();

  if (error) throw error;

  await advanceAfterStep(data, steps, 0, createdBy, name);
  return getApprovalById(data.id);
}

export async function getApprovalBySource(sourceType: string, sourceId: string) {
  return getLatestApprovalBySource(sourceType, sourceId);
}

export async function getApprovalById(id: string) {
  const { data, error } = await supabase.from('approvals').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function countPendingApprovals(userId: string) {
  const list = await getPendingApprovals(userId);
  return list.length;
}

export async function getMyInitiatedApprovals(userId: string, status?: string) {
  let query = supabase
    .from('approvals')
    .select('*')
    .eq('created_by', userId)
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function canWithdrawApproval(approvalId: string, userId: string) {
  const approval = await getApprovalById(approvalId);
  if (!approval || approval.status !== 'pending') return false;
  if (approval.created_by !== userId) return false;
  const { data: records } = await supabase
    .from('approval_records')
    .select('action')
    .eq('approval_id', approvalId);
  return !(records || []).some((r) => r.action === 'approve');
}

export async function withdrawApproval(approvalId: string, userId: string, userName: string) {
  if (!(await canWithdrawApproval(approvalId, userId))) {
    throw new Error('当前审批已被处理，无法撤回');
  }
  const approval = await getApprovalById(approvalId);
  if (!approval) throw new Error('审批记录不存在');

  await supabase.from('approval_records').insert({
    approval_id: approvalId,
    step_order: approval.current_step,
    step_name: '撤回申请',
    approver_id: userId,
    approver_name: userName,
    action: 'reject',
    comment: '发起人撤回',
  });

  await supabase.from('approvals').update({ status: 'withdrawn' }).eq('id', approvalId);
  return getApprovalById(approvalId);
}

export async function getPendingApprovals(userId?: string) {
  const { data, error } = await supabase
    .from('approvals')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!userId) return data || [];

  const approverRoles = await getUserApproverRoles(userId);
  if (approverRoles.length === 0) return [];

  const result: Approval[] = [];
  for (const approval of data || []) {
    const steps = await loadSteps(approval.source_type, approval.source_id);
    const current = steps.find((s) => s.step_order === approval.current_step);
    if (!current) continue;
    if (!approverRoles.includes(current.approver_role)) continue;
    if (!(await userCanApproveStep(userId, current, approval.source_type))) continue;
    if (
      isCountersignStep(current) &&
      (await userAlreadyVotedCurrentStep(approval.id, approval.current_step, userId))
    ) {
      continue;
    }
    result.push(approval);
  }
  return result;
}

export async function approve(
  approvalId: string,
  approverId: string,
  approverName: string,
  comment?: string,
) {
  const approval = await getApprovalById(approvalId);
  if (!approval) throw new Error('审批记录不存在');

  const steps = await loadSteps(approval.source_type, approval.source_id);
  const currentStep = steps.find((s) => s.step_order === approval.current_step);
  if (!currentStep) throw new Error('当前审批步骤无效');

  if (!(await userCanApproveStep(approverId, currentStep, approval.source_type))) {
    throw new Error('您无权处理当前审批步骤');
  }

  if (
    isCountersignStep(currentStep) &&
    (await userAlreadyVotedCurrentStep(approvalId, approval.current_step, approverId))
  ) {
    throw new Error('您已完成本会签，请等待其他审批人');
  }

  await supabase.from('approval_records').insert({
    approval_id: approvalId,
    step_order: approval.current_step,
    step_name: currentStep.step_name,
    approver_id: approverId,
    approver_name: approverName,
    action: 'approve',
    comment: comment || '',
  });

  if (isCountersignStep(currentStep)) {
    await recordStepApproveVote(approvalId, approval.current_step, approverId, comment);
    const progress = await countersignStepComplete(approvalId, currentStep);
    if (!progress.complete) {
      return getApprovalById(approvalId) as Promise<Approval>;
    }
  }

  return advanceAfterStep(approval, steps, approval.current_step, approverId, approverName);
}

export async function reject(
  approvalId: string,
  approverId: string,
  approverName: string,
  comment: string,
) {
  if (!comment?.trim()) {
    throw new Error('请填写驳回原因');
  }

  const approval = await getApprovalById(approvalId);
  if (!approval) throw new Error('审批记录不存在');

  const steps = await loadSteps(approval.source_type, approval.source_id);
  const currentStep = steps.find((s) => s.step_order === approval.current_step);

  if (currentStep && !(await userCanApproveStep(approverId, currentStep, approval.source_type))) {
    throw new Error('您无权处理当前审批步骤');
  }

  await supabase.from('approval_records').insert({
    approval_id: approvalId,
    step_order: approval.current_step,
    step_name: currentStep?.step_name || '',
    approver_id: approverId,
    approver_name: approverName,
    action: 'reject',
    comment,
  });

  await supabase
    .from('approvals')
    .update({ status: 'rejected', updated_at: new Date().toISOString() })
    .eq('id', approvalId);
  await updateSourceStatus(approval.source_type, approval.source_id, 'rejected');
  const rejected = (await getApprovalById(approvalId))!;
  await notifyCreator(rejected, 'rejected', approverName, comment);
  const { notifyCcOnRejected } = await import('./approvalPhase4Service');
  await notifyCcOnRejected(rejected, comment);
  return rejected;
}

type SourceStatusColumnUpdate = {
  table: string;
  column: 'status' | 'approval_status';
  approved: string;
  rejected: string;
};

const SOURCE_STATUS_COLUMN_UPDATES: Partial<Record<string, SourceStatusColumnUpdate>> = {
  income_contract: { table: 'income_contracts', column: 'status', approved: 'approved', rejected: 'draft' },
  expense_contract: { table: 'expense_contracts', column: 'status', approved: 'approved', rejected: 'draft' },
  income_variation: { table: 'income_variations', column: 'approval_status', approved: '已确认', rejected: '待审核' },
  expense_variation: { table: 'expense_variations', column: 'approval_status', approved: '已确认', rejected: '待审核' },
  income_output: { table: 'income_output_confirmations', column: 'status', approved: '已确认', rejected: '待确认' },
  income_settlement: { table: 'income_settlements', column: 'status', approved: '已结算', rejected: '未结算' },
  expense_settlement: { table: 'expense_settlements', column: 'status', approved: '已结算', rejected: '未结算' },
};

async function updateSourceStatus(sourceType: string, sourceId: string, status: string) {
  const config = SOURCE_STATUS_COLUMN_UPDATES[sourceType];
  if (!config) return;
  const targetStatus = status === 'approved' ? config.approved : config.rejected;
  await supabase.from(config.table).update({ [config.column]: targetStatus }).eq('id', sourceId);
}

async function notifyCreator(
  approval: Approval,
  kind: 'approved' | 'rejected',
  actorName: string,
  comment?: string,
) {
  if (!approval.created_by) return;
  const label = APPROVAL_SOURCE_TYPE_LABELS[approval.source_type] || approval.source_type;
  const today = new Date().toISOString().slice(0, 10);
  const title = kind === 'approved' ? '您的申请已通过' : '您的申请被驳回';
  const body =
    kind === 'approved'
      ? `【${label}】${approval.source_name} 已全部审批通过。`
      : `【${label}】${approval.source_name} 被 ${actorName} 驳回${comment ? `：${comment}` : ''}`;
  const dedupeKey = `approval-result|${approval.created_by}|${approval.id}|${kind}|${today}`;
  const { error } = await supabase.from('notifications').insert({
    user_id: approval.created_by,
    title,
    body,
    category: 'approval',
    dedupe_key: dedupeKey,
    payload: { approval_id: approval.id, result: kind },
  });
  if (error && (error as { code?: string }).code !== '23505') {
    console.warn('[notifyCreator]', error.message);
  } else {
    const { queueApprovalEmail } = await import('./approvalEmailNotify');
    await queueApprovalEmail(approval.created_by, title, body);
  }
}

async function notifyApprover(approval: Approval, step: ApprovalFlowStep) {
  const userIds = await resolveApproverUserIds(step);
  if (userIds.length === 0) return;

  const { data: users } = await supabase
    .from('users')
    .select('id, real_name, username')
    .in('id', userIds);

  const label = APPROVAL_SOURCE_TYPE_LABELS[approval.source_type] || approval.source_type;
  const today = new Date().toISOString().slice(0, 10);

  for (const user of users || []) {
    const dedupeKey = `approval|${user.id}|${approval.id}|${step.step_order}|${today}`;
    const { error } = await supabase.from('notifications').insert({
      user_id: user.id,
      title: '您有新的审批待办',
      body: `【${label}】${approval.source_name} 需要您处理：${step.step_name}`,
      category: 'approval',
      dedupe_key: dedupeKey,
      payload: { approval_id: approval.id, step_order: step.step_order },
    });
    if (error && (error as { code?: string }).code !== '23505') {
      console.warn('[notifyApprover]', error.message);
    } else {
      const { queueApprovalEmail } = await import('./approvalEmailNotify');
      await queueApprovalEmail(user.id, '您有新的审批待办', body);
    }
  }
}

export async function getApprovalHistory(approvalId: string) {
  const { data, error } = await supabase
    .from('approval_records')
    .select('*')
    .eq('approval_id', approvalId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function getApprovalSteps(sourceType: string, sourceId?: string) {
  if (sourceId) {
    return resolveApprovalSteps(sourceType, sourceId);
  }
  const { data, error } = await supabase
    .from('approval_steps')
    .select('*')
    .eq('source_type', sourceType)
    .order('step_order', { ascending: true });
  if (error) throw error;
  return data;
}

/** 会签进度（当前步骤） */
export async function getCountersignProgress(approvalId: string, stepOrder: number) {
  const approval = await getApprovalById(approvalId);
  if (!approval) return null;
  const steps = await loadSteps(approval.source_type, approval.source_id);
  const step = steps.find((s) => s.step_order === stepOrder);
  if (!step || !isCountersignStep(step)) return null;
  return countersignStepComplete(approvalId, step);
}

export function getSourceTypeLabel(sourceType: string) {
  return APPROVAL_SOURCE_TYPE_LABELS[sourceType] || sourceType;
}
