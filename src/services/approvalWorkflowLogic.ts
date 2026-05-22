export type ApprovalFlowStep = {
  step_order: number;
  step_name: string;
  approver_role: string;
  approver_id?: string | null;
};

export type AutoApprovalRecord = {
  step_order: number;
  step_name: string;
  approver_role: string;
};

export function shouldSkipApprovalStep(
  step: ApprovalFlowStep,
  initiatorId: string,
  approverUserIds: string[],
): boolean {
  if (step.approver_role === 'initiator') return true;
  if (approverUserIds.length === 0) return false;
  if (approverUserIds.length === 1 && approverUserIds[0] === initiatorId) return true;
  return false;
}

export function planStepsAfter(
  steps: ApprovalFlowStep[],
  afterStepOrder: number,
  initiatorId: string,
  approverIdsResolver: (step: ApprovalFlowStep) => string[],
): { nextStepOrder: number | null; autoRecords: AutoApprovalRecord[] } {
  const sorted = [...steps].sort((a, b) => a.step_order - b.step_order);
  const autoRecords: AutoApprovalRecord[] = [];

  for (const step of sorted) {
    if (step.step_order <= afterStepOrder) continue;
    const approverIds = approverIdsResolver(step);
    if (shouldSkipApprovalStep(step, initiatorId, approverIds)) {
      autoRecords.push({
        step_order: step.step_order,
        step_name: step.step_name,
        approver_role: step.approver_role,
      });
      continue;
    }
    return { nextStepOrder: step.step_order, autoRecords };
  }

  return { nextStepOrder: null, autoRecords };
}
