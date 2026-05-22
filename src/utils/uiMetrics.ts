/**
 * 轻量 UI 埋点：用于改版前后对比（打开次数、提交次数等）。
 * 数据存 sessionStorage，单会话约 200 条环形缓冲；开发环境同步 console.debug。
 * 验收时在控制台执行：`__CIOND_EXPORT_UI_METRICS__()` 复制 JSON。
 */

const STORAGE_KEY = 'ciond-ui-metrics';
const MAX_EVENTS = 200;

export type UiMetricEvent = {
  t: number;
  name: string;
  payload?: Record<string, string | number | boolean | null | undefined>;
};

function loadEvents(): UiMetricEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as UiMetricEvent[]) : [];
  } catch {
    return [];
  }
}

function saveEvents(list: UiMetricEvent[]) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* quota / private mode */
  }
}

/** 记录一条事件（幂等安全，失败静默） */
export function recordUiMetric(name: string, payload?: Record<string, string | number | boolean | null | undefined>) {
  if (typeof window === 'undefined') return;
  const list = loadEvents();
  list.push({ t: Date.now(), name, payload });
  while (list.length > MAX_EVENTS) list.shift();
  saveEvents(list);
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.debug('[ciond-ui-metric]', name, payload ?? {});
  }
}

/** 按 name 聚合次数，便于验收对比 */
export function getUiMetricsSummary(): Record<string, number> {
  const list = loadEvents();
  const out: Record<string, number> = {};
  for (const e of list) {
    out[e.name] = (out[e.name] ?? 0) + 1;
  }
  return out;
}

export function getUiMetricsEvents(): UiMetricEvent[] {
  return loadEvents();
}

/** 导出 JSON 字符串（写入剪贴板，失败则仅返回字符串） */
export function exportUiMetricsJson(): string {
  const payload = {
    exportedAt: new Date().toISOString(),
    summary: getUiMetricsSummary(),
    events: loadEvents(),
  };
  const json = JSON.stringify(payload, null, 2);
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(json).catch(() => undefined);
  }
  return json;
}

declare global {
  interface Window {
    __CIOND_EXPORT_UI_METRICS__?: () => string;
  }
}

if (typeof window !== 'undefined') {
  window.__CIOND_EXPORT_UI_METRICS__ = exportUiMetricsJson;
}
