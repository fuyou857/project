import { useCallback, useEffect, useState } from 'react';
import { FaPaperPlane } from 'react-icons/fa';
import { getApprovalBySource } from '../../services/approvalService';
import { tryCreateApproval } from '../../utils/contractSubPage';

type Props = {
  sourceType: string;
  sourceId: string;
  sourceName: string;
  projectId?: string | null;
  summaryRows?: { label: string; value: string }[];
  onDone?: (submitted: boolean) => void;
};

export default function SubmitApprovalListAction({
  sourceType,
  sourceId,
  sourceName,
  projectId,
  summaryRows,
  onDone,
}: Props) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const approval = await getApprovalBySource(sourceType, sourceId);
      setVisible(!approval || approval.status === 'rejected' || approval.status === 'withdrawn');
    } catch {
      setVisible(true);
    }
  }, [sourceType, sourceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!visible) return null;

  return (
    <button
      type="button"
      disabled={loading}
      title="提交审批"
      onClick={async () => {
        setLoading(true);
        try {
          const ok = await tryCreateApproval(sourceType, sourceId, sourceName, {
            projectId,
            summaryRows,
          });
          onDone?.(ok);
          await refresh();
        } finally {
          setLoading(false);
        }
      }}
      className="p-2 text-emerald-600 hover:bg-emerald-500/15 rounded-lg disabled:opacity-50"
    >
      <FaPaperPlane className="w-4 h-4" />
    </button>
  );
}
