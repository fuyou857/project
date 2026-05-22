import { supabase } from '../supabase/client';

export type ApiKeyStatus = 'active' | 'expiring_soon' | 'expired' | 'disabled';
export type ApiKeyWarningLevel = 'none' | 'warn_15d' | 'warn_7d' | 'expired';

export type ApiKeyPublic = {
  id: string;
  key_code: string;
  name: string;
  api_url: string | null;
  secret_masked: string;
  expires_at: string | null;
  status: ApiKeyStatus;
  warning_level?: ApiKeyWarningLevel;
  usage_scene: string | null;
  allowed_ips: string[];
  rate_limit_per_minute: number | null;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
};

export type ApiKeySummary = {
  total: number;
  registryTotal?: number;
  envConfigured?: number;
  inDatabase?: number;
  expiringSoon: number;
  warn15?: number;
  warn7?: number;
  expired: number;
  disabled: number;
};

export type ApiKeyRegistryItem = {
  key_code: string;
  name: string;
  usage_scene: string;
  category: string;
  env_keys: string[];
  in_database: boolean;
  env_configured: boolean;
  key: ApiKeyPublic | null;
};

export type ApiKeyLog = {
  id: string;
  key_code: string | null;
  action: string;
  operator_email: string | null;
  ip_address: string | null;
  detail: Record<string, unknown>;
  created_at: string;
};

export type ListApiKeysParams = {
  search?: string;
  status?: string;
  category?: string;
  page?: number;
  pageSize?: number;
};

export type ListApiKeyLogsParams = {
  limit?: number;
  page?: number;
  key_code?: string;
  action?: string;
  operator_email?: string;
  from?: string;
  to?: string;
};

const LIST_CACHE_KEY = 'ciond_api_keys_list_cache_v1';

type EdgePayload = { error?: string; ok?: boolean };

async function invoke<T extends Record<string, unknown>>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<EdgePayload & T>('api-key-ops', { body });
  if (error) throw new Error(error.message || 'Edge Function 调用失败');
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String(data.error));
  }
  return data as T;
}

export function readApiKeysListCache(): {
  keys: ApiKeyPublic[];
  registry: ApiKeyRegistryItem[];
  extraKeys: ApiKeyPublic[];
  summary: ApiKeySummary;
  cached_at: string;
} | null {
  try {
    const raw = sessionStorage.getItem(LIST_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ReturnType<typeof readApiKeysListCache>;
  } catch {
    return null;
  }
}

function writeApiKeysListCache(payload: {
  keys: ApiKeyPublic[];
  registry: ApiKeyRegistryItem[];
  extraKeys: ApiKeyPublic[];
  summary: ApiKeySummary;
}) {
  try {
    sessionStorage.setItem(
      LIST_CACHE_KEY,
      JSON.stringify({ ...payload, cached_at: new Date().toISOString() }),
    );
  } catch {
    /* quota */
  }
}

export async function listApiKeys(params: ListApiKeysParams = {}): Promise<{
  keys: ApiKeyPublic[];
  registry: ApiKeyRegistryItem[];
  extraKeys: ApiKeyPublic[];
  summary: ApiKeySummary;
  pagination?: { page: number; pageSize: number; total: number; totalPages: number };
}> {
  try {
    const data = await invoke<{
      keys: ApiKeyPublic[];
      registry: ApiKeyRegistryItem[];
      extraKeys: ApiKeyPublic[];
      summary: ApiKeySummary;
      pagination?: { page: number; pageSize: number; total: number; totalPages: number };
    }>({ action: 'list', ...params });
    const result = {
      keys: data.keys ?? [],
      registry: data.registry ?? [],
      extraKeys: data.extraKeys ?? [],
      summary: data.summary ?? { total: 0, expiringSoon: 0, expired: 0, disabled: 0 },
      pagination: data.pagination,
    };
    writeApiKeysListCache(result);
    return result;
  } catch (e) {
    const cached = readApiKeysListCache();
    if (cached) {
      return {
        keys: cached.keys,
        registry: cached.registry,
        extraKeys: cached.extraKeys,
        summary: cached.summary,
        pagination: undefined,
      };
    }
    throw e;
  }
}

export async function syncApiKeysFromSystem(overwrite = false): Promise<{ synced: number; skipped: string[] }> {
  return invoke({ action: 'syncFromSystem', overwrite });
}

export async function listApiKeyLogs(params: ListApiKeyLogsParams = {}): Promise<{
  logs: ApiKeyLog[];
  pagination?: { page: number; limit: number; total: number; totalPages: number };
}> {
  const body: Record<string, unknown> = {
    action: 'listLogs',
    limit: params.limit ?? 50,
    page: params.page ?? 1,
  };
  if (params.key_code?.trim()) body.key_code = params.key_code.trim();
  if (params.action?.trim()) body.action = params.action.trim();
  if (params.operator_email?.trim()) body.operator_email = params.operator_email.trim();
  if (params.from?.trim()) body.from = new Date(params.from).toISOString();
  if (params.to?.trim()) body.to = new Date(params.to).toISOString();
  const data = await invoke<{ logs: ApiKeyLog[]; pagination?: { page: number; limit: number; total: number; totalPages: number } }>(
    body,
  );
  return { logs: data.logs ?? [], pagination: data.pagination };
}

export async function createApiKey(payload: {
  key_code: string;
  name: string;
  secret_key?: string;
  api_url?: string;
  expires_at?: string | null;
  usage_scene?: string;
  allowed_ips?: string[];
  rate_limit_per_minute?: number;
  is_enabled?: boolean;
}): Promise<{ key: ApiKeyPublic; connectivity: { ok: boolean; message: string } }> {
  return invoke({ action: 'create', ...payload });
}

export async function updateApiKey(
  keyCode: string,
  payload: Partial<{
    name: string;
    secret_key: string;
    api_url: string;
    expires_at: string | null;
    usage_scene: string;
    allowed_ips: string[];
    rate_limit_per_minute: number;
    is_enabled: boolean;
  }>,
): Promise<{ key: ApiKeyPublic; connectivity: { ok: boolean; message: string } }> {
  return invoke({ action: 'update', key_code: keyCode, ...payload });
}

export async function batchUpdateApiKeys(
  items: { key_code: string; is_enabled?: boolean; expires_at?: string | null }[],
): Promise<{ updated: number; errors: string[] }> {
  return invoke({ action: 'batchUpdate', items });
}

export async function deleteApiKey(keyCode: string): Promise<void> {
  await invoke({ action: 'delete', key_code: keyCode });
}

export async function revealApiKeySecret(keyCode: string): Promise<string> {
  const data = await invoke<{ secret: string }>({ action: 'reveal', key_code: keyCode });
  return data.secret ?? '';
}

export async function testApiKey(keyCode: string): Promise<{ ok: boolean; message: string }> {
  return invoke({ action: 'test', key_code: keyCode });
}

export async function batchTestApiKeys(): Promise<{ key_code: string; ok: boolean; message: string }[]> {
  const data = await invoke<{ results: { key_code: string; ok: boolean; message: string }[] }>({
    action: 'batchTest',
  });
  return data.results ?? [];
}

export async function exportApiKeyBackup(includeCiphertext = false): Promise<{
  keys: ApiKeyPublic[];
  exported_at: string;
  note?: string;
}> {
  return invoke({ action: 'exportBackup', include_ciphertext: includeCiphertext });
}

export async function runApiKeyExpiryCheck(): Promise<{ updated: number }> {
  return invoke({ action: 'runExpiryCheck' });
}

export async function getApiKeyCenterStatus(): Promise<boolean> {
  const data = await invoke<{ enabled: boolean }>({ action: 'getCenterStatus' });
  return data.enabled !== false;
}

export async function setApiKeyCenterEnabled(enabled: boolean): Promise<void> {
  await invoke({ action: 'setCenterEnabled', enabled });
}

export async function batchImportApiKeys(
  items: Record<string, unknown>[],
): Promise<{ imported: number; errors: string[] }> {
  return invoke({ action: 'batchImport', items });
}
