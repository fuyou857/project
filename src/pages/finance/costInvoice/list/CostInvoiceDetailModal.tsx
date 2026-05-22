import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaDownload, FaTimes, FaHistory, FaLink, FaWallet, FaPaperclip, FaInfoCircle } from 'react-icons/fa';
import { supabase } from '../../../../supabase/client';
import { INVOICE_OCR_FIELD_LABELS, unpackExtendedRemark } from '../types';
import { isInvoiceImageMime, isInvoicePdfMime } from '../invoiceFileUtils';
import { formatAmount, formatDateDisplay, formatInvoiceTypeLabel } from './formatters';
import type { EnrichedCostInvoiceRow } from './types';
import UiModalOverlay from '../../../../components/ui/UiModalOverlay';

type Props = {
  invoice: EnrichedCostInvoiceRow | null;
  onClose: () => void;
};

const SectionHeader = ({ icon: Icon, title }: { icon: any; title: string }) => (
  <div className="mb-4 flex items-center gap-2 border-b border-gray-100 pb-2">
    <Icon className="text-blue-600" />
    <h4 className="text-sm font-bold text-gray-800">{title}</h4>
  </div>
);

const InfoItem = ({ label, value, className = '' }: { label: string; value: React.ReactNode; className?: string }) => (
  <div className={className}>
    <dt className="text-xs text-gray-500">{label}</dt>
    <dd className="mt-0.5 text-sm font-medium text-gray-900 break-words">{value || '-'}</dd>
  </div>
);

export default function CostInvoiceDetailModal({ invoice, onClose }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    if (invoice) {
      fetchLogs(invoice.id);
    }
  }, [invoice]);

  const fetchLogs = async (id: string) => {
    setLoadingLogs(true);
    try {
      const { data } = await supabase
        .from('invoice_association_logs')
        .select(`
          *,
          operator:operator_id(real_name, username)
        `)
        .eq('invoice_id', id)
        .order('created_at', { ascending: false });
      setLogs(data || []);
    } catch (e) {
      console.error('Fetch logs error:', e);
    } finally {
      setLoadingLogs(false);
    }
  };

  if (!invoice) return null;

  const ext = unpackExtendedRemark(invoice.remark);
  const attachments = invoice.attachment_urls || [];

  const associationStatusConfig = {
    unassociated: { label: '未关联', color: 'bg-gray-100 text-gray-700' },
    associated_contract: { label: '已关联合同', color: 'bg-blue-100 text-blue-700' },
    no_contract_payment: { label: '无合同付款', color: 'bg-yellow-100 text-yellow-700' },
  };
  const statusInfo = associationStatusConfig[invoice.association_status as keyof typeof associationStatusConfig] || associationStatusConfig.unassociated;

  return (
    <UiModalOverlay
      open={!!invoice}
      onClose={onClose}
      panelClassName="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 bg-gray-50/50 px-6 py-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">发票详情</h3>
          <p className="text-xs text-gray-500 mt-0.5 font-mono">ID: {invoice.id}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 active:scale-95"
        >
          <FaTimes className="h-5 w-5" />
        </button>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Left: Info */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          <div className="space-y-8">
            {/* Status & Project */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className="font-medium text-gray-900">{invoice.project_name || '未归属项目'}</span>
              </div>
            </div>

            {/* Core Info Grid */}
            <section>
              <SectionHeader icon={FaWallet} title="财务金额" />
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                <InfoItem label="价税合计" value={<span className="ui-numeric text-lg font-bold text-blue-700">{formatAmount(invoice.invoice_amount)} 元</span>} />
                <InfoItem label="不含税金额" value={formatAmount(invoice.amount_excluding_tax)} />
                <InfoItem label="税额" value={formatAmount(invoice.tax_amount)} />
                <InfoItem label="税率" value={invoice.tax_rate ? `${invoice.tax_rate}%` : '-'} />
                <InfoItem label="可抵扣税额" value={formatAmount(invoice.deductible_tax)} />
              </div>
            </section>

            {/* Invoice Meta */}
            <section>
              <SectionHeader icon={FaInfoCircle} title="票据信息" />
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                <InfoItem label="发票类型" value={formatInvoiceTypeLabel(invoice.invoice_type)} />
                <InfoItem label="发票编号" value={<span className="font-mono">{invoice.invoice_number}</span>} />
                <InfoItem label="发票代码" value={<span className="font-mono">{invoice.invoice_code}</span>} />
                <InfoItem label="开票日期" value={formatDateDisplay(invoice.invoice_date)} />
                <InfoItem label="开票单位（销售方）" value={invoice.seller_display} className="sm:col-span-2" />
                <InfoItem label="收票单位（购买方）" value={invoice.buyer_name} className="sm:col-span-2" />
                <InfoItem label="备注信息" value={ext.remark || invoice.remark} className="sm:col-span-3" />
              </div>
            </section>

            {/* Association History */}
            <section>
              <SectionHeader icon={FaHistory} title="关联与流转记录" />
              {loadingLogs ? (
                <div className="flex py-8 justify-center">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                </div>
              ) : logs.length === 0 ? (
                <p className="py-4 text-center text-xs text-gray-400">暂无流转记录</p>
              ) : (
                <div className="space-y-4">
                  {logs.map((log) => (
                    <div key={log.id} className="relative pl-6 pb-4 border-l border-gray-100 last:pb-0">
                      <div className="absolute left-[-5px] top-1.5 h-2.5 w-2.5 rounded-full bg-blue-100 border-2 border-blue-500" />
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-bold text-gray-900">{log.operator?.real_name || log.operator?.username || '系统'}</span>
                        <span className="text-[10px] text-gray-400">{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-gray-600">
                        将状态从 <span className="font-medium">"{associationStatusConfig[log.old_status as keyof typeof associationStatusConfig]?.label || '未知'}"</span>
                        修改为 <span className="font-medium text-blue-700">"{associationStatusConfig[log.new_status as keyof typeof associationStatusConfig]?.label || '未知'}"</span>
                      </p>
                      {log.remark && <p className="mt-1 text-xs italic text-gray-500">备注: {log.remark}</p>}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>

        {/* Right: Attachments Preview */}
        <div className="flex-1 border-t border-gray-100 bg-gray-50/50 p-6 lg:border-l lg:border-t-0">
          <SectionHeader icon={FaPaperclip} title={`附件列表 (${attachments.length})`} />
          <div className="grid grid-cols-2 gap-3 mb-6">
            {attachments.map((att, idx) => (
              <button
                key={idx}
                onClick={() => setPreviewUrl(att.url)}
                className={`group relative flex flex-col items-center justify-center gap-2 rounded-xl border p-3 transition-all ${
                  previewUrl === att.url ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300'
                }`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-50 text-gray-400 group-hover:bg-blue-100 group-hover:text-blue-500 transition-colors">
                  <FaPaperclip className="h-6 w-6" />
                </div>
                <span className="max-w-full truncate text-[10px] text-gray-600" title={att.filename}>{att.filename}</span>
              </button>
            ))}
          </div>

          {/* Preview Window */}
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-900/5 shadow-inner">
            {previewUrl ? (
              <>
                {isInvoiceImageMime('', previewUrl) ? (
                  <img src={previewUrl} alt="发票预览" className="h-full w-full object-contain" />
                ) : isInvoicePdfMime('', previewUrl) ? (
                  <iframe src={previewUrl} title="PDF预览" className="h-full w-full border-0" />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                    <p className="text-sm text-gray-500">此格式暂不支持内嵌预览</p>
                    <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="mt-4 flex items-center gap-2 text-blue-600 hover:underline">
                      <FaDownload className="h-3 w-3" /> 新窗口下载查看
                    </a>
                  </div>
                )}
                <button
                  onClick={() => setPreviewUrl(null)}
                  className="absolute right-3 top-3 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors"
                >
                  <FaTimes className="h-4 w-4" />
                </button>
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-gray-400">
                请选择上方附件进行预览
              </div>
            )}
          </div>
        </div>
      </div>
    </UiModalOverlay>
  );
}
