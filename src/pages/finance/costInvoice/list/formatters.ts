import { INVOICE_TYPES } from '../types';

/** 票据类型展示简称 */
export function formatInvoiceTypeLabel(type: string | null | undefined, ocrLabel?: string | null): string {
  const t = (type || '').trim();
  if (t === '专票' || /专用/.test(ocrLabel || '')) return '专票';
  if (t === '普票' || /普通/.test(ocrLabel || '')) return '普票';
  if (t === '全电票') return '全电票';
  if (t === '其他') return '其他';
  if (t) return t;
  return '-';
}

export const INVOICE_TYPE_FILTER_OPTIONS = [
  { value: '', label: '全部类型' },
  ...INVOICE_TYPES.map((t) => ({ value: t, label: t })),
];

/** YYYY-MM-DD */
export function formatDateDisplay(value: string | null | undefined): string {
  if (!value) return '-';
  const d = value.split('T')[0];
  return d || '-';
}

/** 12,345.67（无货币符号，用于表格规范） */
export function formatAmount(value: number | null | undefined): string {
  const n = Number(value);
  if (Number.isNaN(n)) return '-';
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatAmountWithSymbol(value: number | null | undefined): string {
  const s = formatAmount(value);
  return s === '-' ? s : `¥${s}`;
}
