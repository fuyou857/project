import { supabase } from '../supabase/client';
import { APPROVER_ROLE_TO_ROLE_CODES, roleCodesToApproverRoles } from '../constants/approvalRoles';
import {
  shouldSkipApprovalStep,
  planStepsAfter,
  type ApprovalFlowStep,
  type AutoApprovalRecord,
} from './approvalWorkflowLogic';

export { shouldSkipApprovalStep, planStepsAfter, type ApprovalFlowStep, type AutoApprovalRecord };

let roleCodeCache: Map<string, string> | null = null;

async function loadRoleCodeById(): Promise<Map<string, string>> {
  if (roleCodeCache) return roleCodeCache;
  const { data } = await supabase.from('roles').select('id, code');
  roleCodeCache = new Map((data || []).map((r) => [r.id, r.code]));
  return roleCodeCache;
}

export async function getRoleCodesForUser(userId: string): Promise<string[]> {
  const { data: user } = await supabase.from('users').select('role_ids').eq('id', userId).single();
  const ids: string[] = user?.role_ids || [];
  if (ids.length === 0) return [];
  const map = await loadRoleCodeById();
  return ids.map((id) => map.get(id)).filter((c): c is string => Boolean(c));
}

export async function resolveApproverUserIds(
  step: ApprovalFlowStep,
  approvalId?: string,
): Promise<string[]> {
  if (approvalId) {
    const { data: inst } = await supabase
      .from('approval_instance_approvers')
      .select('approver_id')
      .eq('approval_id', approvalId)
      .eq('step_order', step.step_order)
      .maybeSingle();
    if (inst?.approver_id) return [inst.approver_id];
  }

  if (step.approver_id) {
    return [step.approver_id];
  }

  const codes = APPROVER_ROLE_TO_ROLE_CODES[step.approver_role] || [step.approver_role];
  const { data: roles } = await supabase.from('roles').select('id').in('code', codes);
  const roleIds = (roles || []).map((r) => r.id);
  if (roleIds.length === 0) {
    const { data: legacy } = await supabase.from('users').select('id').eq('role', step.approver_role);
    return (legacy || []).map((u) => u.id);
  }

  const { data: users } = await supabase.from('users').select('id, role_ids');
  return (users || [])
    .filter((u) => (u.role_ids || []).some((rid: string) => roleIds.includes(rid)))
    .map((u) => u.id);
}

export async function getUserApproverRoles(userId: string): Promise<string[]> {
  const codes = await getRoleCodesForUser(userId);
  return roleCodesToApproverRoles(codes);
}

export function clearApprovalRoleCache() {
  roleCodeCache = null;
}
