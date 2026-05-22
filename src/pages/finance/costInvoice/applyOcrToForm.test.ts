import { describe, expect, it } from 'vitest';
import { resolvePersistOcrStatus } from './applyOcrToForm';

describe('resolvePersistOcrStatus', () => {
  it('returns idle when no attachments', () => {
    expect(resolvePersistOcrStatus('success', false)).toBe('idle');
    expect(resolvePersistOcrStatus('pending', false)).toBe('idle');
  });

  it('maps pending to idle when saving with attachments', () => {
    expect(resolvePersistOcrStatus('pending', true)).toBe('idle');
  });

  it('maps idle ui to success when attachments exist', () => {
    expect(resolvePersistOcrStatus('idle', true)).toBe('success');
  });

  it('preserves terminal ocr statuses', () => {
    expect(resolvePersistOcrStatus('success', true)).toBe('success');
    expect(resolvePersistOcrStatus('failed', true)).toBe('failed');
    expect(resolvePersistOcrStatus('partial', true)).toBe('partial');
  });
});
