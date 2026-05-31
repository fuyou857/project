/** Nginx 502 等返回整页 HTML 时压缩为可读说明（文档转换 / Edge / OCR 等复用） */
export function compactHtmlGatewayErrorMessage(text: string): string {
  const t = (text || '').trim();
  if (!t) return '';
  const probe = t.slice(0, 600).toLowerCase();
  const looksHtml =
    probe.includes('<html') ||
    probe.includes('<!doctype') ||
    (probe.includes('<title>') && (probe.includes('502') || probe.includes('504'))) ||
    (probe.includes('bad gateway') && probe.includes('nginx'));
  if (looksHtml) {
    return (
      '上游返回 HTML 错误页（常见为 Nginx 502/504：自建服务未监听或反代未生效）。' +
      '请确认服务健康检查与 Nginx 反代配置后重试。'
    );
  }
  return t.length > 2000 ? `${t.slice(0, 2000)}…` : t;
}

/** 从 fetch / Functions 异常的 cause 链提取 URL 与 message */
export function underlyingNetworkMessage(cause: unknown): string {
  if (cause && typeof cause === 'object' && 'url' in cause) {
    const o = cause as { url?: string; cause?: unknown };
    const inner = o.cause !== undefined ? underlyingNetworkMessage(o.cause) : '';
    const parts = [o.url, inner].filter(Boolean);
    if (parts.length) return parts.join(' | ');
  }
  if (cause instanceof Error) return cause.message;
  if (cause && typeof cause === 'object' && 'message' in cause) {
    return String((cause as { message: unknown }).message);
  }
  if (cause == null) return '';
  try {
    return String(cause);
  } catch {
    return '';
  }
}

/** HTTP 响应非 JSON 时的统一错误文案（OCR 等） */
export function formatHttpNonJsonError(
  status: number,
  contentType: string,
  bodyText: string,
  serviceLabel = '接口',
): string {
  const hint502 =
    status === 502
      ? '网关502：请检查Nginx反向代理是否正确配置，后端服务是否正常运行'
      : '';
  const snippet = bodyText.replace(/\s+/g, ' ').slice(0, 160);
  return `${hint502}${serviceLabel}返回HTTP ${status}且非JSON（Content-Type: ${contentType || '无'}）${snippet ? `：${snippet}` : ''}`;
}

/**
 * 从任意类型的 catch 参数中安全提取可读错误消息。
 * 解决 `String(err)` 产生 `[object Object]` 的问题。
 *
 * @param e  catch 捕获的异常值（unknown）
 * @param fallback  当无法提取任何消息时的兜底文案（默认"未知错误"）
 */
export function errorMessageFromUnknown(e: unknown, fallback = '未知错误'): string {
  if (e == null) return fallback;
  if (e instanceof Error) return e.message || fallback;
  if (typeof e === 'object' && 'message' in e) {
    const msg = (e as { message: unknown }).message;
    if (typeof msg === 'string' && msg.length > 0 && msg !== 'undefined') return msg;
    return fallback;
  }
  if (typeof e === 'string') return e || fallback;
  try {
    const str = String(e);
    if (str === '[object Object]') {
      const obj = e as Record<string, unknown>;
      if ('error' in obj && typeof obj.error === 'string') return obj.error;
      if ('details' in obj && typeof obj.details === 'string') return obj.details;
      if ('statusText' in obj && typeof obj.statusText === 'string') return obj.statusText;
      return fallback;
    }
    return str;
  } catch {
    return fallback;
  }
}
