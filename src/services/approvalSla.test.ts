import { describe, expect, it } from 'vitest';
import { slaStatus, waitHoursSince } from './approvalSla';

describe('approvalSla', () => {
  it('waitHoursSince computes hours', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(waitHoursSince(twoHoursAgo)).toBeGreaterThanOrEqual(1.9);
  });

  it('slaStatus overdue when past sla', () => {
    expect(slaStatus(50, 48, 24)).toBe('overdue');
  });

  it('slaStatus warning before deadline', () => {
    expect(slaStatus(30, 48, 24)).toBe('warning');
  });

  it('slaStatus ok when within window', () => {
    expect(slaStatus(10, 48, 24)).toBe('ok');
  });
});
