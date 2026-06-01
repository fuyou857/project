import type { CostInvoiceForm, InvoiceAttachmentItem, OcrUiStatus } from '../costInvoice/types';

export type SupplierSyncStatus = 'matched' | 'created' | 'warning' | 'error' | 'noop';

export interface SupplierSyncResult {
  status: SupplierSyncStatus;
  message?: string;
  supplierId?: string;
}

export interface InvoiceOcrController {
  ocrUiStatus: OcrUiStatus;
  ocrFilled: Record<string, boolean>;
  progress: number;
  progressLabel: string;
  resetOcrMeta: () => void;
  pushLog: (message: string) => void;
  touchManual: (key: string) => void;
  runOcrPipeline: (attachments: InvoiceAttachmentItem[], existingForm: CostInvoiceForm) => Promise<void>;
}

export interface SupplierSyncWarnings {
  messages: string[];
  hasWarnings: boolean;
}

export interface InvoiceStats {
  success: number;
  missing: number;
  total: number;
}
