import { describe, expect, it } from 'vitest';
import { planStepsAfter, shouldSkipApprovalStep } from './approvalWorkflowLogic';

describe('approvalWorkflowLogic', () => {
  const steps = [
    { step_order: 1, step_name: '发起人提交', approver_role: 'initiator', approver_id: null },
    { step_order: 2, step_name: '项目经理确认', approver_role: 'manager', approver_id: null },
    { step_order: 3, step_name: '会计审核', approver_role: 'accountant', approver_id: null },
  ];

  it('shouldSkipApprovalStep skips initiator', () => {
    expect(shouldSkipApprovalStep(steps[0], 'u1', ['u1'])).toBe(true);
  });

  it('shouldSkipApprovalStep skips when sole approver is initiator', () => {
    expect(shouldSkipApprovalStep(steps[1], 'u1', ['u1'])).toBe(true);
  });

  it('shouldSkipApprovalStep does not skip when multiple approvers', () => {
    expect(shouldSkipApprovalStep(steps[1], 'u1', ['u1', 'u2'])).toBe(false);
  });

  it('planStepsAfter skips initiator and lands on manager', () => {
    const resolver = (step: { approver_role: string }) => {
      if (step.approver_role === 'initiator') return ['u1'];
      if (step.approver_role === 'manager') return ['u2'];
      return ['u3'];
    };
    const { nextStepOrder, autoRecords } = planStepsAfter(steps, 0, 'u1', resolver);
    expect(nextStepOrder).toBe(2);
    expect(autoRecords).toHaveLength(1);
    expect(autoRecords[0].step_order).toBe(1);
  });

  it('planStepsAfter completes when all remaining steps auto-skip', () => {
    const resolver = () => ['u1'];
    const { nextStepOrder, autoRecords } = planStepsAfter(steps, 1, 'u1', resolver);
    expect(nextStepOrder).toBeNull();
    expect(autoRecords.length).toBeGreaterThanOrEqual(1);
  });
});
