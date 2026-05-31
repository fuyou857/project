import { useCallback, useRef, useState } from 'react';
import SubmitApprovalModal from '../components/approval/SubmitApprovalModal';
import {
  buildSubmitApprovalPlan,
  getApprovalSourceLabel,
  resolveProjectIdForApprovalSource,
  type SubmitApprovalOpenConfig,
} from '../services/approvalApproverService';
import { createApprovalWithApprovers } from '../services/approvalService';
import { getStoredUser } from '../utils/sessionUser';

export type { SubmitApprovalOpenConfig };

type ModalState = SubmitApprovalOpenConfig & { open: true };

export function useSubmitApprovalModal() {
  const [state, setState] = useState<ModalState | null>(null);
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);

  const close = useCallback((ok: boolean) => {
    setState(null);
    resolverRef.current?.(ok);
    resolverRef.current = null;
  }, []);

  const open = useCallback((config: SubmitApprovalOpenConfig): Promise<boolean> => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setState({ ...config, open: true });
    });
  }, []);

  const handleSubmit = useCallback(
    async (payload: {
      approvers: { stepOrder: number; approverId: string; approverName: string; isDefault: boolean }[];
      remark: string;
    }) => {
      if (!state) return;
      const user = getStoredUser();
      if (!user.id) {
        close(false);
        return;
      }
      try {
        const row = await createApprovalWithApprovers(
          state.sourceType,
          state.sourceId,
          state.sourceName,
          user.id,
          payload.approvers,
          {
            remark: payload.remark,
            createdByName: user.real_name || user.username,
            projectId: state.projectId,
          },
        );
        close(Boolean(row));
      } catch (e) {
        console.error(e);
        alert(e instanceof Error ? e.message : '提交审批失败');
      }
    },
    [state, close],
  );

  const modal = state ? (
    <SubmitApprovalModal
      config={state}
      title={`发起审批 - ${getApprovalSourceLabel(state.sourceType)}`}
      onClose={() => close(false)}
      onSubmit={handleSubmit}
      loadPlan={async () => {
        const user = getStoredUser();
        if (!user.id) return null;
        const projectId =
          state.projectId !== undefined && state.projectId !== null
            ? state.projectId
            : await resolveProjectIdForApprovalSource(state.sourceType, state.sourceId);
        return buildSubmitApprovalPlan(
          state.sourceType,
          state.sourceId,
          state.sourceName,
          user.id,
          projectId,
        );
      }}
    />
  ) : null;

  return { open, modal, close };
}
