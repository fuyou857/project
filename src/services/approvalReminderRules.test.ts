import { describe, expect, it } from 'vitest';
import { canSendReminder } from './approvalReminderRules';

describe('canSendReminder', () => {
  const approvalId = 'a1';
  const requesterId = 'u1';

  it('allows first reminder', () => {
    expect(canSendReminder(approvalId, requesterId, []).ok).toBe(true);
  });

  it('blocks when daily max reached', () => {
    const today = new Date().toISOString();
    const rows = [
      { approval_id: 'x', created_at: today },
      { approval_id: 'y', created_at: today },
      { approval_id: 'z', created_at: today },
    ];
    const r = canSendReminder(approvalId, requesterId, rows);
    expect(r.ok).toBe(false);
  });

  it('blocks within cooldown for same approval', () => {
    const recent = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const r = canSendReminder(approvalId, requesterId, [
      { approval_id: approvalId, created_at: recent },
    ]);
    expect(r.ok).toBe(false);
  });
});
