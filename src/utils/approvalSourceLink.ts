/** 审批业务类型 → 列表页路由（HashRouter） */
export const APPROVAL_SOURCE_LIST_PATH: Record<string, string> = {
  income_contract: '/contract/income/list',
  expense_contract: '/contract/expense/list',
  income_variation: '/contract/income/variation',
  expense_variation: '/contract/expense/variation',
  income_supplement: '/contract/income/supplement',
  expense_supplement: '/contract/expense/supplement',
  income_deduction: '/contract/income/deduction',
  expense_deduction: '/contract/expense/deduction',
  income_output: '/contract/income/output',
  income_settlement: '/contract/income/settlement',
  expense_settlement: '/contract/expense/settlement',
  expense_performance: '/contract/expense/performance',
  contract_template_generated: '/contract/templates/my-generated',
};

export function approvalSourceListPath(sourceType: string): string | null {
  return APPROVAL_SOURCE_LIST_PATH[sourceType] ?? null;
}
