import { motion } from 'framer-motion';
import { FaExclamationTriangle } from 'react-icons/fa';
import UiModalOverlay from '../../../../components/ui/UiModalOverlay';

type Props = {
  open: boolean;
  invoiceNumber: string;
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function CostInvoiceDeleteDialog({ open, invoiceNumber, deleting, onConfirm, onCancel }: Props) {
  return (
    <UiModalOverlay
      open={open}
      onClose={onCancel}
      panelClassName="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl"
    >
      <div className="mb-4 flex items-start gap-3">
        <FaExclamationTriangle className="mt-0.5 h-6 w-6 shrink-0 text-red-500" />
        <div>
          <h3 id="delete-cost-invoice-title" className="text-lg font-semibold text-gray-900">
            确认删除发票？
          </h3>
          <p className="mt-2 text-sm text-gray-600">
            您即将删除发票编号为 <strong className="text-gray-900">{invoiceNumber || '（无编号）'}</strong>{' '}
            记录。此操作不可恢复，关联的付款信息可能受影响。
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCancel(); }}
          disabled={deleting}
          className="min-h-[44px] rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 active:scale-[0.98]"
        >
          取消
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={deleting}
          className="min-h-[44px] rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-60 active:scale-[0.98]"
        >
          {deleting ? '删除中…' : '确认删除'}
        </button>
      </div>
    </UiModalOverlay>
  );
}
