import type { InvoiceAttachmentItem } from './types';
import { COST_INVOICE_MAX_BYTES } from './types';
import { validateInvoiceImageFile } from './invoiceImageUtils';

type OcrLogLevel = 'info' | 'success' | 'error';

export type ProcessInvoiceFilesForOcrParams = {
  fileList: File[];
  existingAttachments: InvoiceAttachmentItem[];
  uploadSingleFile: (file: File) => Promise<InvoiceAttachmentItem>;
  runOcrPipeline: (urls: string[], files: File[]) => Promise<void>;
  onAttachmentsMerged: (next: InvoiceAttachmentItem[]) => void;
  onActiveAttachmentIndex: (index: number) => void;
  pushLog: (level: OcrLogLevel, message: string) => void;
};

/**
 * 上传发票附件并触发 OCR（CostInvoiceEntryWorkspace / InvoiceEntry 共用逻辑）
 */
export async function processInvoiceFilesForOcr({
  fileList,
  existingAttachments,
  uploadSingleFile,
  runOcrPipeline,
  onAttachmentsMerged,
  onActiveAttachmentIndex,
  pushLog,
}: ProcessInvoiceFilesForOcrParams): Promise<void> {
  if (!fileList.length) return;
  for (const f of fileList) {
    const err = validateInvoiceImageFile(f);
    if (err) {
      alert(err);
      return;
    }
    if (f.size > COST_INVOICE_MAX_BYTES) {
      alert('单张发票文件不能超过 12MB');
      return;
    }
  }
  pushLog('info', `上传 ${fileList.length} 个发票文件`);
  const uploaded = await Promise.all(fileList.map((f) => uploadSingleFile(f)));
  const nextAttachments = [...existingAttachments, ...uploaded];
  onAttachmentsMerged(nextAttachments);
  onActiveAttachmentIndex(Math.max(0, nextAttachments.length - fileList.length));
  const urls = nextAttachments.map((a) => a.url).filter(Boolean);
  await runOcrPipeline(urls, fileList);
}
