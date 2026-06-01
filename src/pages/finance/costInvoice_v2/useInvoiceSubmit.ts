import { useCallback } from 'react';
import { supabase } from '../../../supabase/client';
import {
  packExtendedRemark,
  type CostInvoiceForm,
  type OcrUiStatus
} from '../costInvoice/types';
import {
  invoicePaidAmount,
  costInvoicePaymentWritePayload
} from '../../../utils/costInvoiceAmounts';
import { resolvePersistOcrStatus } from '../costInvoice/applyOcrToForm';
import { addLog, logAction, logModule } from '../../../services/logService';
import { getStoredUser } from '../../../utils/sessionUser';

export function useInvoiceSubmit(
  form: CostInvoiceForm,
  editingId: string | null,
  ocrUiStatus: OcrUiStatus,
  validate: () => string[],
  onSuccess: () => void
) {
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    const errors = validate();
    if (errors.length > 0) {
      alert(`请补全必填项：${errors.join('、')}`);
      return;
    }

    const persistOcrStatus = resolvePersistOcrStatus(ocrUiStatus, form.attachment_urls.length > 0);
    const baseInvoiceData: any = {
      project_id: form.project_id,
      supplier_id: form.supplier_id,
      invoice_type: form.invoice_type,
      invoice_number: form.invoice_number,
      invoice_amount: form.invoice_amount,
      deductible_tax: form.invoice_type === '专票' ? form.deductible_tax ?? 0 : null,
      invoice_date: form.invoice_date,
      attachment_urls: form.attachment_urls.length > 0 ? form.attachment_urls : null,
      invoice_code: form.invoice_code.trim() || null,
      amount_excluding_tax: form.amount_excluding_tax ?? null,
      tax_rate: form.tax_rate ?? null,
      tax_amount: form.tax_amount ?? null,
      goods_name: form.goods_name.trim() || null,
      seller_name: form.seller_name.trim() || null,
      seller_tax_id: form.seller_tax_id.trim() || null,
      remark: packExtendedRemark(form) || null,
      ocr_invoice_type_label: form.ocr_invoice_type_label.trim() || null,
      ocr_status: form.attachment_urls.length > 0 ? persistOcrStatus : 'idle'
    };

    try {
      if (editingId) {
        const { data: original } = await supabase.from('cost_invoices').select('*').eq('id', editingId).single();
        const paid = invoicePaidAmount(original);
        const payment = costInvoicePaymentWritePayload(form.invoice_amount ?? 0, paid);
        const { error } = await supabase.from('cost_invoices').update({ ...baseInvoiceData, ...payment }).eq('id', editingId);
        
        if (error) throw error;
        await addLog(logModule.INVOICE, logAction.UPDATE, `更新成本发票：${form.invoice_number}`, { id: editingId, ...baseInvoiceData });
      } else {
        const user = getStoredUser();
        const payment = costInvoicePaymentWritePayload(form.invoice_amount ?? 0, 0);
        const { error, data: inserted } = await supabase.from('cost_invoices').insert({
          ...baseInvoiceData,
          ...payment,
          created_by: user.id || null
        }).select().single();
        
        if (error) throw error;
        await addLog(logModule.INVOICE, logAction.CREATE, `录入成本发票：${form.invoice_number}`, { id: inserted?.id, ...baseInvoiceData });
      }

      if (form.project_id) {
        localStorage.setItem('ciond_cost_invoice_last_project', form.project_id);
      }

      alert('保存成功');
      onSuccess();
    } catch (err: any) {
      alert('提交失败: ' + err.message);
      throw err;
    }
  }, [form, editingId, ocrUiStatus, validate, onSuccess]);

  return { handleSubmit };
}
