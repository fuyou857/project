/**
 * 用户名或手机号 + 密码登录（无邮箱登录入口）
 * 部署：supabase functions deploy login --no-verify-jwt
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { getCorsHeaders } from '../_shared/cors.ts';
import { findUserByAccount, resolveAuthEmail } from '../_shared/userAuthLookup.ts';

let _reqOrigin: string | null = null;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(_reqOrigin) },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = await req.json() as { account?: string; username?: string; password?: string };
    const account = String(body.account ?? body.username ?? '').trim();
    const password = String(body.password ?? '');

    if (!account || !password) {
      return json({ error: '请输入用户名或手机号和密码' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const dbUser = await findUserByAccount(admin, account);
    if (!dbUser) {
      return json({ success: false, error: '用户名或手机号不存在，或密码错误' });
    }
    if (dbUser.status === 'disabled') {
      return json({ success: false, error: '账号已禁用，请联系管理员' }, 403);
    }

    const authEmail = resolveAuthEmail(dbUser);
    if (!authEmail) {
      return json({ error: '账号未配置登录凭证，请联系管理员补充邮箱字段（仅系统内部使用）' }, 400);
    }

    const { data: sessionData, error: signErr } = await admin.auth.signInWithPassword({
      email: authEmail,
      password,
    });
    if (signErr) {
      return json({ success: false, error: '用户名或手机号不存在，或密码错误' });
    }

    await admin
      .from('users')
      .update({
        last_login_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', dbUser.id);

    return json({
      success: true,
      access_token: sessionData.session?.access_token,
      refresh_token: sessionData.session?.refresh_token,
      user: {
        id: dbUser.id,
        username: dbUser.username,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 400);
  }
});
