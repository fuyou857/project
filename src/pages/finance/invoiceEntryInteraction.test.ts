import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  acquireBodyInteractionLock,
  getBodyInteractionLockCountForTests,
  resetBodyInteractionLock,
} from '../../utils/bodyInteractionLock';

/**
 * Scenario: 成本发票录入页同时挂载 InvoiceEntry 与 embedded CostInvoiceList，
 * 用户打开/关闭录入弹窗后，body 交互锁应完全释放，页面可继续响应点击。
 */
describe('invoice entry modal interaction scenario', () => {
  let mockBody: { style: { overflow: string; pointerEvents: string } };

  beforeEach(() => {
    resetBodyInteractionLock();
    mockBody = { style: { overflow: '', pointerEvents: '' } };
    (globalThis as { document?: Document }).document = {
      body: mockBody,
    } as Document;
  });

  afterEach(() => {
    resetBodyInteractionLock();
    delete (globalThis as { document?: Document }).document;
  });

  it('releases interaction after entry modal open then close', () => {
    const releaseEntry = acquireBodyInteractionLock();
    expect(mockBody.style.overflow).toBe('hidden');

    releaseEntry();
    expect(getBodyInteractionLockCountForTests()).toBe(0);
    expect(mockBody.style.overflow).toBe('');
    expect(mockBody.style.pointerEvents).toBe('');
  });

  it('releases interaction when entry modal closes while list detail modal was open', () => {
    const releaseEntry = acquireBodyInteractionLock();
    const releaseList = acquireBodyInteractionLock();

    releaseEntry();
    expect(getBodyInteractionLockCountForTests()).toBe(1);
    expect(mockBody.style.overflow).toBe('hidden');

    releaseList();
    expect(getBodyInteractionLockCountForTests()).toBe(0);
    expect(mockBody.style.overflow).toBe('');
  });

  it('defers modal open so the triggering click does not hit upload controls', async () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback) => {
        cb(0);
        return 0;
      },
    );
    const { deferModalOpen } = await import('../../utils/deferModalOpen');
    let opened = false;

    deferModalOpen(() => {
      opened = true;
    });
    expect(opened).toBe(false);
    await Promise.resolve();
    expect(opened).toBe(true);
    vi.unstubAllGlobals();
  });

  it('covers post-cancel file picker suppress window length', async () => {
    const { FILE_PICKER_SUPPRESS_MS } = await import('../../hooks/useSafeFileInput');
    expect(FILE_PICKER_SUPPRESS_MS).toBeGreaterThanOrEqual(500);
  });

  it('entry workspace cancel stays clickable (no busy lock, pointer-events-auto)', async () => {
    const { readFileSync } = await import('node:fs');
    const { dirname, join } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const dir = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(dir, 'costInvoice/CostInvoiceEntryWorkspace.tsx'), 'utf8');
    const idx = src.lastIndexOf('取消');
    const cancelBtn = src.slice(Math.max(0, idx - 400), idx + 20);
    expect(cancelBtn).toContain('pointer-events-auto');
    expect(cancelBtn).not.toContain('disabled={busy}');
  });

  it('modal overlay does not disable pointer-events on the whole panel (cancel must stay clickable)', async () => {
    const { readFileSync } = await import('node:fs');
    const { dirname, join } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const dir = dirname(fileURLToPath(import.meta.url));
    const overlaySrc = readFileSync(
      join(dir, '../../components/ui/UiModalOverlay.tsx'),
      'utf8',
    );
    expect(overlaySrc).not.toMatch(
      /interactionReady \? '' : 'pointer-events-none'/,
    );
  });

  it('simulates AnimatePresence exit safety reset after modal close', () => {
    const release = acquireBodyInteractionLock();
    release();

    // UiModalOverlay onExitComplete safety net
    resetBodyInteractionLock();

    expect(getBodyInteractionLockCountForTests()).toBe(0);
    expect(mockBody.style.overflow).toBe('');
    expect(mockBody.style.pointerEvents).toBe('');
  });
});
