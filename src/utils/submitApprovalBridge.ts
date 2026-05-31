import type { SubmitApprovalOpenConfig } from '../services/approvalApproverService';

export type SubmitApprovalOpener = (config: SubmitApprovalOpenConfig) => Promise<boolean>;

let opener: SubmitApprovalOpener | null = null;

export function bindSubmitApprovalOpener(fn: SubmitApprovalOpener | null): void {
  opener = fn;
}

export function isSubmitApprovalModalAvailable(): boolean {
  return opener !== null;
}

/** 等待 Layout 注册完成（最多约 200ms） */
export async function openSubmitApprovalWithRetry(
  config: SubmitApprovalOpenConfig,
  maxAttempts = 8,
): Promise<boolean | null> {
  for (let i = 0; i < maxAttempts; i++) {
    if (opener) return opener(config);
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  }
  return null;
}
