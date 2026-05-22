/** 成本发票附件：JPG / PNG / PDF / OFD */
export const COST_INVOICE_ALLOWED_MIMES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/pdf',
  'application/ofd',
  'application/vnd.ofd',
  'application/x-ofd',
] as const;

export const COST_INVOICE_ACCEPT =
  '.jpg,.jpeg,.png,.pdf,.ofd,image/jpeg,image/jpg,image/png,application/pdf,application/ofd,application/vnd.ofd';

const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  pdf: 'application/pdf',
  ofd: 'application/ofd',
};

export function invoiceFileExtension(name: string): string {
  return name.split('.').pop()?.toLowerCase() || '';
}

export function resolveInvoiceFileMime(file: File): string | null {
  const ext = invoiceFileExtension(file.name);
  const raw = (file.type || '').trim().toLowerCase();
  if (raw && (COST_INVOICE_ALLOWED_MIMES as readonly string[]).includes(raw)) return raw;
  if (ext && EXT_TO_MIME[ext]) return EXT_TO_MIME[ext];
  return null;
}

export function validateInvoiceAttachmentFile(file: File): string | null {
  const mime = resolveInvoiceFileMime(file);
  if (!mime) {
    return '仅支持 JPG / PNG / PDF / OFD 发票文件';
  }
  if (file.size < 64) {
    return '文件过小或为空，请重新选择';
  }
  return null;
}

export function isInvoiceImageMime(mime: string, url: string): boolean {
  if (mime.startsWith('image/')) return true;
  const ext = invoiceFileExtension(url.split('?')[0] || '');
  return ['jpg', 'jpeg', 'png', 'webp'].includes(ext);
}

export function isInvoicePdfMime(mime: string, url: string): boolean {
  if (mime === 'application/pdf') return true;
  return invoiceFileExtension(url.split('?')[0] || '') === 'pdf';
}

export function isInvoiceOfdMime(mime: string, url: string): boolean {
  const m = mime.toLowerCase();
  if (m === 'application/ofd' || m === 'application/vnd.ofd' || m === 'application/x-ofd') return true;
  return invoiceFileExtension(url.split('?')[0] || '') === 'ofd';
}

export function storageExtensionForFile(file: File): string {
  const ext = invoiceFileExtension(file.name);
  if (ext === 'jpeg') return 'jpg';
  if (['jpg', 'png', 'pdf', 'ofd'].includes(ext)) return ext;
  const mime = resolveInvoiceFileMime(file);
  if (mime === 'image/png') return 'png';
  if (mime === 'application/pdf') return 'pdf';
  if (mime?.includes('ofd')) return 'ofd';
  return 'jpg';
}
