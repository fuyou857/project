/**
 * 全项目统一 API 密钥读取（Edge / Deno）
 * 优先级：内存热缓存 → 数据库 → system_settings 本地备份
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { computeKeyStatus } from './apiKeyStatus.ts';
import { decryptSecret } from './apiKeyCrypto.ts';

export type SystemApiKeyRecord = {
  key_code: string;
  api_url: string | null;
  secret_key_encrypted: string;
  fallback_secret_encrypted: string | null;
  expires_at: string | null;
  status: string;
  is_enabled: boolean;
};

type CacheEntry = { record: SystemApiKeyRecord; secret: string; fallbackSecret: string; loadedAt: number };

const CACHE_TTL_MS = 30_000;
const memoryCache = new Map<string, CacheEntry>();

export function invalidateSystemApiKeyCache(keyCode?: string): void {
  if (keyCode) memoryCache.delete(keyCode);
  else memoryCache.clear();
}

const rateLimitBuckets = new Map<string, number[]>();

/** 调用方 IP 是否在白名单内（空白名单表示不限制） */
export function isIpAllowed(allowedIps: string[] | null | undefined, clientIp: string): boolean {
  const list = allowedIps?.filter(Boolean) ?? [];
  if (list.length === 0) return true;
  const ip = clientIp.trim();
  if (!ip) return false;
  return list.some(rule => rule === ip || (rule.includes('/') && ip.startsWith(rule.split('/')[0])));
}

/** 简单滑动窗口限流（单 Edge 实例内存，多实例为软限制） */
export function checkRateLimit(keyCode: string, limitPerMinute: number | null | undefined): boolean {
  if (!limitPerMinute || limitPerMinute <= 0) return true;
  const now = Date.now();
  const windowMs = 60_000;
  const bucket = rateLimitBuckets.get(keyCode) ?? [];
  const recent = bucket.filter(t => now - t < windowMs);
  if (recent.length >= limitPerMinute) {
    rateLimitBuckets.set(keyCode, recent);
    return false;
  }
  recent.push(now);
  rateLimitBuckets.set(keyCode, recent);
  return true;
}

export function isKeyCallable(record: SystemApiKeyRecord): boolean {
  const { status } = computeKeyStatus(record.expires_at, record.is_enabled);
  return record.is_enabled && status !== 'expired' && status !== 'disabled';
}

async function loadFromLocalBackup(admin: SupabaseClient, keyCode: string): Promise<SystemApiKeyRecord | null> {
  const { data } = await admin
    .from('system_settings')
    .select('value')
    .eq('key', 'api_keys_local_backup')
    .maybeSingle();
  if (!data?.value) return null;
  try {
    const parsed = JSON.parse(data.value) as { keys?: SystemApiKeyRecord[] };
    return parsed.keys?.find(k => k.key_code === keyCode) ?? null;
  } catch {
    return null;
  }
}

/**
 * 获取可用密钥明文；已过期或停用返回 null。
 */
export async function getSystemApiKey(
  admin: SupabaseClient,
  keyCode: string,
  opts?: { allowFallback?: boolean; clientIp?: string },
): Promise<{ secret: string; apiUrl: string | null } | null> {
  const allowFallback = opts?.allowFallback !== false;
  const cached = memoryCache.get(keyCode);
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
    if (!isKeyCallable(cached.record)) return null;
    return { secret: cached.secret, apiUrl: cached.record.api_url };
  }

  const { data: row } = await admin
    .from('system_api_keys')
    .select(
      'key_code, api_url, secret_key_encrypted, fallback_secret_encrypted, expires_at, status, is_enabled, allowed_ips, rate_limit_per_minute',
    )
    .eq('key_code', keyCode)
    .maybeSingle();

  let record = row as (SystemApiKeyRecord & {
    allowed_ips?: string[] | null;
    rate_limit_per_minute?: number | null;
  }) | null;
  if (!record) {
    record = await loadFromLocalBackup(admin, keyCode);
  }
  if (!record) return null;

  const allowedIps = record.allowed_ips;
  const rateLimit = record.rate_limit_per_minute;
  if (opts?.clientIp && !isIpAllowed(allowedIps, opts.clientIp)) return null;
  if (!checkRateLimit(keyCode, rateLimit)) return null;

  const { status: st } = computeKeyStatus(record.expires_at, record.is_enabled);
  if (!record.is_enabled || st === 'expired' || st === 'disabled') {
    if (allowFallback && record.fallback_secret_encrypted) {
      try {
        const fb = await decryptSecret(record.fallback_secret_encrypted);
        if (fb) return { secret: fb, apiUrl: record.api_url };
      } catch {
        /* ignore */
      }
    }
    return null;
  }

  let secret = '';
  try {
    secret = await decryptSecret(record.secret_key_encrypted);
  } catch {
    return null;
  }

  let fallbackSecret = '';
  if (record.fallback_secret_encrypted) {
    try {
      fallbackSecret = await decryptSecret(record.fallback_secret_encrypted);
    } catch {
      fallbackSecret = '';
    }
  }

  memoryCache.set(keyCode, { record, secret, fallbackSecret, loadedAt: Date.now() });
  return { secret, apiUrl: record.api_url };
}

/** 解析调用 URL：优先 api_url 字段，否则将 secret 视为完整 URL（无独立密钥的接口） */
export async function getSystemApiEndpoint(
  admin: SupabaseClient,
  keyCode: string,
): Promise<string | null> {
  const row = await getSystemApiKey(admin, keyCode);
  if (!row) return null;
  if (row.apiUrl?.trim()) return row.apiUrl.trim();
  if (row.secret.startsWith('http://') || row.secret.startsWith('https://')) return row.secret;
  return null;
}
