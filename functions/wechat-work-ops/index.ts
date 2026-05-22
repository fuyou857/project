/**
 * 企业微信服务端代理：密钥从密钥中心 / Edge Secrets 读取，禁止在前端 bundle 携带 corpsecret。
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { resolveWechatWorkBundle } from '../_shared/resolveIntegrationConfig.ts';
import { getSystemApiKey } from '../_shared/systemApiKeys.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

const TOKEN_URL = 'https://qyapi.weixin.qq.com/cgi-bin/gettoken';
const SEND_URL = 'https://qyapi.weixin.qq.com/cgi-bin/message/send';

let cachedToken: { token: string; expiresAt: number } | null = null;

async function fetchAccessToken(bundle: { corp_id: string; corp_secret: string }): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < cachedToken.expiresAt) return cachedToken.token;
  const params = new URLSearchParams({ corpid: bundle.corp_id, corpsecret: bundle.corp_secret });
  const res = await fetch(`${TOKEN_URL}?${params}`);
  const data = await res.json() as { errcode?: number; errmsg?: string; access_token?: string; expires_in?: number };
  if (data.errcode !== 0 || !data.access_token) {
    throw new Error(data.errmsg || '获取 access_token 失败');
  }
  cachedToken = {
    token: data.access_token,
    expiresAt: now + (data.expires_in ?? 7200) * 1000 - 60_000,
  };
  return cachedToken.token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { ...cors, 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
  }
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ error: '未授权' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: authData, error: authErr } = await userClient.auth.getUser();
  if (authErr || !authData.user) return json({ error: '登录已失效' }, 401);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: '无效 JSON' }, 400);
  }

  const action = String(body.action ?? '');

  try {
    if (action === 'getPublicConfig') {
      const bundle = await resolveWechatWorkBundle(admin);
      return json({
        ok: true,
        corp_id: bundle?.corp_id ?? '',
        agent_id: bundle?.agent_id ?? '',
        redirect_uri: bundle?.redirect_uri ?? '',
        configured: Boolean(bundle?.corp_secret),
      });
    }

    if (action === 'sendMessage') {
      const bundle = await resolveWechatWorkBundle(admin);
      if (!bundle?.corp_secret) return json({ error: '企业微信密钥未配置' }, 503);

      const keyRow = await getSystemApiKey(admin, 'wechat_work');
      if (!keyRow) return json({ error: '企业微信密钥不可用或已过期' }, 503);

      const token = await fetchAccessToken(bundle);
      const message = body.message;
      if (!message || typeof message !== 'object') return json({ error: '缺少 message' }, 400);

      const res = await fetch(`${SEND_URL}?access_token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });
      const data = await res.json();
      return json({ ok: true, result: data });
    }

    return json({ error: '未知 action' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});
