import { useEffect, useRef, useState } from 'react';
import { FaDownload, FaExternalLinkAlt } from 'react-icons/fa';
import { formatAmount, formatDateDisplay } from './formatters';
import type { PaymentHistoryItem } from './types';

type Props = {
  paid: number;
  payments: PaymentHistoryItem[];
};

export default function CostInvoicePaidCell({ paid, payments }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (paid <= 0) {
    return <span className="ui-numeric text-gray-400">0.00</span>;
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="ui-numeric font-medium text-emerald-600 underline-offset-2 transition hover:underline active:scale-[0.98]"
      >
        {formatAmount(paid)}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-72 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
          <p className="mb-2 text-xs font-medium text-gray-500">付款明细</p>
          {payments.length === 0 ? (
            <p className="text-sm text-gray-500">暂无付款记录</p>
          ) : (
            <ul className="max-h-48 space-y-2 overflow-y-auto">
              {payments.map((p) => {
                const voucher = p.payment_voucher_url || p.attachment_url;
                return (
                  <li key={p.id} className="rounded-md border border-gray-100 bg-gray-50 p-2 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-500">付款时间</span>
                      <span className="text-gray-800">{formatDateDisplay(p.transfer_date)}</span>
                    </div>
                    <div className="mt-1 flex justify-between gap-2">
                      <span className="text-gray-500">付款金额</span>
                      <span className="ui-numeric font-medium text-emerald-700">{formatAmount(p.amount)}</span>
                    </div>
                    <div className="mt-1 flex justify-between gap-2">
                      <span className="text-gray-500">付款方式</span>
                      <span className="text-gray-800">{p.payment_type || '-'}</span>
                    </div>
                    {voucher && (
                      <div className="mt-2 flex gap-2">
                        <a
                          href={voucher}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-[44px] min-w-[44px] flex-1 items-center justify-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
                        >
                          <FaExternalLinkAlt /> 预览
                        </a>
                        <a
                          href={voucher}
                          download
                          className="inline-flex min-h-[44px] min-w-[44px] flex-1 items-center justify-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                        >
                          <FaDownload /> 下载
                        </a>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
