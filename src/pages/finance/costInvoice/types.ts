/** 成本发票智能识别 — 24 项固定提取顺序（不可调整） */
export const INVOICE_OCR_FIELD_ORDER = [
  'invoice_code',
  'invoice_number',
  'invoice_date',
  'invoice_type',
  'invoice_title',
  'consumption_type',
  'buyer_name',
  'buyer_address_phone',
  'buyer_bank',
  'goods_name',
  'tax_rate',
  'unit_price',
  'unit',
  'quantity',
  'line_amount',
  'line_tax',
  'subtotal_amount',
  'total_amount_excl',
  'total_tax',
  'invoice_amount',
  'amount_in_words',
  'seller_name',
  'seller_address_phone',
  'seller_bank',
  'service_category',
] as const;

export type InvoiceOcrFieldKey = (typeof INVOICE_OCR_FIELD_ORDER)[number];

export const INVOICE_OCR_FIELD_LABELS: Record<InvoiceOcrFieldKey, string> = {
  invoice_code: '发票代码',
  invoice_number: '发票号码（后6位）',
  invoice_date: '开票日期',
  invoice_type: '发票类型',
  invoice_title: '发票名称',
  consumption_type: '发票消费类型',
  buyer_name: '购买方名称',
  buyer_address_phone: '购买方地址、电话',
  buyer_bank: '购买方开户行及账号',
  goods_name: '货物或应税劳务、服务名称',
  tax_rate: '税率',
  unit_price: '单价',
  unit: '单位',
  quantity: '数量',
  line_amount: '单行金额',
  line_tax: '单行税额',
  subtotal_amount: '小写总金额',
  total_amount_excl: '合计金额',
  total_tax: '合计税额',
  invoice_amount: '价税合计（小写）',
  amount_in_words: '价税合计（大写）',
  seller_name: '销售方名称',
  seller_address_phone: '销售方地址、电话',
  seller_bank: '销售方开户行及账号',
  service_category: '服务类目 / 备注信息',
};

export type OcrUiStatus = 'idle' | 'pending' | 'success' | 'partial' | 'failed';

export type OcrLogEntry = {
  id: string;
  at: string;
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
};

export type InvoiceAttachmentItem = { url: string; filename: string; mime: string };

export type CostInvoiceForm = {
  project_id: string;
  supplier_id: string;
  invoice_type: string;
  invoice_number: string;
  invoice_amount: number | undefined;
  deductible_tax: number | undefined;
  invoice_date: string;
  attachment_url: string;
  attachment_urls: { url: string; filename: string; mime: string }[];
  invoice_code: string;
  amount_excluding_tax: number | undefined;
  tax_rate: number | undefined;
  tax_amount: number | undefined;
  goods_name: string;
  seller_name: string;
  seller_tax_id: string;
  remark: string;
  ocr_invoice_type_label: string;
  invoice_title: string;
  consumption_type: string;
  buyer_name: string;
  buyer_address_phone: string;
  buyer_bank: string;
  unit_price: string;
  unit: string;
  quantity: string;
  line_amount: string;
  line_tax: string;
  subtotal_amount: string;
  total_amount_excl: string;
  total_tax: string;
  amount_in_words: string;
  seller_address_phone: string;
  seller_bank: string;
  service_category: string;
};

export const INVOICE_TYPES = ['普票', '专票', '全电票', '其他'] as const;

export const COST_INVOICE_FILE_INPUT_ID = 'cost-invoice-entry-file-input';
export const COST_INVOICE_MAX_BYTES = 12 * 1024 * 1024;
export { COST_INVOICE_ACCEPT } from './invoiceFileUtils';

export function todayISO() {
  return new Date().toISOString().split('T')[0];
}

export function initialCostInvoiceForm(): CostInvoiceForm {
  return {
    project_id: '',
    supplier_id: '',
    invoice_type: '普票',
    invoice_number: '',
    invoice_amount: undefined,
    deductible_tax: undefined,
    invoice_date: todayISO(),
    attachment_url: '',
    attachment_urls: [],
    invoice_code: '',
    amount_excluding_tax: undefined,
    tax_rate: undefined,
    tax_amount: undefined,
    goods_name: '',
    seller_name: '',
    seller_tax_id: '',
    remark: '',
    ocr_invoice_type_label: '',
    invoice_title: '',
    consumption_type: '',
    buyer_name: '',
    buyer_address_phone: '',
    buyer_bank: '',
    unit_price: '',
    unit: '',
    quantity: '',
    line_amount: '',
    line_tax: '',
    subtotal_amount: '',
    total_amount_excl: '',
    total_tax: '',
    amount_in_words: '',
    seller_address_phone: '',
    seller_bank: '',
    service_category: '',
  };
}

/** 将扩展字段序列化进 remark，便于入库后追溯（不破坏用户可见备注） */
export function packExtendedRemark(form: CostInvoiceForm): string {
  const userRemark = form.remark.trim();
  const ext = {
    invoice_title: form.invoice_title,
    consumption_type: form.consumption_type,
    buyer_name: form.buyer_name,
    buyer_address_phone: form.buyer_address_phone,
    buyer_bank: form.buyer_bank,
    unit_price: form.unit_price,
    unit: form.unit,
    quantity: form.quantity,
    line_amount: form.line_amount,
    line_tax: form.line_tax,
    subtotal_amount: form.subtotal_amount,
    total_amount_excl: form.total_amount_excl,
    total_tax: form.total_tax,
    amount_in_words: form.amount_in_words,
    seller_address_phone: form.seller_address_phone,
    seller_bank: form.seller_bank,
    service_category: form.service_category,
  };
  const hasExt = Object.values(ext).some((v) => String(v || '').trim());
  if (!hasExt) return userRemark;
  const block = `<!--CIOND_OCR_EXT:${JSON.stringify(ext)}-->`;
  return userRemark ? `${userRemark}\n${block}` : block;
}

export function unpackExtendedRemark(remark: string | null | undefined): Partial<CostInvoiceForm> {
  if (!remark) return { remark: '' };
  const m = remark.match(/<!--CIOND_OCR_EXT:([\s\S]*?)-->/);
  let userRemark = remark.replace(/<!--CIOND_OCR_EXT:[\s\S]*?-->/g, '').trim();
  if (!m) return { remark: userRemark };
  try {
    const ext = JSON.parse(m[1]) as Record<string, string>;
    return {
      remark: userRemark,
      invoice_title: ext.invoice_title || '',
      consumption_type: ext.consumption_type || '',
      buyer_name: ext.buyer_name || '',
      buyer_address_phone: ext.buyer_address_phone || '',
      buyer_bank: ext.buyer_bank || '',
      unit_price: ext.unit_price || '',
      unit: ext.unit || '',
      quantity: ext.quantity || '',
      line_amount: ext.line_amount || '',
      line_tax: ext.line_tax || '',
      subtotal_amount: ext.subtotal_amount || '',
      total_amount_excl: ext.total_amount_excl || '',
      total_tax: ext.total_tax || '',
      amount_in_words: ext.amount_in_words || '',
      seller_address_phone: ext.seller_address_phone || '',
      seller_bank: ext.seller_bank || '',
      service_category: ext.service_category || '',
    };
  } catch {
    return { remark: userRemark };
  }
}

export function matchInvoiceTypeFromLabel(label: string | null | undefined): string | null {
  if (!label?.trim()) return null;
  const t = label.trim();
  if (/专用|专票/.test(t)) return '专票';
  if (/全电|数电|电子发票/.test(t)) return '全电票';
  if (/普通|普票/.test(t)) return '普票';
  return null;
}
