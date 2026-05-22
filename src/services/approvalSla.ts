export type SlaConfigRow = {
  source_type: string;
  step_order: number;
  sla_hours: number;
  remind_before_hours: number;
};

export function buildSlaMap(rows: SlaConfigRow[]): Map<string, SlaConfigRow> {
  const map = new Map<string, SlaConfigRow>();
  for (const r of rows) {
    map.set(`${r.source_type}:${r.step_order}`, r);
  }
  return map;
}

export function waitHoursSince(iso: string, now = Date.now()): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, (now - t) / (60 * 60 * 1000));
}

export function slaStatus(
  waitHours: number,
  slaHours: number,
  remindBeforeHours: number,
): 'ok' | 'warning' | 'overdue' {
  if (waitHours >= slaHours) return 'overdue';
  if (waitHours >= slaHours - remindBeforeHours) return 'warning';
  return 'ok';
}
