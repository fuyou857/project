/**
 * API 密钥中心（仅 super_admin）
 * 部署：npm run deploy:functions -- api-key-ops
 * Secrets：SYSTEM_API_KEY_ENCRYPTION_SECRET（推荐 32+ 字符）
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { decryptSecret, encryptSecret, maskSecret, secretHint } from '../_shared/apiKeyCrypto.ts';
import {
  buildWechatWorkBundle,
  readFirstEnv,
  SYSTEM_API_KEY_REGISTRY,
  type ApiKeyRegistryEntry } from
'../_shared/systemApiKeyRegistry.ts';
import { computeKeyStatus } from '../_shared/apiKeyStatus.ts';
import { getSystemApiKey, invalidateSystemApiKeyCache } from '../_shared/systemApiKeys.ts';

const corsBase = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsBase }
  });
}

function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('cf-connecting-ip') || '';
}

function computeStatus(expiresAt: string | null, isEnabled: boolean): string {
  return computeKeyStatus(expiresAt, isEnabled).status;
}

type DbRow = {
  id: string;
  key_code: string;
  name: string;
  api_url: string | null;
  secret_key_encrypted: string;
  secret_key_hint: string | null;
  expires_at: string | null;
  status: string;
  usage_scene: string | null;
  allowed_ips: string[] | null;
  rate_limit_per_minute: number | null;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
};

function toPublicRow(row: DbRow) {
  const { status, warning_level } = computeKeyStatus(row.expires_at, row.is_enabled);
  return {
    id: row.id,
    key_code: row.key_code,
    name: row.name,
    api_url: row.api_url,
    secret_masked: row.secret_key_hint || '****',
    expires_at: row.expires_at,
    status,
    warning_level,
    usage_scene: row.usage_scene,
    allowed_ips: row.allowed_ips ?? [],
    rate_limit_per_minute: row.rate_limit_per_minute,
    is_enabled: row.is_enabled,
    created_at: row.created_at,
    updated_at: row.updated_at,
    updated_by: row.updated_by
  };
}

async function writeLog(
admin: ReturnType<typeof createClient>,
entry: {
  key_code?: string;
  action: string;
  operator_id: string;
  operator_email?: string;
  ip: string;
  detail?: Record<string, unknown>;
})
{
  await admin.from('system_api_key_logs').insert({
    key_code: entry.key_code ?? null,
    action: entry.action,
    operator_id: entry.operator_id,
    operator_email: entry.operator_email ?? null,
    ip_address: entry.ip,
    detail: entry.detail ?? {}
  });
}

function probeEnvForEntry(entry: ApiKeyRegistryEntry): {apiUrl: string | null;secretPlain: string | null;} {
  if (entry.key_code === 'wechat_work') {
    const b = buildWechatWorkBundle();
    if (!b) return { apiUrl: null, secretPlain: null };
    return { apiUrl: b.api_url, secretPlain: b.secret };
  }
  const url = entry.url_env_keys ? readFirstEnv(entry.url_env_keys) : null;
  const secret = readFirstEnv(entry.env_keys);
  if (!url && secret?.startsWith('http')) {
    return { apiUrl: secret, secretPlain: secret };
  }
  return { apiUrl: url, secretPlain: (() => {if (secret && !secret.startsWith('http')) {return secret;} else {if (url) {return '';} else {return secret;}}})() };
}

function extractEnvPayload(entry: ApiKeyRegistryEntry): {apiUrl: string | null;secret: string;} | null {
  const { apiUrl, secretPlain } = probeEnvForEntry(entry);
  const secret = secretPlain?.trim() ?? '';
  const url = apiUrl?.trim() || null;
  if (!secret && !url) return null;
  return { apiUrl: url, secret: secret || url || '' };
}

async function syncLocalBackup(admin: ReturnType<typeof createClient>) {
  const { data: rows } = await admin.from('system_api_keys').select('*');
  const snapshot = {
    synced_at: new Date().toISOString(),
    keys: (rows ?? []).map((r: DbRow) => ({
      key_code: r.key_code,
      name: r.name,
      api_url: r.api_url,
      secret_key_encrypted: r.secret_key_encrypted,
      fallback_secret_encrypted: (r as DbRow & {fallback_secret_encrypted?: string;}).fallback_secret_encrypted,
      expires_at: r.expires_at,
      status: r.status,
      is_enabled: r.is_enabled
    }))
  };
  await admin.from('system_settings').upsert(
    { key: 'api_keys_local_backup', value: JSON.stringify(snapshot), updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  );
}

async function testConnectivity(apiUrl: string | null, secret: string): Promise<{ok: boolean;message: string;}> {
  const url = apiUrl?.trim() || (secret.startsWith('http') ? secret : '');
  if (!url) return { ok: false, message: '未配置 api_url' };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { method: 'HEAD', signal: ctrl.signal });
    clearTimeout(t);
    if (res.ok || res.status === 405 || res.status === 404) {
      return { ok: true, message: `可达（HTTP ${res.status}）` };
    }
    return { ok: false, message: `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

async function notifySuperAdmins(
admin: ReturnType<typeof createClient>,
title: string,
body: string,
dedupeKey: string)
{
  const { data: superRole } = await admin.from('roles').select('id').eq('code', 'super_admin').maybeSingle();
  if (!superRole?.id) return;
  const { data: users } = await admin.from('users').select('id').contains('role_ids', [superRole.id]);
  if (!users?.length) return;
  const rows = users.map((u: {id: string;}) => ({
    user_id: u.id,
    title,
    body,
    category: 'api_key_expiry',
    dedupe_key: dedupeKey,
    payload: {}
  }));
  await admin.from('notifications').upsert(rows, { onConflict: 'dedupe_key', ignoreDuplicates: true });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: { ...corsBase, 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
    });
  }
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ error: '未授权' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } }
  });
  const { data: authData, error: authErr } = await userClient.auth.getUser();
  if (authErr || !authData.user) return json({ error: '登录已失效' }, 401);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: dbUser } = await admin.from('users').select('id, email, role_ids').eq('id', authData.user.id).maybeSingle();
  if (!dbUser?.role_ids?.length) return json({ error: '禁止访问' }, 403);

  const { data: roles } = await admin.from('roles').select('code').in('id', dbUser.role_ids);
  const isSuper = roles?.some((r: {code: string;}) => r.code === 'super_admin');
  if (!isSuper) return json({ error: '需要超级管理员权限' }, 403);

  const { data: centerFlag } = await admin.
  from('system_settings').
  select('value').
  eq('key', 'api_key_center_enabled').
  maybeSingle();
  if (centerFlag?.value === 'false') {
    return json({ error: '密钥中心已临时关闭' }, 503);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: '无效 JSON' }, 400);
  }

  const action = String(body.action ?? '');
  const ip = clientIp(req);
  const operatorId = authData.user.id;
  const operatorEmail = dbUser.email ?? authData.user.email ?? '';

  try {
    switch (action) {
      case 'list':{
          const { data: rows, error } = await admin.from('system_api_keys').select('*').order('key_code');
          if (error) throw error;
          const dbRows = (rows ?? []) as DbRow[];
          const dbMap = new Map(dbRows.map((r) => [r.key_code, r]));
          const list = dbRows.map(toPublicRow);
          let registry = SYSTEM_API_KEY_REGISTRY.map((reg) => {
            const envProbe = probeEnvForEntry(reg);
            const db = dbMap.get(reg.key_code);
            return {
              key_code: reg.key_code,
              name: reg.name,
              usage_scene: reg.usage_scene,
              category: reg.category,
              env_keys: reg.env_keys,
              in_database: Boolean(db),
              env_configured: Boolean(envProbe.apiUrl || envProbe.secretPlain),
              key: db ? toPublicRow(db) : null
            };
          });
          const registryCodes = new Set(SYSTEM_API_KEY_REGISTRY.map((r) => r.key_code));
          let extraKeys = list.filter((k) => !registryCodes.has(k.key_code));

          const search = String(body.search ?? '').trim().toLowerCase();
          const statusFilter = String(body.status ?? '').trim();
          const categoryFilter = String(body.category ?? '').trim();
          const page = Math.max(1, Number(body.page) || 1);
          const pageSize = Math.min(100, Math.max(5, Number(body.pageSize) || 20));

          const matchRow = (keyCode: string, name: string, usage: string, status: string, category: string) => {
            if (categoryFilter && category !== categoryFilter) return false;
            if (statusFilter && status !== statusFilter) return false;
            if (!search) return true;
            const hay = `${keyCode} ${name} ${usage}`.toLowerCase();
            return hay.includes(search);
          };

          registry = registry.filter((r) => {
            const st = r.key?.status ?? (r.env_configured ? 'env_only' : 'missing');
            return matchRow(r.key_code, r.name, r.usage_scene, st, r.category);
          });
          extraKeys = extraKeys.filter((k) => matchRow(k.key_code, k.name, k.usage_scene ?? '', k.status, 'other'));

          const flatCount = registry.length + extraKeys.length;

          const summary = {
            total: list.length,
            registryTotal: SYSTEM_API_KEY_REGISTRY.length,
            envConfigured: SYSTEM_API_KEY_REGISTRY.filter((reg) => {
              const p = probeEnvForEntry(reg);
              return Boolean(p.apiUrl || p.secretPlain);
            }).length,
            inDatabase: list.length,
            expiringSoon: list.filter((r) => r.status === 'expiring_soon').length,
            warn15: list.filter((r) => r.warning_level === 'warn_15d').length,
            warn7: list.filter((r) => r.warning_level === 'warn_7d' || r.status === 'expiring_soon').length,
            expired: list.filter((r) => r.status === 'expired').length,
            disabled: list.filter((r) => r.status === 'disabled' || !r.is_enabled).length
          };
          return json({
            ok: true,
            keys: list,
            registry,
            extraKeys,
            summary,
            pagination: { page, pageSize, total: flatCount, totalPages: Math.max(1, Math.ceil(flatCount / pageSize)) }
          });
        }

      case 'syncFromSystem':{
          const overwrite = body.overwrite === true;
          let synced = 0;
          const skipped: string[] = [];
          for (const reg of SYSTEM_API_KEY_REGISTRY) {
            const payload = extractEnvPayload(reg);
            if (!payload) {
              skipped.push(`${reg.key_code}: 环境变量未配置`);
              continue;
            }
            const { data: existing } = await admin.
            from('system_api_keys').
            select('key_code').
            eq('key_code', reg.key_code).
            maybeSingle();
            if (existing && !overwrite) {
              skipped.push(`${reg.key_code}: 已存在（跳过）`);
              continue;
            }
            const encrypted = await encryptSecret(payload.secret);
            const { error: upErr } = await admin.from('system_api_keys').upsert(
              {
                key_code: reg.key_code,
                name: reg.name,
                api_url: payload.apiUrl,
                secret_key_encrypted: encrypted,
                secret_key_hint: secretHint(payload.secret),
                usage_scene: reg.usage_scene,
                is_enabled: true,
                status: 'active',
                updated_by: operatorId,
                updated_at: new Date().toISOString()
              },
              { onConflict: 'key_code' }
            );
            if (upErr) {
              skipped.push(`${reg.key_code}: ${upErr.message}`);
              continue;
            }
            invalidateSystemApiKeyCache(reg.key_code);
            synced++;
          }
          await syncLocalBackup(admin);
          await writeLog(admin, {
            action: 'sync_from_system',
            operator_id: operatorId,
            operator_email: operatorEmail,
            ip,
            detail: { synced, skipped: skipped.length, overwrite }
          });
          return json({ ok: true, synced, skipped });
        }

      case 'listLogs':{
          const limit = Math.min(Number(body.limit) || 50, 200);
          const page = Math.max(1, Number(body.page) || 1);
          const offset = (page - 1) * limit;
          let q = admin.from('system_api_key_logs').select('*', { count: 'exact' }).order('created_at', { ascending: false });
          const keyCode = String(body.key_code ?? '').trim();
          const action = String(body.action ?? '').trim();
          const operator = String(body.operator_email ?? '').trim();
          const from = String(body.from ?? '').trim();
          const to = String(body.to ?? '').trim();
          if (keyCode) q = q.eq('key_code', keyCode);
          if (action) q = q.eq('action', action);
          if (operator) q = q.ilike('operator_email', `%${operator}%`);
          if (from) q = q.gte('created_at', from);
          if (to) q = q.lte('created_at', to);
          const { data: logs, error, count } = await q.range(offset, offset + limit - 1);
          if (error) throw error;
          return json({
            ok: true,
            logs: logs ?? [],
            pagination: { page, limit, total: count ?? 0, totalPages: Math.max(1, Math.ceil((count ?? 0) / limit)) }
          });
        }

      case 'create':{
          const keyCode = String(body.key_code ?? '').trim();
          const name = String(body.name ?? '').trim();
          const secretKey = String(body.secret_key ?? '');
          const apiUrl = body.api_url != null ? String(body.api_url).trim() : null;
          if (!keyCode || !/^[a-z][a-z0-9_]{1,63}$/.test(keyCode)) {
            return json({ error: 'key_code 须为小写字母开头的标识' }, 400);
          }
          if (!name) return json({ error: '缺少接口名称' }, 400);
          if (!secretKey && !apiUrl) return json({ error: '须填写密钥或请求地址' }, 400);

          const encrypted = await encryptSecret(secretKey || apiUrl || '');
          const hint = secretHint(secretKey || apiUrl || '');
          const expiresAt = body.expires_at ? String(body.expires_at) : null;
          const isEnabled = body.is_enabled !== false;
          const status = computeStatus(expiresAt, isEnabled);

          const { data: inserted, error } = await admin.
          from('system_api_keys').
          insert({
            key_code: keyCode,
            name,
            api_url: apiUrl,
            secret_key_encrypted: encrypted,
            secret_key_hint: hint,
            expires_at: expiresAt,
            status,
            usage_scene: body.usage_scene ? String(body.usage_scene) : null,
            allowed_ips: Array.isArray(body.allowed_ips) ? body.allowed_ips : [],
            rate_limit_per_minute: body.rate_limit_per_minute != null ? Number(body.rate_limit_per_minute) : null,
            is_enabled: isEnabled,
            updated_by: operatorId
          }).
          select().
          single();
          if (error) throw error;

          invalidateSystemApiKeyCache(keyCode);
          await syncLocalBackup(admin);
          await writeLog(admin, {
            key_code: keyCode,
            action: 'create',
            operator_id: operatorId,
            operator_email: operatorEmail,
            ip,
            detail: { name, hint }
          });

          const test = await testConnectivity(apiUrl, secretKey);
          return json({ ok: true, key: toPublicRow(inserted as DbRow), connectivity: test });
        }

      case 'update':{
          const keyCode = String(body.key_code ?? '').trim();
          if (!keyCode) return json({ error: '缺少 key_code' }, 400);

          const { data: existing } = await admin.from('system_api_keys').select('*').eq('key_code', keyCode).maybeSingle();
          if (!existing) return json({ error: '密钥不存在' }, 404);

          const patch: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
            updated_by: operatorId
          };
          if (body.name != null) patch.name = String(body.name);
          if (body.api_url != null) patch.api_url = String(body.api_url).trim() || null;
          if (body.usage_scene != null) patch.usage_scene = String(body.usage_scene);
          if (body.allowed_ips != null) patch.allowed_ips = body.allowed_ips;
          if (body.rate_limit_per_minute != null) patch.rate_limit_per_minute = Number(body.rate_limit_per_minute);
          if (body.is_enabled != null) patch.is_enabled = Boolean(body.is_enabled);
          if (body.expires_at != null) patch.expires_at = body.expires_at ? String(body.expires_at) : null;

          const newSecret = body.secret_key != null ? String(body.secret_key) : '';
          if (newSecret) {
            const oldEnc = (existing as DbRow).secret_key_encrypted;
            patch.fallback_secret_encrypted = oldEnc;
            patch.secret_key_encrypted = await encryptSecret(newSecret);
            patch.secret_key_hint = secretHint(newSecret);
          }

          const row = { ...existing, ...patch } as DbRow;
          patch.status = computeStatus(
            patch.expires_at as string | null ?? row.expires_at,
            patch.is_enabled as boolean ?? row.is_enabled
          );

          const { data: updated, error } = await admin.
          from('system_api_keys').
          update(patch).
          eq('key_code', keyCode).
          select().
          single();
          if (error) throw error;

          invalidateSystemApiKeyCache(keyCode);
          await syncLocalBackup(admin);
          await writeLog(admin, {
            key_code: keyCode,
            action: 'update',
            operator_id: operatorId,
            operator_email: operatorEmail,
            ip,
            detail: { fields: Object.keys(patch).filter((k) => k !== 'secret_key_encrypted') }
          });

          const secretForTest = newSecret || (await decryptSecret((updated as DbRow).secret_key_encrypted));
          const test = await testConnectivity((updated as DbRow).api_url, secretForTest);
          return json({ ok: true, key: toPublicRow(updated as DbRow), connectivity: test });
        }

      case 'delete':{
          const keyCode = String(body.key_code ?? '').trim();
          const { error } = await admin.from('system_api_keys').delete().eq('key_code', keyCode);
          if (error) throw error;
          invalidateSystemApiKeyCache(keyCode);
          await syncLocalBackup(admin);
          await writeLog(admin, { key_code: keyCode, action: 'delete', operator_id: operatorId, operator_email: operatorEmail, ip });
          return json({ ok: true });
        }

      case 'reveal':{
          const keyCode = String(body.key_code ?? '').trim();
          const got = await getSystemApiKey(admin, keyCode, { allowFallback: false });
          if (!got) return json({ error: '密钥不可用或已过期' }, 400);
          await writeLog(admin, {
            key_code: keyCode,
            action: 'reveal',
            operator_id: operatorId,
            operator_email: operatorEmail,
            ip
          });
          return json({ ok: true, secret: got.secret, masked: maskSecret(got.secret) });
        }

      case 'test':{
          const keyCode = String(body.key_code ?? '').trim();
          const got = await getSystemApiKey(admin, keyCode);
          if (!got) return json({ ok: false, message: '密钥不可用' });
          const test = await testConnectivity(got.apiUrl, got.secret);
          await writeLog(admin, {
            key_code: keyCode,
            action: 'test',
            operator_id: operatorId,
            operator_email: operatorEmail,
            ip,
            detail: test
          });
          return json({ ok: test.ok, ...test });
        }

      case 'batchTest':{
          const { data: rows } = await admin.from('system_api_keys').select('key_code, api_url, secret_key_encrypted, is_enabled, expires_at');
          const results: {key_code: string;ok: boolean;message: string;}[] = [];
          for (const r of rows ?? []) {
            const got = await getSystemApiKey(admin, r.key_code);
            if (!got) {
              results.push({ key_code: r.key_code, ok: false, message: '不可用' });
              continue;
            }
            const t = await testConnectivity(got.apiUrl, got.secret);
            results.push({ key_code: r.key_code, ...t });
          }
          return json({ ok: true, results });
        }

      case 'batchImport':{
          const items = body.items;
          if (!Array.isArray(items)) return json({ error: 'items 须为数组' }, 400);
          let imported = 0;
          const errors: string[] = [];
          for (const raw of items) {
            const item = raw as Record<string, unknown>;
            const keyCode = String(item.key_code ?? '').trim();
            const name = String(item.name ?? '').trim();
            const secretKey = String(item.secret_key ?? '');
            const apiUrl = item.api_url != null ? String(item.api_url).trim() : null;
            if (!keyCode || !name) {
              errors.push(`${keyCode || '?'}: 缺少字段`);
              continue;
            }
            try {
              const encrypted = await encryptSecret(secretKey || apiUrl || '');
              const { error } = await admin.from('system_api_keys').upsert(
                {
                  key_code: keyCode,
                  name,
                  api_url: apiUrl,
                  secret_key_encrypted: encrypted,
                  secret_key_hint: secretHint(secretKey || apiUrl || ''),
                  expires_at: item.expires_at ? String(item.expires_at) : null,
                  usage_scene: item.usage_scene ? String(item.usage_scene) : null,
                  is_enabled: item.is_enabled !== false,
                  status: 'active',
                  updated_by: operatorId,
                  updated_at: new Date().toISOString()
                },
                { onConflict: 'key_code' }
              );
              if (error) throw error;
              invalidateSystemApiKeyCache(keyCode);
              imported++;
            } catch (e) {
              errors.push(`${keyCode}: ${e instanceof Error ? e.message : String(e)}`);
            }
          }
          await syncLocalBackup(admin);
          return json({ ok: true, imported, errors });
        }

      case 'exportBackup':{
          const { data: rows } = await admin.from('system_api_keys').select('*');
          const includeCiphertext = body.include_ciphertext === true;
          const exportData = (rows ?? []).map((r: DbRow) => {
            const pub = toPublicRow(r);
            if (!includeCiphertext) return pub;
            return {
              ...pub,
              secret_key_encrypted: r.secret_key_encrypted,
              fallback_secret_encrypted: (r as DbRow & {fallback_secret_encrypted?: string;}).fallback_secret_encrypted ?? null
            };
          });
          await writeLog(admin, {
            action: includeCiphertext ? 'export_ciphertext' : 'export',
            operator_id: operatorId,
            operator_email: operatorEmail,
            ip,
            detail: { count: exportData.length, ciphertext: includeCiphertext }
          });
          return json({
            ok: true,
            exported_at: new Date().toISOString(),
            keys: exportData,
            note: includeCiphertext ?
            '含 AES 密文，可在同项目内恢复；不含明文' :
            '脱敏导出，不含密钥明文或密文'
          });
        }

      case 'batchUpdate':{
          const items = body.items;
          if (!Array.isArray(items)) return json({ error: 'items 须为数组' }, 400);
          let updated = 0;
          const errors: string[] = [];
          for (const raw of items) {
            const item = raw as Record<string, unknown>;
            const keyCode = String(item.key_code ?? '').trim();
            if (!keyCode) continue;
            const patch: Record<string, unknown> = {
              updated_at: new Date().toISOString(),
              updated_by: operatorId
            };
            if (item.is_enabled != null) patch.is_enabled = Boolean(item.is_enabled);
            if (item.expires_at !== undefined) patch.expires_at = item.expires_at ? String(item.expires_at) : null;
            const { data: existing } = await admin.from('system_api_keys').select('expires_at, is_enabled').eq('key_code', keyCode).maybeSingle();
            if (!existing) {
              errors.push(`${keyCode}: 不存在`);
              continue;
            }
            const exp = patch.expires_at as string | null ?? (existing as DbRow).expires_at;
            const en = patch.is_enabled as boolean ?? (existing as DbRow).is_enabled;
            patch.status = computeStatus(exp, en);
            const { error } = await admin.from('system_api_keys').update(patch).eq('key_code', keyCode);
            if (error) {
              errors.push(`${keyCode}: ${error.message}`);
              continue;
            }
            invalidateSystemApiKeyCache(keyCode);
            updated++;
          }
          await syncLocalBackup(admin);
          await writeLog(admin, {
            action: 'batch_update',
            operator_id: operatorId,
            operator_email: operatorEmail,
            ip,
            detail: { updated, errors: errors.length }
          });
          return json({ ok: true, updated, errors });
        }

      case 'setCenterEnabled':{
          const enabled = body.enabled !== false;
          await admin.from('system_settings').upsert(
            {
              key: 'api_key_center_enabled',
              value: enabled ? 'true' : 'false',
              updated_at: new Date().toISOString()
            },
            { onConflict: 'key' }
          );
          return json({ ok: true, enabled });
        }

      case 'getCenterStatus':{
          const { data: flag } = await admin.
          from('system_settings').
          select('value').
          eq('key', 'api_key_center_enabled').
          maybeSingle();
          return json({ ok: true, enabled: flag?.value !== 'false' });
        }

      case 'runExpiryCheck':{
          const { data: rows } = await admin.from('system_api_keys').select('*');
          let updated = 0;
          const today = new Date().toISOString().slice(0, 10);
          for (const r of rows ?? []) {
            const row = r as DbRow;
            const st = computeStatus(row.expires_at, row.is_enabled);
            if (st !== row.status) {
              await admin.from('system_api_keys').update({ status: st }).eq('id', row.id);
              updated++;
            }
            if (!row.expires_at) continue;
            const days = (new Date(row.expires_at).getTime() - Date.now()) / 86400000;
            if (days <= 15 && days > 7) {
              await notifySuperAdmins(
                admin,
                'API 密钥即将过期',
                `「${row.name}」（${row.key_code}）将在 ${Math.ceil(days)} 天后过期，请提前续期。`,
                `api_key|15d|${row.key_code}|${today}`
              );
            }
            if (days <= 7 && days > 0) {
              await notifySuperAdmins(
                admin,
                'API 密钥紧急续期',
                `「${row.name}」（${row.key_code}）将在 ${Math.ceil(days)} 天内过期，请立即处理。`,
                `api_key|7d|${row.key_code}|${today}`
              );
            }
            if (days <= 0) {
              await admin.from('system_api_keys').update({ is_enabled: false, status: 'expired' }).eq('id', row.id);
              await notifySuperAdmins(
                admin,
                'API 密钥已过期',
                `「${row.name}」（${row.key_code}）已过期并自动停用。`,
                `api_key|expired|${row.key_code}|${today}`
              );
            }
          }
          return json({ ok: true, updated });
        }

      default:
        return json({ error: '未知 action' }, 400);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 400);
  }
});