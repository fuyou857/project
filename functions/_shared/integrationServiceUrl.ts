/**
 * 集成服务 URL 规范化（与前端 src/utils/integrationServiceUrl.ts 逻辑一致，供 Edge Functions 使用）
 */
export function normalizeServiceUrlWithSuffix(raw: string, suffix: string): string {
  const base = String(raw || '')
    .trim()
    .replace(/\/+$/, '');
  if (!base) return '';
  const lowerSuffix = suffix.toLowerCase();
  let u = base;
  while (u.toLowerCase().endsWith(lowerSuffix + lowerSuffix)) {
    u = u.slice(0, -suffix.length).replace(/\/+$/, '');
  }
  if (u.toLowerCase().endsWith(lowerSuffix)) return u;
  return `${u}${suffix}`;
}

/** 去掉尾部斜杠后确保带 path suffix（OCR 上游等） */
export function resolveUpstreamBaseWithSuffix(
  raw: string | null | undefined,
  suffix: string,
): string | null {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  return normalizeServiceUrlWithSuffix(trimmed, suffix);
}
