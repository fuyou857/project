import { useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSubmitApprovalModal } from '../../hooks/useSubmitApprovalModal';
import { bindSubmitApprovalOpener } from '../../utils/submitApprovalBridge';

export default function SubmitApprovalProvider({ children }: { children: React.ReactNode }) {
  const { open, modal } = useSubmitApprovalModal();

  useLayoutEffect(() => {
    bindSubmitApprovalOpener(open);
    return () => bindSubmitApprovalOpener(null);
  }, [open]);

  return (
    <>
      {children}
      {modal ? createPortal(modal, document.body) : null}
    </>
  );
}
