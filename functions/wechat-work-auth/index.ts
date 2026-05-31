/**
 * 企业微信扫码登录与账号绑定（corpsecret 仅服务端）
 * 部署：supabase functions deploy wechat-work-auth --no-verify-jwt
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { getCorsHeaders } from '../_shared/cors.ts';
import { resolveWechatWorkBundle } from '../_shared/resolveIntegrationConfig.ts';
import { resolveMemberByOAuthCode, fetchWechatAccessToken, fetchWechatMember } from '../_shared/wechatWorkApi.ts';
import {
  findUserByWechatMember,
  resolveAuthEmail,
} from '../_shared/userAuthLookup.ts';

let _reqOrigin: string | null = null;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(_reqOrigin) },
  });
}

/** 服务端验证 magic link，返回可下发给前端的 session tokens */
async function establishSessionFromTokenHash(
  supabaseUrl: string,
  anonKey: string,
  tokenHash: string,
) {
  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const type of ['magiclink', 'email'] as const) {
    const { data, error } = await authClient.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (!error && data.session?.access_token && data.session?.refresh_token) {
      return data.session;
    }
  }

  throw new Error('无法建立登录会话，请重试');
}

async function requireSuperAdmin(
  admin: ReturnType<typeof createClient>,
  authUserId: string,
): Promise<boolean> {
  const { data: dbUser } = await admin.from('users').select('role_ids').eq('id', authUserId).maybeSingle();
  const roleIds = (dbUser?.role_ids as string[]) || [];
  if (roleIds.length === 0) return false;
  const { data: roles } = await admin.from('roles').select('code').in('id', roleIds);
  return roles?.some((r: { code: string }) => r.code === 'super_admin') ?? false;
}

async function assertWechatUseridFree(
  admin: ReturnType<typeof createClient>,
  wechatUserid: string,
  exceptUserId?: string,
) {
  const { data: rows } = await admin
    .from('users')
    .select('id, username')
    .eq('wechat_work_userid', wechatUserid)
    .limit(1);
  const existing = rows?.[0];
  if (existing && existing.id !== exceptUserId) {
    throw new Error(`该企业微信账号已绑定用户「${existing.username || existing.id}」`);
  }
}

Deno.serve(async (req) => {
  _reqOrigin = req.headers.get('origin');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { ...getCorsHeaders(_reqOrigin), 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
  }
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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
      const proxyOn = Boolean(
        (bundle?.proxy_url && bundle?.proxy_secret) ||
          (Deno.env.get('WECHAT_WORK_PROXY_URL') && Deno.env.get('WECHAT_WORK_PROXY_SECRET')),
      );
      return json({
        ok: true,
        corp_id: bundle?.corp_id ?? '',
        agent_id: bundle?.agent_id ?? '',
        redirect_uri: bundle?.redirect_uri ?? '',
        configured: Boolean(bundle?.corp_secret),
        proxy_configured: proxyOn,
      });
    }

    const bundle = await resolveWechatWorkBundle(admin);
    if (!bundle?.corp_secret) {
      return json({ error: '企业微信未配置，请在 API 密钥中心填写 wechat_work' }, 503);
    }

    const proxyOn = Boolean(
      (bundle.proxy_url && bundle.proxy_secret) ||
        (Deno.env.get('WECHAT_WORK_PROXY_URL') && Deno.env.get('WECHAT_WORK_PROXY_SECRET')),
    );
    if (!proxyOn) {
      return json({
        success: false,
        message:
          '企业微信 API 须经固定 IP 代理访问。请在 Supabase Edge Secrets 或 wechat_work JSON 配置 proxy_url / proxy_secret，并执行 scripts/set-wechat-proxy-edge-secrets.sh',
      });
    }

    if (action === 'login') {
      const code = String(body.code ?? '');
      if (!code) return json({ error: '缺少 code' }, 400);

      const member = await resolveMemberByOAuthCode(bundle, code);
      const { user: dbUser, matchBy, ambiguous } = await findUserByWechatMember(admin, member);

      if (ambiguous) {
        const hint = matchBy === 'phone' ? '手机号' : '姓名';
        return json({
          success: false,
          message: `企业微信返回的${hint}对应多个系统账号，请联系管理员核对用户资料`,
          wechat_userid: member.userid,
          wechat_name: member.name,
        });
      }
      if (!dbUser) {
        return json({
          success: false,
          message: '未找到匹配的系统账号：请确认用户管理中「手机号」或「姓名」与企微成员一致（不使用邮箱匹配）',
          wechat_userid: member.userid,
          wechat_name: member.name,
        });
      }
      if (dbUser.status === 'disabled') {
        return json({ success: false, message: '账号已禁用，请联系管理员' });
      }

      const authEmail = resolveAuthEmail(dbUser);
      if (!authEmail) {
        return json({
          success: false,
          message: '匹配到用户但未配置登录凭证，请联系管理员在用户资料中设置内部邮箱',
        });
      }

      await admin
        .from('users')
        .update({
          wechat_work_userid: member.userid,
          wechat_work_name: member.name,
          last_login_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', dbUser.id);

      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email: authEmail,
      });
      if (linkErr) throw linkErr;
      const tokenHash = linkData.properties?.hashed_token;
      if (!tokenHash) throw new Error('无法生成登录凭证');

      const session = await establishSessionFromTokenHash(supabaseUrl, anonKey, tokenHash);

      return json({
        success: true,
        message: '登录成功',
        email: authEmail,
        token_hash: tokenHash,
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        match_by: matchBy,
        user: {
          id: dbUser.id,
          username: dbUser.username,
          wechat_userid: member.userid,
          wechat_name: member.name,
        },
      });
    }

    if (action === 'resolveUser') {
      const userid = String(body.wechat_work_userid ?? body.userid ?? '');
      if (!userid) return json({ error: '缺少 wechat_work_userid' }, 400);
      const token = await fetchWechatAccessToken(bundle);
      const member = await fetchWechatMember(token, userid);
      return json({ ok: true, member });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: '未授权' }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !authData.user) return json({ error: '登录已失效' }, 401);

    if (action === 'bind') {
      const targetUserId = String(body.targetUserId ?? '');
      const wechatUserid = String(body.wechat_work_userid ?? '').trim();
      const wechatName = String(body.wechat_work_name ?? '').trim();
      if (!targetUserId || !wechatUserid) {
        return json({ error: '缺少 targetUserId 或 wechat_work_userid' }, 400);
      }

      const isSuper = await requireSuperAdmin(admin, authData.user.id);
      if (!isSuper && targetUserId !== authData.user.id) {
        return json({ error: '需要超级管理员权限' }, 403);
      }

      await assertWechatUseridFree(admin, wechatUserid, targetUserId);

      let name = wechatName;
      if (!name) {
        const token = await fetchWechatAccessToken(bundle);
        const member = await fetchWechatMember(token, wechatUserid);
        name = member.name;
      }

      const { error: upErr } = await admin
        .from('users')
        .update({
          wechat_work_userid: wechatUserid,
          wechat_work_name: name,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetUserId);

      if (upErr) throw upErr;
      return json({ ok: true, wechat_work_userid: wechatUserid, wechat_work_name: name });
    }

    if (action === 'bindWithCode') {
      const code = String(body.code ?? '');
      const targetUserId = String(body.targetUserId ?? authData.user.id);
      if (!code) return json({ error: '缺少 code' }, 400);

      const isSuper = await requireSuperAdmin(admin, authData.user.id);
      if (!isSuper && targetUserId !== authData.user.id) {
        return json({ error: '需要超级管理员权限' }, 403);
      }

      const member = await resolveMemberByOAuthCode(bundle, code);
      await assertWechatUseridFree(admin, member.userid, targetUserId);

      const { error: upErr } = await admin
        .from('users')
        .update({
          wechat_work_userid: member.userid,
          wechat_work_name: member.name,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetUserId);

      if (upErr) throw upErr;
      return json({
        ok: true,
        wechat_work_userid: member.userid,
        wechat_work_name: member.name,
      });
    }

    if (action === 'unbind') {
      const targetUserId = String(body.targetUserId ?? authData.user.id);
      const isSuper = await requireSuperAdmin(admin, authData.user.id);
      if (!isSuper && targetUserId !== authData.user.id) {
        return json({ error: '需要超级管理员权限' }, 403);
      }

      const { error: upErr } = await admin
        .from('users')
        .update({
          wechat_work_userid: null,
          wechat_work_name: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetUserId);

      if (upErr) throw upErr;
      return json({ ok: true });
    }

    return json({ error: '未知 action' }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // 登录场景返回 200 + success:false，避免前端 invoke 只显示 non-2xx
    if (action === 'login') {
      return json({ success: false, message: msg });
    }
    return json({ error: msg }, 400);
  }
});
