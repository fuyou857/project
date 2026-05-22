import { getRoleCodesForUser } from '../services/approvalWorkflow';

/** 可查看审批关联业务完整金额的角色 code */
const FULL_AMOUNT_ROLE_CODES = new Set([
  'accountant',
  'finance',
  'project_accountant',
  'budget_manager',
  'admin',
  'company_admin',
  'super_admin',
  'cashier',
  'project_cashier',
  'business',
  'business_manager',
]);

export async function userCanViewApprovalAmounts(userId: string): Promise<boolean> {
  const codes = await getRoleCodesForUser(userId);
  return codes.some((c) => FULL_AMOUNT_ROLE_CODES.has(c));
}

export function formatApprovalAmount(
  value: number | null | undefined,
  canView: boolean,
  unit = '万元',
): string {
  if (value == null || Number.isNaN(Number(value))) return '—';
  if (!canView) return '****';
  return `${Number(value)} ${unit}`;
}
