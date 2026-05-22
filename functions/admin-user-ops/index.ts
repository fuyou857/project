/**
 * 管理员用户操作（仅服务端 Service Role）。
 * 校验：调用方 JWT 有效且 public.users 对应账号为 super_admin（roles.code）。
 *
 * 部署：supabase functions deploy admin-user-ops
 * 密钥：使用项目默认的 SUPABASE_* 环境变量（含 ANON + SERVICE_ROLE）。
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsBase = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsBase },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        ...corsBase,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: '未授权' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: authData, error: authErr } = await userClient.auth.getUser();
  if (authErr || !authData.user) {
    return json({ error: '登录已失效' }, 401);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: dbUser, error: dbErr } = await admin
    .from('users')
    .select('role_ids')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (dbErr || !dbUser?.role_ids) {
    return json({ error: '禁止访问' }, 403);
  }

  const roleIds = dbUser.role_ids as string[];
  const { data: roles } = await admin.from('roles').select('code').in('id', roleIds);
  const isSuper = roles?.some((r: { code: string }) => r.code === 'super_admin');
  if (!isSuper) {
    return json({ error: '需要超级管理员权限' }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: '无效 JSON' }, 400);
  }

  const action = body.action as string;

  try {
    switch (action) {
      case 'createUser': {
        const email = String(body.email ?? '');
        const password = String(body.password ?? '');
        const username = String(body.username ?? '');
        if (!email || !password || !username) {
          return json({ error: '缺少 email、password 或 username' }, 400);
        }

        const { data: authUser, error: ce } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
        if (ce) throw ce;

        const uid = authUser.user.id;
        const { error: ie } = await admin.from('users').insert({
          id: uid,
          username,
          email,
          real_name: body.real_name ?? null,
          phone: body.phone ?? null,
          company_id: body.company_id ?? null,
          role_ids: body.role_ids ?? [],
          project_ids: body.project_ids ?? [],
          status: (body.status as string) || 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (ie) {
          await admin.auth.admin.deleteUser(uid);
          throw ie;
        }

        return json({ ok: true, userId: uid });
      }

      case 'updateAuthEmail': {
        const userId = String(body.userId ?? '');
        const email = String(body.email ?? '');
        if (!userId || !email) return json({ error: '缺少 userId 或 email' }, 400);
        const { error } = await admin.auth.admin.updateUserById(userId, { email });
        if (error) throw error;
        return json({ ok: true });
      }

      case 'resetPassword': {
        const userId = String(body.userId ?? '');
        const newPassword = String(body.newPassword ?? '');
        if (!userId || !newPassword) return json({ error: '缺少 userId 或 newPassword' }, 400);
        const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword });
        if (error) throw error;
        return json({ ok: true });
      }

      case 'deleteUser': {
        const userId = String(body.userId ?? '');
        if (!userId) return json({ error: '缺少 userId' }, 400);
        if (userId === authData.user.id) {
          return json({ error: '不能删除当前登录账号' }, 400);
        }
        const { error: ae } = await admin.auth.admin.deleteUser(userId);
        if (ae) throw ae;
        const { error: de } = await admin.from('users').delete().eq('id', userId);
        if (de) throw de;
        return json({ ok: true });
      }

      default:
        return json({ error: '未知 action' }, 400);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 400);
  }
});
