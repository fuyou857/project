import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const panelSource = readFileSync(join(__dirname, 'InvoicePreviewPanel.tsx'), 'utf8');
const safeInputSource = readFileSync(join(__dirname, '../../../hooks/useSafeFileInput.ts'), 'utf8');

describe('InvoicePreviewPanel upload trigger', () => {
  it('does not use label htmlFor (prevents click-through file picker)', () => {
    expect(panelSource).not.toMatch(/htmlFor\s*=/);
  });

  it('uses useSafeFileInput for guarded programmatic open', () => {
    expect(panelSource).toMatch(/useSafeFileInput/);
    expect(panelSource).toMatch(/onClick=\{openPicker\}/);
    expect(panelSource).toMatch(/fileUploadEnabled/);
  });
});

describe('useSafeFileInput cancel / focus guard', () => {
  it('listens for focus, visibility, cancel and blocks reopen clicks in capture phase', () => {
    expect(safeInputSource).toMatch(/addEventListener\('focus'/);
    expect(safeInputSource).toMatch(/visibilitychange/);
    expect(safeInputSource).toMatch(/addEventListener\('cancel'/);
    expect(safeInputSource).toMatch(/suppressUntilRef/);
    expect(safeInputSource).toMatch(/blockReopenClick/);
    expect(safeInputSource).not.toMatch(/setTimeout\(\(\) => \{\s*if \(disabled/);
  });
});
