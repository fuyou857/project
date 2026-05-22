import { useCallback, useState, useMemo } from 'react';
import { supabase } from '../../../supabase/client';
import { 
  initialCostInvoiceForm, 
  type CostInvoiceForm, 
  type OcrUiStatus,
  type InvoiceOcrFieldKey,
  type InvoiceAttachmentItem,
  packExtendedRemark
} from '../costInvoice/types';
import { useInvoiceOcrForm } from '../../../hooks/useInvoiceOcrForm';
import { resolveInvoiceFileMime, storageExtensionForFile } from '../costInvoice/invoiceFileUtils';
import { COST_INVOICE_MAX_BYTES, unpackExtendedRemark } from '../costInvoice/types';
import { addLog, logAction, logModule } from '../../../services/logService';

/**
 * V2 version of the Cost Invoice Form Hook.
 * More robust state management and clearer separation of concerns.
 */
export function useCostInvoiceForm_v2(options: {
  onSuccess?: () => void;
  onOcrComplete?: (form: CostInvoiceForm, status: OcrUiStatus) => void;
}) {
  const [form, setForm] = useState<CostInvoiceForm>(initialCostInvoiceForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Initialize OCR hook
  const ocr = useInvoiceOcrForm({ 
    setForm, 
    onOcrComplete: options.onOcrComplete 
  });

  const resetForm = useCallback(() => {
    setForm(initialCostInvoiceForm());
    setEditingId(null);
    setUploading(false);
    setSubmitting(false);
    ocr.resetOcrMeta();
  }, [ocr]);

  const initFromInvoice = useCallback((invoice: any) => {
    // Mapping logic from existing openEditModal
    const urls = invoice.attachment_urls || [];
    const ext = unpackExtendedRemark(invoice.remark);
    setEditingId(invoice.id);
    setForm({
      ...initialCostInvoiceForm(),
      ...ext,
      project_id: invoice.project_id,
      supplier_id: invoice.supplier_id,
      invoice_type: invoice.invoice_type || '普票',
      invoice_number: invoice.invoice_number,
      invoice_amount: invoice.invoice_amount,
      deductible_tax: invoice.deductible_tax || undefined,
      invoice_date: invoice.invoice_date || new Date().toISOString().split('T')[0],
      attachment_url: invoice.attachment_url || urls[0]?.url || '',
      attachment_urls: urls.length ? urls : (invoice.attachment_url ? [{ url: invoice.attachment_url, filename: invoice.attachment_url.split('/').pop() || '附件', mime: '' }] : []),
      invoice_code: invoice.invoice_code || '',
      amount_excluding_tax: invoice.amount_excluding_tax ?? undefined,
      tax_rate: invoice.tax_rate ?? undefined,
      tax_amount: invoice.tax_amount ?? undefined,
      goods_name: invoice.goods_name || '',
      seller_name: invoice.seller_name || '',
      seller_tax_id: invoice.seller_tax_id || '',
      remark: ext.remark ?? invoice.remark ?? '',
      ocr_invoice_type_label: invoice.ocr_invoice_type_label || ''
    });
    ocr.setOcrUiStatus((invoice.ocr_status as OcrUiStatus) || 'idle');
  }, [ocr]);

  const validate = useCallback(() => {
    const missing: string[] = [];
    if (!form.project_id) missing.push('项目名称');
    if (!form.supplier_id) missing.push('开票单位');
    if (!form.invoice_number?.trim()) missing.push('发票编号');
    if (!form.invoice_amount || form.invoice_amount <= 0) missing.push('开票金额（价税合计）');
    if (!form.invoice_date) missing.push('开票日期');
    return missing;
  }, [form]);

  const uploadFile = useCallback(async (file: File): Promise<InvoiceAttachmentItem> => {
    if (file.size > COST_INVOICE_MAX_BYTES) throw new Error('文件大小不能超过12MB');
    
    const contentType = resolveInvoiceFileMime(file);
    if (!contentType) {
      throw new Error(`不支持的文件类型: ${file.type || '未知'}`);
    }

    const storageExt = storageExtensionForFile(file);
    const path = `invoices/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${storageExt}`;

    const { error } = await supabase.storage.from('files').upload(path, file, {
      contentType,
      cacheControl: '3600',
      upsert: false
    });

    if (error) throw new Error(`存储上传失败: ${error.message}`);

    const { data: { publicUrl } } = supabase.storage.from('files').getPublicUrl(path);
    return { url: publicUrl, filename: file.name, mime: contentType };
  }, []);

  return {
    form,
    setForm,
    editingId,
    uploading,
    setUploading,
    submitting,
    setSubmitting,
    ocr,
    resetForm,
    initFromInvoice,
    validate,
    uploadFile
  };
}
