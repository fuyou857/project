import { describe, expect, it } from 'vitest';
import { formatMoneyCny, formatDateTimeZh } from './formatters';

describe('formatMoneyCny', () => {
  it('formats zero and null', () => {
    expect(formatMoneyCny(0)).toMatch(/^¥/);
    expect(formatMoneyCny(null)).toContain('0.00');
  });

  it('uses zh-CN grouping', () => {
    expect(formatMoneyCny(1234567.8)).toMatch(/1/);
    expect(formatMoneyCny(1234567.8)).toContain('.');
  });
});

describe('formatDateTimeZh', () => {
  it('returns dash for empty', () => {
    expect(formatDateTimeZh('')).toBe('-');
    expect(formatDateTimeZh(undefined)).toBe('-');
  });

  it('localizes ISO string', () => {
    const s = formatDateTimeZh('2026-05-11T08:30:00.000Z');
    expect(s).not.toBe('-');
    expect(s.length).toBeGreaterThan(8);
  });
});
