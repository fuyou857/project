import { getApprovalBySource } from '../services/approvalService';

/** 已有审批流时，避免表单里的 approval_status 覆盖审批中心回写结果 */
export async function omitVariationApprovalStatusIfHasWorkflow(
  sourceType: 'income_variation' | 'expense_variation',
  recordId: string | undefined,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!recordId) return payload;
  const approval = await getApprovalBySource(sourceType, recordId);
  if (!approval) return payload;
  const { approval_status: _omit, ...rest } = payload;
  return rest;
}
