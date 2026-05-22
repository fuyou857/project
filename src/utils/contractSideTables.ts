/** 支出 / 收入合同子业务 Supabase 表名（与现有页面一致） */
export const CONTRACT_SIDE_TABLES = {
  expense: {
    contracts: 'expense_contracts',
    settlements: 'expense_settlements',
    variations: 'expense_variations',
    deductions: 'expense_deductions',
    supplements: 'expense_supplements',
    performances: 'expense_performances',
  },
  income: {
    contracts: 'income_contracts',
    settlements: 'income_settlements',
    variations: 'income_variations',
    deductions: 'income_deductions',
    supplements: 'income_supplements',
    outputConfirmations: 'income_output_confirmations',
  },
} as const;

export type ContractSide = keyof typeof CONTRACT_SIDE_TABLES;
