import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, 'UiModalOverlay.tsx'), 'utf8');

describe('UiModalOverlay interaction', () => {
  it('portals to document.body to avoid parent overflow trapping', () => {
    expect(source).toMatch(/createPortal/);
    expect(source).toMatch(/document\.body/);
  });

  it('supports ESC, backdrop guard, and does not block panel close controls', () => {
    expect(source).toMatch(/useModalInteractionGuard/);
    expect(source).toMatch(/Escape/);
    expect(source).toMatch(/handleBackdropClose/);
    expect(source).toMatch(/absolute right-0 bottom-0 w-full h-full bg-black\/50/);
    // 遮罩在 interactionReady 前拦截关闭；面板本身不禁用 pointer-events，避免「取消」无效
    expect(source).not.toMatch(/panelClassName\} \$\{\s*interactionReady \? '' : 'pointer-events-none'/);
  });

  it('wraps onClose with error handling', () => {
    expect(source).toMatch(/safeInvokeClose/);
    expect(source).toMatch(/resetBodyInteractionLock/);
  });

  it('does not keep overlay mounted when open is false (no exiting latch)', () => {
    expect(source).not.toMatch(/const visible = open \|\| exiting/);
    expect(source).not.toMatch(/setExiting\(true\)/);
    expect(source).toMatch(/\{open \? \(/);
  });
});
