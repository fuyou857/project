import { describe, expect, it } from 'vitest';
import { evaluateAmountCondition, filterStepsByAmountRules } from './approvalConditionLogic';
import type { ApprovalFlowStep } from './approvalWorkflowLogic';

const steps: ApprovalFlowStep[] = [
  { step_order: 1, step_name: '发起人', approver_role: 'initiator' },
  { step_order: 2, step_name: '项目经理', approver_role: 'manager' },
  { step_order: 3, step_name: '会计', approver_role: 'accountant' },
  { step_order: 4, step_name: '领导', approver_role: 'admin' },
  { step_order: 5, step_name: '出纳', approver_role: 'cashier' },
];

describe('approvalConditionLogic', () => {
  it('evaluateAmountCondition lt', () => {
    expect(
      evaluateAmountCondition(50000, {
        source_type: 'income_variation',
        field_name: 'variation_amount',
        operator: 'lt',
        threshold_value: 100000,
        max_step_order: 3,
      }),
    ).toBe(true);
  });

  it('filterStepsByAmountRules caps steps', () => {
    const rules = [
      {
        source_type: 'income_variation',
        field_name: 'variation_amount',
        operator: 'lt' as const,
        threshold_value: 100000,
        max_step_order: 3,
      },
    ];
    const out = filterStepsByAmountRules(steps, 80000, rules, 'income_variation');
    expect(out.map((s) => s.step_order)).toEqual([1, 2, 3]);
  });
});
