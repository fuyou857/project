import { createApproval } from '../services/approvalService';
import {
  isSubmitApprovalModalAvailable,
  openSubmitApprovalWithRetry,
} from './submitApprovalBridge';
import { resolveProjectIdForApprovalSource } from '../services/approvalApproverService';
import { getStoredUser } from './sessionUser';

export type { SubmitApprovalOpenConfig } from '../services/approvalApproverService';

export {
  alertMissingRequiredFields,
  contractAmountById,
  contractNameById,
  expenseContractAmountValue,
  filterRowsBySearch,
  generateDatedRandomCode,
  generateDatedSequentialCode,
} from './contractSubPageHelpers';

/**
 * 新建记录后尝试创建审批。
 * @returns true 已提交审批；false 未配置流程或失败（主记录仍已保存）
 */
export async function tryCreateApproval(
  sourceType: string,
  sourceId: string,
  sourceName: string,
  options?: {
    projectId?: string | null;
    summaryRows?: { label: string; value: string }[];
  },
): Promise<boolean> {
  const user = getStoredUser();
  if (!user.id) return false;

  const projectId =
    options?.projectId !== undefined
      ? options.projectId
      : await resolveProjectIdForApprovalSource(sourceType, sourceId);

  const modalResult = await openSubmitApprovalWithRetry({
    sourceType,
    sourceId,
    sourceName,
    projectId,
    summaryRows: options?.summaryRows,
  });
  if (modalResult !== null) return modalResult;

  try {
    const row = await createApproval(sourceType, sourceId, sourceName, user.id, user.name);
    if (!row) {
      console.warn(`审批未创建：未配置 ${sourceType} 审批步骤`);
      return false;
    }
    return true;
  } catch (approvalError) {
    console.error('审批创建失败:', approvalError);
    return 'error';
  }
}

export function createSuccessMessage(approvalSubmitted: boolean): string {
  if (approvalSubmitted) return '创建成功，已提交审批';
  if (isSubmitApprovalModalAvailable()) return '创建成功（未提交审批或已取消）';
  return '创建成功（未配置审批流程，未提交审批）';
}
