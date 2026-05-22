import { useCallback, useState } from 'react';

/** 单条 Toast（与合同列表等页原 showToast 行为一致：同时仅展示一条） */
export function useSingleToast(durationMs = 3000) {
  const [toast, setToast] = useState<{ type: string; message: string } | null>(null);

  const showToast = useCallback(
    (type: string, message: string) => {
      setToast({ type, message });
      setTimeout(() => setToast(null), durationMs);
    },
    [durationMs],
  );

  return { toast, showToast };
}
