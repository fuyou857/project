/** 审批步骤 approver_role → 系统 roles.code（可多码匹配） */
export const APPROVER_ROLE_TO_ROLE_CODES: Record<string, string[]> = {
  initiator: ['staff', 'regular_employee', 'construction_worker', 'initiator'],
  business: ['business', 'business_manager'],
  manager: ['manager', 'project_manager', 'project_owner', 'tech_lead'],
  accountant: ['accountant', 'finance', 'project_accountant', 'budget_manager'],
  admin: ['admin', 'company_admin', 'super_admin'],
  cashier: ['cashier', 'project_cashier'],
  /** 旧版迁移数据兼容 */
  finance: ['finance', 'accountant', 'project_accountant'],
};

/** 用户拥有的 roles.code → 可处理的 approver_role */
export function roleCodesToApproverRoles(roleCodes: string[]): string[] {
  const set = new Set<string>();
  for (const [approverRole, codes] of Object.entries(APPROVER_ROLE_TO_ROLE_CODES)) {
    if (codes.some((c) => roleCodes.includes(c))) {
      set.add(approverRole);
    }
  }
  return [...set];
}

export const APPROVAL_SOURCE_TYPE_LABELS: Record<string, string> = {
  income_contract: '收入主合同',
  expense_contract: '支出主合同',
  income_variation: '收入变更签证',
  expense_variation: '支出变更签证',
  income_supplement: '收入补充协议',
  expense_supplement: '支出补充协议',
  income_deduction: '收入扣款登记',
  expense_deduction: '支出扣款登记',
  income_output: '收入产值确认',
  income_settlement: '收入合同结算',
  expense_settlement: '支出合同结算',
  expense_performance: '支出合同履约',
  contract_template_generated: '生成合同用印',
  machine_shift: '机械台班',
};
