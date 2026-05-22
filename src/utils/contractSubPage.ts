import { createApproval } from '../services/approvalService';
import { getStoredUser } from './sessionUser';

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
): Promise<boolean> {
  const user = getStoredUser();
  if (!user.id) return false;
  try {
    const row = await createApproval(sourceType, sourceId, sourceName, user.id);
    if (!row) {
      console.warn(`审批未创建：未配置 ${sourceType} 审批步骤`);
      return false;
    }
    return true;
  } catch (approvalError) {
    console.error('审批创建失败:', approvalError);
    return false;
  }
}

export function createSuccessMessage(approvalSubmitted: boolean): string {
  return approvalSubmitted ? '创建成功，已提交审批' : '创建成功（未配置审批流程，未提交审批）';
}
