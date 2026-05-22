/** 允许批量通过的业务类型（低风险、同类型） */
export const BATCH_APPROVABLE_SOURCE_TYPES = [
  'income_deduction',
  'expense_deduction',
  'income_output',
  'income_supplement',
  'expense_supplement',
] as const;

export const BATCH_APPROVE_MAX = 50;

/** 催办：同一审批 4 小时内仅 1 次 */
export const REMINDER_COOLDOWN_HOURS = 4;

/** 催办：发起人每日最多 3 次（跨所有审批） */
export const REMINDER_DAILY_MAX = 3;
