import type { ApprovalFlowStep } from './approvalWorkflowLogic';

export type AmountConditionRule = {
  source_type: string;
  field_name: string;
  operator: 'lt' | 'lte' | 'gte' | 'gt';
  threshold_value: number;
  max_step_order: number;
  is_active?: boolean;
};

export function evaluateAmountCondition(
  amount: number | null | undefined,
  rule: AmountConditionRule,
): boolean {
  if (amount == null || Number.isNaN(Number(amount))) return false;
  const v = Number(amount);
  const t = Number(rule.threshold_value);
  switch (rule.operator) {
    case 'lt':
      return v < t;
    case 'lte':
      return v <= t;
    case 'gte':
      return v >= t;
    case 'gt':
      return v > t;
    default:
      return false;
  }
}

/** 按金额条件裁剪步骤（取匹配规则中最严格的 max_step_order） */
export function filterStepsByAmountRules(
  steps: ApprovalFlowStep[],
  amount: number | null | undefined,
  rules: AmountConditionRule[],
  sourceType: string,
): ApprovalFlowStep[] {
  const active = rules.filter((r) => r.is_active !== false && r.source_type === sourceType);
  let maxStep: number | null = null;
  for (const rule of active) {
    if (evaluateAmountCondition(amount, rule)) {
      if (maxStep == null || rule.max_step_order < maxStep) {
        maxStep = rule.max_step_order;
      }
    }
  }
  if (maxStep == null) return steps;
  return steps.filter((s) => s.step_order <= maxStep!);
}
