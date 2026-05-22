import type { InvoiceOcrPayload } from '../../../services/invoiceOcrService';
import { formatTaxRateForInput } from '../../../services/invoiceOcrService';
import type { CostInvoiceForm, InvoiceOcrFieldKey, OcrUiStatus } from './types';
import { INVOICE_OCR_FIELD_ORDER, matchInvoiceTypeFromLabel } from './types';

export function countFormOcrFields(
  form: CostInvoiceForm,
  ocrFilled: Partial<Record<InvoiceOcrFieldKey, boolean>>,
): { success: number; missing: number } {
  let success = 0;
  for (const key of INVOICE_OCR_FIELD_ORDER) {
    if (ocrFilled[key]) success++;
  }
  return { success, missing: INVOICE_OCR_FIELD_ORDER.length - success };
}

export function applyOcrPayloadToForm(
  prev: CostInvoiceForm,
  data: InvoiceOcrPayload,
  manualKeys: Set<InvoiceOcrFieldKey>,
): { next: CostInvoiceForm; filled: Partial<Record<InvoiceOcrFieldKey, boolean>> } {
  const filled: Partial<Record<InvoiceOcrFieldKey, boolean>> = {};
  const next = { ...prev };

  const setStr = (key: InvoiceOcrFieldKey, val: string | null | undefined) => {
    if (manualKeys.has(key)) return;
    if (val === null || val === undefined || !String(val).trim()) return;
    const s = String(val).trim();
    (next as Record<string, unknown>)[key] = s;
    filled[key] = true;
  };

  const setNum = (key: InvoiceOcrFieldKey, val: number | null | undefined, formKey?: keyof CostInvoiceForm) => {
    if (manualKeys.has(key)) return;
    if (val === null || val === undefined || Number.isNaN(val)) return;
    const fk = (formKey || key) as keyof CostInvoiceForm;
    (next as Record<string, unknown>)[fk as string] = val;
    filled[key] = true;
  };

  setStr('invoice_code', data.invoice_code);
  
  // 处理发票号码：仅保留最后6位数字，不足补零，过滤非数字
  if (!manualKeys.has('invoice_number') && data.invoice_number) {
    const rawNo = String(data.invoice_number).trim();
    const digitsOnly = rawNo.replace(/\D/g, '');
    let finalNo = digitsOnly.slice(-6);
    if (finalNo.length > 0 && finalNo.length < 6) {
      finalNo = finalNo.padStart(6, '0');
    }
    if (finalNo) {
      next.invoice_number = finalNo;
      filled.invoice_number = true;
    }
  }

  setStr('invoice_date', data.invoice_date);
  setStr('invoice_title', data.invoice_title);
  setStr('consumption_type', data.consumption_type);
  setStr('buyer_name', data.buyer_name);
  setStr('buyer_address_phone', data.buyer_address_phone);
  setStr('buyer_bank', data.buyer_bank);
  setStr('goods_name', data.goods_name);
  if (!manualKeys.has('tax_rate') && data.tax_rate != null && !Number.isNaN(data.tax_rate)) {
    next.tax_rate = data.tax_rate;
    filled.tax_rate = true;
  }
  setStr('unit_price', data.unit_price);
  setStr('unit', data.unit);
  setStr('quantity', data.quantity);
  setStr('line_amount', data.line_amount);
  setStr('line_tax', data.line_tax);
  setStr('subtotal_amount', data.subtotal_amount);
  setStr('total_amount_excl', data.total_amount_excl);
  setStr('total_tax', data.total_tax);
  setStr('amount_in_words', data.amount_in_words);
  setStr('seller_name', data.seller_name);
  setStr('seller_address_phone', data.seller_address_phone);
  setStr('seller_bank', data.seller_bank);
  setStr('service_category', data.service_category ?? data.remark);

  if (!manualKeys.has('invoice_type')) {
    const matched = matchInvoiceTypeFromLabel(data.ocr_invoice_type_label);
    if (matched) {
      next.invoice_type = matched;
      filled.invoice_type = true;
    }
  }
  if (data.ocr_invoice_type_label?.trim()) {
    next.ocr_invoice_type_label = data.ocr_invoice_type_label.trim();
  }

  if (data.invoice_amount != null && !Number.isNaN(data.invoice_amount)) {
    next.invoice_amount = data.invoice_amount;
    if (!manualKeys.has('invoice_amount')) {
      filled.invoice_amount = true;
    }
  }
  setNum('total_amount_excl', data.amount_excluding_tax, 'amount_excluding_tax');
  setNum('total_tax', data.tax_amount, 'tax_amount');

  if (data.seller_tax_id?.trim()) {
    next.seller_tax_id = data.seller_tax_id.trim();
  }

  if (data.remark && !manualKeys.has('service_category')) {
    next.remark = data.remark;
  }

  return { next, filled };
}

export function taxRateDisplay(form: CostInvoiceForm): string {
  return formatTaxRateForInput(form.tax_rate);
}

/** 入库时写入 cost_invoices.ocr_status（与 InvoiceEntry 原逻辑一致） */
export function resolvePersistOcrStatus(
  uiStatus: OcrUiStatus,
  hasAttachments: boolean,
): OcrUiStatus | 'idle' {
  if (!hasAttachments) return 'idle';
  if (uiStatus === 'pending') return 'idle';
  if (uiStatus === 'idle') return 'success';
  return uiStatus;
}
