/** 与部署后「旧 runtime 引用已删除的 chunk」场景配套，用于 ErrorBoundary 一次自动刷新 */
export const CIOND_CHUNK_AUTO_RELOAD_SESSION_KEY = 'ciond_chunk_autoreload_v1';

export function isWebpackChunkLoadError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { name?: string; message?: string };
  if (e.name === 'ChunkLoadError') return true;
  const msg = typeof e.message === 'string' ? e.message : '';
  return /Loading chunk \d+ failed/i.test(msg) || /Failed to fetch dynamically imported module/i.test(msg);
}
