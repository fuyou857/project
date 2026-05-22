import { useMemo, useState, useEffect } from 'react';
import { FaSave, FaTimes, FaSpinner, FaEraser, FaExclamationTriangle } from 'react-icons/fa';
import { SearchableSelect, SegmentedControl } from '../../../components/ui';
import { 
  type CostInvoiceForm, 
  INVOICE_TYPES,
  INVOICE_OCR_FIELD_LABELS,
  type InvoiceOcrFieldKey,
  initialCostInvoiceForm
} from '../costInvoice/types';
import { type InvoiceOcrController, invoiceOcrStatusLabel } from '../../../hooks/useInvoiceOcrForm';
import InvoicePreviewPanel_v2 from './InvoicePreviewPanel_v2';
import { countFormOcrFields, taxRateDisplay } from '../costInvoice/applyOcrToForm';
import { processInvoiceFilesForOcr } from '../costInvoice/invoiceOcrUpload';
import { parseTaxRateInput, formatTaxRateForInput } from '../../../services/invoiceOcrService';

type Props = {
  form: CostInvoiceForm;
  setForm: React.Dispatch<React.SetStateAction<CostInvoiceForm>>;
  editing: boolean;
  submitting: boolean;
  projectOptions: { value: string; label: string }[];
  supplierOptions: { value: string; label: string }[];
  supplierSyncWarnings: string[];
  ocr: InvoiceOcrController;
  uploadFile: (file: File) => Promise<any>;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  onProjectChange: (projectId: string) => void;
  interactionReady: boolean;
};

const STEPS = [
  '上传并识别',
  '核对供应商',
  '核对金额税率',
  '确认入库'
];

export default function CostInvoiceEntryWorkspace_v2({
  form,
  setForm,
  editing,
  submitting,
  projectOptions,
  supplierOptions,
  supplierSyncWarnings,
  ocr,
  uploadFile,
  onSubmit,
  onClose,
  onProjectChange,
  interactionReady
}: Props) {
  const [activeAttachment, setActiveAttachment] = useState(0);
  const [taxRateInput, setTaxRateInput] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setTaxRateInput(taxRateDisplay(form));
  }, [form.tax_rate]);

  const stats = useMemo(() => countFormOcrFields(form, ocr.ocrFilled), [form, ocr.ocrFilled]);
  const busy = uploading || ocr.ocrUiStatus === 'pending' || submitting;

  const handleFiles = async (files: File[]) => {
    setUploading(true);
    try {
      await processInvoiceFilesForOcr({
        fileList: files,
        existingAttachments: form.attachment_urls,
        uploadSingleFile: uploadFile,
        runOcrPipeline: ocr.runOcrPipeline,
        onAttachmentsMerged: (next) => {
          setForm(prev => ({
            ...prev,
            attachment_urls: next,
            attachment_url: next[0]?.url || prev.attachment_url
          }));
        },
        onActiveAttachmentIndex: setActiveAttachment,
        pushLog: ocr.pushLog
      });
    } catch (err: any) {
      alert(err.message || '处理文件失败');
    } finally {
      setUploading(false);
    }
  };

  const fieldClass = (key: InvoiceOcrFieldKey) => {
    let base = "ui-input w-full transition-all ";
    if (ocr.ocrFilled[key]) base += "bg-amber-50/50 border-amber-200 ";
    return base;
  };

  return (
    <div className="flex flex-col h-[95vh] bg-slate-50">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 shrink-0">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            {editing ? '编辑成本发票' : '智能录入成本发票'}
          </h2>
          <div className="flex items-center gap-4 mt-1">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-1.5 text-xs">
                <span className={`w-4 h-4 rounded-full flex items-center justify-center font-bold ${i === 0 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                  {i + 1}
                </span>
                <span className={i === 0 ? 'text-blue-700 font-medium' : 'text-slate-400'}>{s}</span>
                {i < STEPS.length - 1 && <span className="text-slate-300">→</span>}
              </div>
            ))}
          </div>
        </div>
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          className="pointer-events-auto p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
          aria-label="关闭"
        >
          <FaTimes size={20} />
        </button>
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left: Preview */}
        <div className="w-[45%] p-4 border-r border-slate-200 flex flex-col">
          <InvoicePreviewPanel_v2
            attachments={form.attachment_urls}
            activeIndex={activeAttachment}
            onActiveIndexChange={setActiveAttachment}
            onFiles={handleFiles}
            ocrStatus={ocr.ocrUiStatus}
            progress={ocr.progress}
            progressLabel={ocr.progressLabel}
            disabled={busy || !interactionReady}
          />
        </div>

        {/* Right: Form */}
        <form onSubmit={onSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
          {/* Status Banner */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-center">
              <div className="text-2xl font-bold text-emerald-600">{stats.success}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">已识别字段</div>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-center">
              <div className="text-2xl font-bold text-amber-500">{stats.missing}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">待补全字段</div>
            </div>
            <div className={`p-3 rounded-xl border shadow-sm text-center ${
              ocr.ocrUiStatus === 'success' ? 'bg-emerald-50 border-emerald-200' : 
              ocr.ocrUiStatus === 'pending' ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'
            }`}>
              <div className={`text-sm font-bold ${ocr.ocrUiStatus === 'success' ? 'text-emerald-700' : 'text-slate-700'}`}>
                {invoiceOcrStatusLabel(ocr.ocrUiStatus)}
              </div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">当前状态</div>
            </div>
          </div>

          {supplierSyncWarnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-start gap-2 text-sm text-amber-800">
              <FaExclamationTriangle className="mt-0.5 shrink-0" />
              <div>{supplierSyncWarnings.map((w, i) => <p key={i}>{w}</p>)}</div>
            </div>
          )}

          {/* Core Selection */}
          <div className="grid grid-cols-2 gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div>
              <label className="ui-label mb-1.5 flex items-center gap-1">
                <span className="text-red-500">*</span> 项目名称
              </label>
              <SearchableSelect
                value={form.project_id}
                onChange={onProjectChange}
                options={projectOptions}
                placeholder="搜索项目..."
              />
            </div>
            <div>
              <label className="ui-label mb-1.5 flex items-center gap-1">
                <span className="text-red-500">*</span> 开票单位（乙方）
              </label>
              <SearchableSelect
                value={form.supplier_id}
                onChange={v => setForm({ ...form, supplier_id: v })}
                options={supplierOptions}
                placeholder="选择乙方单位"
              />
            </div>
          </div>

          {/* Invoice Basic Info */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-4">票据基本信息</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="ui-label mb-1.5">{INVOICE_OCR_FIELD_LABELS.invoice_number} <span className="text-red-500">*</span></label>
                <input
                  className={fieldClass('invoice_number')}
                  value={form.invoice_number}
                  onChange={e => {
                    ocr.touchManual('invoice_number');
                    setForm({ ...form, invoice_number: e.target.value.replace(/\D/g, '').slice(-6) });
                  }}
                  placeholder="最后6位数字"
                />
              </div>
              <div>
                <label className="ui-label mb-1.5">开票日期 <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  className={fieldClass('invoice_date')}
                  value={form.invoice_date}
                  onChange={e => {
                    ocr.touchManual('invoice_date');
                    setForm({ ...form, invoice_date: e.target.value });
                  }}
                />
              </div>
              <div className="col-span-2">
                <label className="ui-label mb-1.5">发票类型 <span className="text-red-500">*</span></label>
                <SegmentedControl
                  value={form.invoice_type as any}
                  onChange={v => {
                    ocr.touchManual('invoice_type');
                    setForm({ ...form, invoice_type: v });
                  }}
                  options={INVOICE_TYPES.map(t => ({ value: t, label: t }))}
                />
              </div>
            </div>
          </div>

          {/* Amounts */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-4">金额与税率</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="ui-label mb-1.5">价税合计 (小写) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  step="0.01"
                  className={fieldClass('invoice_amount')}
                  value={form.invoice_amount ?? ''}
                  onChange={e => setForm({ ...form, invoice_amount: parseFloat(e.target.value) || undefined })}
                />
              </div>
              <div>
                <label className="ui-label mb-1.5">税率</label>
                <input
                  className={fieldClass('tax_rate')}
                  value={taxRateInput}
                  onChange={e => {
                    ocr.touchManual('tax_rate');
                    setTaxRateInput(e.target.value);
                  }}
                  onBlur={() => {
                    const parsed = parseTaxRateInput(taxRateInput);
                    setForm(f => ({ ...f, tax_rate: parsed }));
                    setTaxRateInput(formatTaxRateForInput(parsed));
                  }}
                  placeholder="如: 13%"
                />
              </div>
              {form.invoice_type === '专票' && (
                <div className="col-span-2">
                  <label className="ui-label mb-1.5">可抵扣税额</label>
                  <input
                    type="number"
                    step="0.01"
                    className="ui-input w-full"
                    value={form.deductible_tax ?? ''}
                    onChange={e => setForm({ ...form, deductible_tax: parseFloat(e.target.value) || undefined })}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Seller & Goods */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-4">详情信息</h4>
            <div className="space-y-4">
              <div>
                <label className="ui-label mb-1.5">销售方名称</label>
                <input
                  className={fieldClass('seller_name')}
                  value={form.seller_name}
                  onChange={e => {
                    ocr.touchManual('seller_name');
                    setForm({ ...form, seller_name: e.target.value });
                  }}
                />
              </div>
              <div>
                <label className="ui-label mb-1.5">商品/服务内容</label>
                <textarea
                  className={fieldClass('goods_name')}
                  rows={2}
                  value={form.goods_name}
                  onChange={e => {
                    ocr.touchManual('goods_name');
                    setForm({ ...form, goods_name: e.target.value });
                  }}
                />
              </div>
              <div>
                <label className="ui-label mb-1.5">备注</label>
                <textarea
                  className="ui-input w-full"
                  rows={2}
                  value={form.remark}
                  onChange={e => setForm({ ...form, remark: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (confirm('确定清空所有识别结果和手动填写内容？')) {
                    setForm(initialCostInvoiceForm());
                    ocr.resetOcrMeta();
                    setTaxRateInput('');
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
              >
                <FaEraser /> 清空表单
              </button>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  try {
                    onClose();
                  } catch (err) {
                    console.error('[CostInvoiceEntryWorkspace_v2] 取消按钮点击失败', err);
                  }
                }}
                className="pointer-events-auto px-6 py-2 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-all active:scale-95"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={busy}
                className="flex items-center gap-2 px-8 py-2 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 disabled:opacity-50 transition-all active:scale-95"
              >
                {submitting ? <FaSpinner className="animate-spin" /> : <FaSave />}
                {editing ? '更新发票' : '确认入库'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
