import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { FaEraser, FaRedo, FaSave, FaSpinner, FaTimes } from 'react-icons/fa';
import { parseTaxRateInput, formatTaxRateForInput } from '../../../services/invoiceOcrService';
import {
  useInvoiceOcrForm,
  invoiceOcrStatusLabel,
  type InvoiceOcrController,
} from '../../../hooks/useInvoiceOcrForm';
import { SearchableSelect, SegmentedControl } from '../../../components/ui';
import type { InvoiceAttachmentItem } from './types';
import InvoicePreviewPanel from './InvoicePreviewPanel';
import { countFormOcrFields, taxRateDisplay } from './applyOcrToForm';
import { processInvoiceFilesForOcr } from './invoiceOcrUpload';
import {
  COST_INVOICE_MAX_BYTES,
  INVOICE_OCR_FIELD_LABELS,
  INVOICE_TYPES,
  type CostInvoiceForm,
  type InvoiceOcrFieldKey,
  type OcrUiStatus,
  initialCostInvoiceForm } from
'./types';

type Props = {
  editing: boolean;
  form: CostInvoiceForm;
  setForm: React.Dispatch<React.SetStateAction<CostInvoiceForm>>;
  projectOptions: {value: string;label: string;}[];
  supplierOptions: {value: string;label: string;}[];
  projectSuppliersEmpty: boolean;
  supplierSyncWarnings?: string[];
  uploadSingleFile: (file: File) => Promise<InvoiceAttachmentItem>;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  priceTaxMismatch: boolean;
  /** 由父级（InvoiceEntry）注入时可与提交侧共用同一 OCR 状态 */
  ocr?: InvoiceOcrController;
  onOcrStatusChange?: (status: OcrUiStatus) => void;
  onOcrComplete?: (form: CostInvoiceForm, status: OcrUiStatus) => void;
  onProjectChange?: (projectId: string) => void;
  onOpenAddPartyB?: () => void;
  /** 弹窗打开后点击穿透保护完成前为 false，禁止误触文件选择 */
  fileUploadEnabled?: boolean;
};

const ENTRY_FLOW_STEPS = [
  '上传发票，等待 OCR 完成',
  '查看顶部提示，按需确认「新增基础数据乙方」',
  '选择项目，系统自动匹配或添加项目乙方并选中开票单位',
  '核对字段后提交入库',
] as const;

function FormField({
  label,
  required,
  ocrFilled,
  warning,
  children






}: {label: string;required?: boolean;ocrFilled?: boolean;warning?: string;children: React.ReactNode;}) {
  return (
    <div>
      <label className="ui-label mb-1.5 flex items-center gap-1">
        {required && <span className="text-red-500">*</span>}
        {label}
        {!required && <span className="text-slate-400 font-normal">（选填）</span>}
      </label>
      {children}
      {warning && <p className="text-xs text-red-600 mt-1">{warning}</p>}
      {ocrFilled && <p className="text-xs text-emerald-600 mt-0.5">已由 OCR 自动填充</p>}
    </div>);

}

export default function CostInvoiceEntryWorkspace({
  editing,
  form,
  setForm,
  projectOptions,
  supplierOptions,
  projectSuppliersEmpty,
  supplierSyncWarnings = [],
  uploadSingleFile,
  onSubmit,
  onClose,
  priceTaxMismatch,
  ocr: ocrProp,
  onOcrStatusChange,
  onOcrComplete,
  onProjectChange,
  onOpenAddPartyB,
  fileUploadEnabled = true,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [taxRateInput, setTaxRateInput] = useState('');
  const [activeAttachment, setActiveAttachment] = useState(0);
  const internalOcr = useInvoiceOcrForm({ setForm, onOcrStatusChange, onOcrComplete });
  const {
    ocrUiStatus,
    ocrWarnings,
    ocrFilled,
    progress,
    progressLabel,
    logs,
    pushLog,
    touchManual,
    runOcrPipeline,
    resetOcrMeta,
  } = ocrProp ?? internalOcr;
  const busy = uploading || ocrUiStatus === 'pending';

  useEffect(() => {
    setTaxRateInput(taxRateDisplay(form));
  }, [form.tax_rate]);

  const stats = useMemo(() => countFormOcrFields(form, ocrFilled), [form, ocrFilled]);

  const activeFlowStep = useMemo(() => {
    const hasFile = form.attachment_urls.length > 0;
    if (!hasFile || ocrUiStatus === 'pending') return 1;
    if (ocrUiStatus === 'failed' || (ocrUiStatus === 'idle' && hasFile)) return 1;
    if (supplierSyncWarnings.length > 0) return 2;
    if (!form.project_id || !form.supplier_id) return 3;
    return 4;
  }, [
    form.attachment_urls.length,
    form.project_id,
    form.supplier_id,
    ocrUiStatus,
    supplierSyncWarnings.length,
  ]);

  const fieldInputClass = (key: InvoiceOcrFieldKey, numeric = false) => {
    let c = 'ui-input w-full transition-all duration-200 ';
    if (numeric) c += 'ui-numeric ';
    if (ocrFilled[key]) c += 'bg-amber-50/90 border-amber-300 ring-1 ring-amber-200/80 ';
    if (priceTaxMismatch && ['invoice_amount', 'total_amount_excl', 'total_tax'].includes(key)) {
      c += 'border-red-400 ring-1 ring-red-300/60 ';
    }
    return c;
  };

  const processFiles = async (fileList: File[]) => {
    setUploading(true);
    try {
      await processInvoiceFilesForOcr({
        fileList,
        existingAttachments: form.attachment_urls,
        uploadSingleFile,
        runOcrPipeline,
        onAttachmentsMerged: (nextAttachments) => {
          setForm((prev) => ({
            ...prev,
            attachment_urls: nextAttachments,
            attachment_url: nextAttachments[0]?.url || prev.attachment_url,
          }));
        },
        onActiveAttachmentIndex: setActiveAttachment,
        pushLog,
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : '上传失败');
      pushLog('error', e instanceof Error ? e.message : '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const clearAllForm = () => {
    if (!window.confirm('确定清空整张发票表单？')) return;
    setForm(initialCostInvoiceForm());
    resetOcrMeta();
    setTaxRateInput('');
    pushLog('info', '已清空表单');
  };

  const clearOcrOnly = () => {
    setForm((prev) => ({
      ...initialCostInvoiceForm(),
      project_id: prev.project_id,
      supplier_id: prev.supplier_id,
      attachment_urls: prev.attachment_urls,
      attachment_url: prev.attachment_url
    }));
    resetOcrMeta();
    pushLog('info', '已重置识别数据');
  };

  const ModuleCard = ({ title, children }: {title: string;children: React.ReactNode;}) =>
  <motion.section
    layout
    className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm"
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}>
    
      <h4 className="text-sm font-semibold text-blue-900 border-l-4 border-blue-600 pl-2 mb-3">{title}</h4>
      {children}
    </motion.section>;


  return (
    <form onSubmit={onSubmit} className="flex flex-col h-full max-h-[92vh]">
      <div className="flex items-center justify-between px-1 pb-4 border-b border-slate-200 shrink-0">
        <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
          <h3 className="ui-page-title text-xl text-blue-950">成本发票智能识别录入</h3>
          <p className="text-caption text-slate-500 mt-0.5">上传即识别 · 仅本地 OCR · 商务办公级录入体验</p>
        </motion.div>
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          className="pointer-events-auto p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
          aria-label="关闭"
        >
          <FaTimes />
        </button>
      </div>

      <ol className="mb-3 px-1 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 text-xs shrink-0" aria-label="使用流程">
        {ENTRY_FLOW_STEPS.map((text, i) => {
          const step = i + 1;
          const done = step < activeFlowStep;
          const current = step === activeFlowStep;
          return (
            <li
              key={step}
              className={`flex gap-2 rounded-lg border px-2.5 py-2 leading-snug ${
                current
                  ? 'border-blue-300 bg-blue-50 text-blue-950'
                  : done
                    ? 'border-emerald-200 bg-emerald-50/80 text-emerald-900'
                    : 'border-slate-200 bg-slate-50 text-slate-500'
              }`}>
              <span
                className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold ${
                  current ? 'bg-blue-600 text-white' : done ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-white'
                }`}>
                {done ? '✓' : step}
              </span>
              <span>{text}</span>
            </li>
          );
        })}
      </ol>

      <motion.div className="grid grid-cols-1 xl:grid-cols-2 gap-5 flex-1 min-h-0 overflow-hidden pb-4">
        <div className="min-h-0 overflow-y-auto scrollbar-thin pr-1">
          <InvoicePreviewPanel
            attachments={form.attachment_urls}
            activeIndex={activeAttachment}
            onActiveIndexChange={setActiveAttachment}
            uploading={uploading}
            ocrStatus={ocrUiStatus}
            progress={progress}
            progressLabel={progressLabel}
            disabled={busy}
            fileUploadEnabled={fileUploadEnabled}
            onFiles={processFiles}
            onOptimizedFile={(f) => void processFiles([f])}
          />
          
        </div>

        <motion.div className="min-h-0 overflow-y-auto scrollbar-thin space-y-4 pl-0 xl:pl-1" layout>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 py-2">
              <div className="text-lg font-semibold text-emerald-700 tabular-nums">{stats.success}</div>
              <div className="text-emerald-800/80">已识别</div>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-200 py-2">
              <div className="text-lg font-semibold text-amber-700 tabular-nums">{stats.missing}</div>
              <div className="text-amber-800/80">待补全</div>
            </div>
            <div
              className={`rounded-lg border py-2 ${(() => {if (
                ocrUiStatus === 'failed') {return (
                    'bg-red-50 border-red-200 text-red-700');} else {if (
                  ocrUiStatus === 'success') {return (
                      'bg-emerald-50 border-emerald-200 text-emerald-700');} else {return (
                      'bg-slate-50 border-slate-200 text-slate-600');}}})()}`
              }>
              
              <div className="text-sm font-medium">{invoiceOcrStatusLabel(ocrUiStatus)}</div>
              <div>状态</div>
            </div>
          </div>
          {(ocrWarnings.length > 0 || priceTaxMismatch || supplierSyncWarnings.length > 0) &&
          <motion.div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {ocrUiStatus === 'failed' && <p className="text-red-700 font-medium">识别异常，请核对或手工修正。</p>}
              {priceTaxMismatch && <p>价税分离校验未通过，请核对金额字段。</p>}
              {supplierSyncWarnings.map((w, i) =>
            <p key={`sync-${i}`} className="text-amber-900">{w}</p>
            )}
              {ocrWarnings.map((w, i) =>
            <p key={i}>{w}</p>
            )}
            </motion.div>
          }

          <ModuleCard title="项目关联">
            <motion.div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="项目名称" required>
                <SearchableSelect
                  required
                  allowEmpty={false}
                  value={form.project_id}
                  onChange={(v) => {
                    if (onProjectChange) onProjectChange(v);
                    else setForm({ ...form, project_id: v, supplier_id: '' });
                  }}
                  options={projectOptions}
                  placeholder="选择项目"
                  searchPlaceholder="搜索项目…" />
                
              </FormField>
              <FormField label="开票单位（乙方）" required>
                <SearchableSelect
                  required
                  allowEmpty={false}
                  value={form.supplier_id}
                  onChange={(v) => setForm({ ...form, supplier_id: v })}
                  options={supplierOptions}
                  placeholder="选择乙方单位"
                  searchPlaceholder="搜索…" />
                
                {form.seller_name?.trim() && ocrFilled.seller_name &&
                <p className="text-emerald-600 text-xs mt-1">
                    销售方「{form.seller_name}」将用于匹配项目乙方；识别完成后已对照基础数据校验。
                  </p>
                }
                {projectSuppliersEmpty && form.project_id &&
                <p className="text-amber-600 text-xs mt-1">该项目暂无乙方单位，识别后将尝试自动添加或请手动选择</p>
                }
                {onOpenAddPartyB &&
                <button
                  type="button"
                  onClick={onOpenAddPartyB}
                  className="text-xs text-blue-600 hover:underline mt-1">
                  
                    在基础数据中新增/修正乙方单位
                  </button>
                }
              </FormField>
            </motion.div>
          </ModuleCard>

          <ModuleCard title="① 票据基础信息">
            <motion.div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(['invoice_code', 'invoice_number', 'invoice_date'] as const).map((key) =>
              <FormField
                key={key}
                label={INVOICE_OCR_FIELD_LABELS[key]}
                required={key === 'invoice_number' || key === 'invoice_date'}
                ocrFilled={ocrFilled[key]}
                warning={key === 'invoice_number' && form.invoice_number && (form.invoice_number.length !== 6 || !/^\d+$/.test(form.invoice_number)) ? '发票号码须为6位数字' : undefined}>
                
                  <input
                  type={key === 'invoice_date' ? 'date' : 'text'}
                  required={key === 'invoice_number' || key === 'invoice_date'}
                  value={(form as unknown as Record<string, string | number | undefined>)[key] ?? ''}
                  placeholder={key === 'invoice_number' ? '仅需输入后6位数字' : undefined}
                  title={key === 'invoice_number' ? '发票识别后将仅保留最后6位数字' : undefined}
                  onChange={(e) => {
                    touchManual(key);
                    let val = e.target.value;
                    if (key === 'invoice_number') {
                      // 手动输入也限制为数字且截取后6位
                      val = val.replace(/\D/g, '').slice(-6);
                    }
                    setForm({ ...form, [key]: val });
                  }}
                  className={fieldInputClass(key)} />
                
                </FormField>
              )}
              <FormField label="发票类型" required ocrFilled={ocrFilled.invoice_type}>
                <SegmentedControl
                  value={form.invoice_type as (typeof INVOICE_TYPES)[number]}
                  onChange={(v) => {
                    touchManual('invoice_type');
                    setForm({ ...form, invoice_type: v });
                  }}
                  options={INVOICE_TYPES.map((t) => ({ value: t, label: t }))}
                  aria-label="发票类型" />
                
              </FormField>
              <FormField label={INVOICE_OCR_FIELD_LABELS.invoice_title} ocrFilled={ocrFilled.invoice_title}>
                <input
                  value={form.invoice_title}
                  onChange={(e) => {
                    touchManual('invoice_title');
                    setForm({ ...form, invoice_title: e.target.value });
                  }}
                  className={fieldInputClass('invoice_title')} />
                
              </FormField>
              <FormField label={INVOICE_OCR_FIELD_LABELS.consumption_type} ocrFilled={ocrFilled.consumption_type}>
                <input
                  value={form.consumption_type}
                  onChange={(e) => {
                    touchManual('consumption_type');
                    setForm({ ...form, consumption_type: e.target.value });
                  }}
                  className={fieldInputClass('consumption_type')} />
                
              </FormField>
            </motion.div>
          </ModuleCard>

          <ModuleCard title="② 购买方信息">
            <motion.div className="space-y-3">
              {(['buyer_name', 'buyer_address_phone', 'buyer_bank'] as const).map((key) =>
              <FormField key={key} label={INVOICE_OCR_FIELD_LABELS[key]} ocrFilled={ocrFilled[key]}>
                  <textarea
                  rows={key === 'buyer_name' ? 1 : 2}
                  value={form[key]}
                  onChange={(e) => {
                    touchManual(key);
                    setForm({ ...form, [key]: e.target.value });
                  }}
                  className={fieldInputClass(key)} />
                
                </FormField>
              )}
            </motion.div>
          </ModuleCard>

          <ModuleCard title="③ 商品应税明细">
            <motion.div className="space-y-3">
              <FormField label={INVOICE_OCR_FIELD_LABELS.goods_name} ocrFilled={ocrFilled.goods_name}>
                <textarea
                  rows={3}
                  value={form.goods_name}
                  onChange={(e) => {
                    touchManual('goods_name');
                    setForm({ ...form, goods_name: e.target.value });
                  }}
                  className={fieldInputClass('goods_name')}
                  placeholder="保留完整商品名称与前缀符号" />
                
              </FormField>
              <motion.div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {(['tax_rate', 'unit_price', 'unit', 'quantity', 'line_amount', 'line_tax'] as const).map((key) =>
                <FormField key={key} label={INVOICE_OCR_FIELD_LABELS[key]} ocrFilled={ocrFilled[key]}>
                    {key === 'tax_rate' ?
                  <input
                    value={taxRateInput}
                    onChange={(e) => {
                      touchManual('tax_rate');
                      setTaxRateInput(e.target.value);
                    }}
                    onBlur={() => {
                      const parsed = parseTaxRateInput(taxRateInput);
                      setForm((f) => ({ ...f, tax_rate: parsed }));
                      setTaxRateInput(formatTaxRateForInput(parsed));
                    }}
                    className={fieldInputClass('tax_rate', true)}
                    placeholder="13 或 13%" /> :


                  <input
                    value={form[key]}
                    onChange={(e) => {
                      touchManual(key);
                      setForm({ ...form, [key]: e.target.value });
                    }}
                    className={fieldInputClass(key, true)} />

                  }
                  </FormField>
                )}
              </motion.div>
            </motion.div>
          </ModuleCard>

          <ModuleCard title="④ 财税金额汇总">
            <motion.div className="grid grid-cols-2 gap-3">
              {(
              [
              ['subtotal_amount', false],
              ['total_amount_excl', true],
              ['total_tax', true],
              ['invoice_amount', true],
              ['amount_in_words', false]] as
              const).
              map(([key, isDbAmount]) =>
              <FormField
                key={key}
                label={
                key === 'invoice_amount' ?
                '价税合计（小写）' :
                INVOICE_OCR_FIELD_LABELS[key as keyof typeof INVOICE_OCR_FIELD_LABELS]
                }
                required={key === 'invoice_amount'}
                ocrFilled={ocrFilled[key as InvoiceOcrFieldKey]}>
                
                  <input
                  type={key === 'amount_in_words' ? 'text' : 'number'}
                  step="0.01"
                  required={key === 'invoice_amount'}
                  value={(() => {if (
                    key === 'invoice_amount') {return (
                        form.invoice_amount ?? '');} else {if (
                      key === 'total_amount_excl') {return (
                          form.amount_excluding_tax ?? form.total_amount_excl);} else {if (
                        key === 'total_tax') {return (
                            form.tax_amount ?? form.total_tax);} else {return (
                            (form as unknown as Record<string, string | number | undefined>)[key] ?? '');}}}})()
                  }
                  onChange={(e) => {
                    if (key !== 'invoice_amount') touchManual(key as InvoiceOcrFieldKey);
                    if (key === 'invoice_amount') {
                      const n = parseFloat(e.target.value);
                      setForm({ ...form, invoice_amount: Number.isNaN(n) ? undefined : n });
                    } else if (isDbAmount && key === 'total_amount_excl') {
                      const n = parseFloat(e.target.value);
                      setForm({
                        ...form,
                        amount_excluding_tax: Number.isNaN(n) ? undefined : n,
                        total_amount_excl: e.target.value
                      });
                    } else if (isDbAmount && key === 'total_tax') {
                      const n = parseFloat(e.target.value);
                      setForm({
                        ...form,
                        tax_amount: Number.isNaN(n) ? undefined : n,
                        total_tax: e.target.value
                      });
                    } else {
                      setForm({ ...form, [key]: e.target.value });
                    }
                  }}
                  className={fieldInputClass(
                    (key === 'invoice_amount' ? 'subtotal_amount' : key) as InvoiceOcrFieldKey,
                    key !== 'amount_in_words'
                  )} />
                
                </FormField>
              )}
              {form.invoice_type === '专票' &&
              <FormField label="可抵扣税额">
                  <input
                  type="number"
                  step="0.01"
                  value={form.deductible_tax ?? ''}
                  onChange={(e) =>
                  setForm({ ...form, deductible_tax: parseFloat(e.target.value) || undefined })
                  }
                  className="ui-input ui-numeric w-full" />
                
                </FormField>
              }
            </motion.div>
          </ModuleCard>

          <ModuleCard title="⑤ 销售方信息">
            <motion.div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label={INVOICE_OCR_FIELD_LABELS.seller_name} ocrFilled={ocrFilled.seller_name}>
                <input
                  value={form.seller_name}
                  onChange={(e) => {
                    touchManual('seller_name');
                    setForm({ ...form, seller_name: e.target.value });
                  }}
                  className={fieldInputClass('seller_name')} />
                
              </FormField>
              <FormField label="销售方纳税人识别号">
                <input
                  value={form.seller_tax_id}
                  onChange={(e) => setForm({ ...form, seller_tax_id: e.target.value })}
                  className="ui-input w-full" />
                
              </FormField>
              <FormField label={INVOICE_OCR_FIELD_LABELS.seller_address_phone} ocrFilled={ocrFilled.seller_address_phone}>
                <textarea
                  rows={2}
                  value={form.seller_address_phone}
                  onChange={(e) => {
                    touchManual('seller_address_phone');
                    setForm({ ...form, seller_address_phone: e.target.value });
                  }}
                  className={fieldInputClass('seller_address_phone')} />
                
              </FormField>
              <FormField label={INVOICE_OCR_FIELD_LABELS.seller_bank} ocrFilled={ocrFilled.seller_bank}>
                <textarea
                  rows={2}
                  value={form.seller_bank}
                  onChange={(e) => {
                    touchManual('seller_bank');
                    setForm({ ...form, seller_bank: e.target.value });
                  }}
                  className={fieldInputClass('seller_bank')} />
                
              </FormField>
            </motion.div>
          </ModuleCard>

          <ModuleCard title="⑥ 服务备注类目">
            <FormField label={INVOICE_OCR_FIELD_LABELS.service_category} ocrFilled={ocrFilled.service_category}>
              <textarea
                rows={3}
                value={form.service_category || form.remark}
                onChange={(e) => {
                  touchManual('service_category');
                  setForm({ ...form, service_category: e.target.value, remark: e.target.value });
                }}
                className={fieldInputClass('service_category')} />
              
            </FormField>
          </ModuleCard>

          {logs.length > 0 &&
          <details className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-xs" open>
              <summary className="cursor-pointer font-medium text-slate-700">识别日志</summary>
              <ul className="mt-2 space-y-1 max-h-28 overflow-y-auto">
                {logs.map((l) =>
              <li
                key={l.id}
                className={(() => {if (
                  l.level === 'error') {return (
                      'text-red-600');} else {if (
                    l.level === 'success') {return (
                        'text-emerald-700');} else {return (
                        'text-slate-600');}}})()
                }>
                
                    [{l.at}] {l.message}
                  </li>
              )}
              </ul>
            </details>
          }
        </motion.div>
      </motion.div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200 shrink-0">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !form.attachment_urls.length}
            onClick={() => {
              const urls = form.attachment_urls.map((a) => a.url);
              void runOcrPipeline(urls);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
            
            {ocrUiStatus === 'pending' ? <FaSpinner className="animate-spin" /> : <FaRedo />}
            重新识别
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={clearOcrOnly}
            className="px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors">
            
            重置识别
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={clearAllForm}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors">
            
            <FaEraser /> 清空表单
          </button>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              try {
                onClose();
              } catch (err) {
                console.error('[CostInvoiceEntryWorkspace] 取消按钮点击失败', err);
              }
            }}
            className="pointer-events-auto px-4 py-2 rounded-lg bg-slate-100 text-slate-800 hover:bg-slate-200 transition-colors">
            
            取消
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-700 text-white font-medium hover:bg-blue-800 disabled:opacity-50 shadow-sm transition-colors">
            
            <FaSave />
            {editing ? '保存入库' : '提交入库'}
          </button>
        </div>
      </div>
    </form>);

}