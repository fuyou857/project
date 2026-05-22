/**
 * 集成服务 URL 规范化（OCR / 文档转换等共用）
 * - 去掉尾部斜杠
 * - 避免重复拼接 path suffix
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

/** 指定主机名列表下返回同源完整 URL */
export function resolveSameOriginServiceUrl(path: string, hostnames: string[]): string {
  if (typeof window === 'undefined') return '';
  const { hostname, origin, protocol } = window.location;
  if (protocol !== 'http:' && protocol !== 'https:') return '';
  if (hostnames.includes(hostname)) return `${origin}${path}`;
  return '';
}

/** window 全局 → 环境变量 → 默认值 */
export function resolveIntegrationPostUrl(options: {
  sameOriginPath?: string;
  sameOriginHostnames?: string[];
  windowGlobalKey?: string;
  envKeys: string[];
  defaultUrl: string;
  suffix: string;
}): string {
  const {
    sameOriginPath,
    sameOriginHostnames = [],
    windowGlobalKey,
    envKeys,
    defaultUrl,
    suffix,
  } = options;

  if (sameOriginPath && sameOriginHostnames.length > 0) {
    const sameOrigin = resolveSameOriginServiceUrl(sameOriginPath, sameOriginHostnames);
    if (sameOrigin) return sameOrigin;
  }

  if (typeof window !== 'undefined' && windowGlobalKey) {
    const win = window as unknown as Record<string, unknown>;
    const fromWindow = normalizeServiceUrlWithSuffix(String(win[windowGlobalKey] ?? ''), suffix);
    if (fromWindow) return fromWindow;
  }

  if (typeof process !== 'undefined' && process.env) {
    for (const key of envKeys) {
      const raw = process.env[key];
      if (raw) {
        const fromEnv = normalizeServiceUrlWithSuffix(String(raw), suffix);
        if (fromEnv) return fromEnv;
      }
    }
  }

  return defaultUrl;
}
