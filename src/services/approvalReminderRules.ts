import {
  REMINDER_COOLDOWN_HOURS,
  REMINDER_DAILY_MAX,
} from '../constants/approvalPhase3';

export type ReminderRow = { approval_id: string; created_at: string };

export function canSendReminder(
  approvalId: string,
  requesterId: string,
  rows: ReminderRow[],
  now = Date.now(),
): { ok: true } | { ok: false; message: string } {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayMs = todayStart.getTime();

  const todayByUser = rows.filter(
    (r) => r.created_at && new Date(r.created_at).getTime() >= todayMs,
  );
  if (todayByUser.length >= REMINDER_DAILY_MAX) {
    return { ok: false, message: `今日催办已达上限（${REMINDER_DAILY_MAX} 次）` };
  }

  const forApproval = rows
    .filter((r) => r.approval_id === approvalId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  if (forApproval.length > 0) {
    const lastMs = new Date(forApproval[0].created_at).getTime();
    const cooldownMs = REMINDER_COOLDOWN_HOURS * 60 * 60 * 1000;
    if (now - lastMs < cooldownMs) {
      return {
        ok: false,
        message: `该审批 ${REMINDER_COOLDOWN_HOURS} 小时内已催办，请稍后再试`,
      };
    }
  }

  return { ok: true };
}
