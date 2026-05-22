import { supabase } from '../supabase/client';
import { resolveApproverUserIds } from './approvalWorkflow';
import type { ResolvedApprovalStep } from './approvalStepResolve';

export async function getStepApproveVotes(
  approvalId: string,
  stepOrder: number,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('approval_step_votes')
    .select('approver_id')
    .eq('approval_id', approvalId)
    .eq('step_order', stepOrder)
    .eq('action', 'approve');
  if (error) throw error;
  return new Set((data || []).map((r) => r.approver_id));
}

export async function recordStepApproveVote(
  approvalId: string,
  stepOrder: number,
  approverId: string,
  comment?: string,
) {
  const { error } = await supabase.from('approval_step_votes').upsert(
    {
      approval_id: approvalId,
      step_order: stepOrder,
      approver_id: approverId,
      action: 'approve',
      comment: comment || '',
    },
    { onConflict: 'approval_id,step_order,approver_id' },
  );
  if (error) throw error;
}

export function isCountersignStep(step: ResolvedApprovalStep): boolean {
  return step.sign_type === 'countersign';
}

/** 会签：全部审批人都通过后才算本步完成 */
export async function countersignStepComplete(
  approvalId: string,
  step: ResolvedApprovalStep,
): Promise<{ complete: boolean; voted: number; required: number }> {
  const required = await resolveApproverUserIds(step);
  if (required.length <= 1) {
    return { complete: true, voted: 1, required: required.length };
  }
  const votes = await getStepApproveVotes(approvalId, step.step_order);
  const voted = required.filter((id) => votes.has(id)).length;
  return { complete: voted >= required.length, voted, required: required.length };
}

export async function userAlreadyVotedCurrentStep(
  approvalId: string,
  stepOrder: number,
  userId: string,
): Promise<boolean> {
  const votes = await getStepApproveVotes(approvalId, stepOrder);
  return votes.has(userId);
}
