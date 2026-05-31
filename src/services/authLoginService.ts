import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';

type LoginEdgeResponse = {
  success?: boolean;
  error?: string;
  access_token?: string;
  refresh_token?: string;
};

async function describeLoginInvokeError(err: unknown): Promise<string> {
  if (err instanceof FunctionsHttpError && err.context instanceof Response) {
    try {
      const j = (await err.context.clone().json()) as { error?: string };
      if (j.error) return j.error;
    } catch {
      /* ignore */
    }
    if (err.context.status === 404) {
      return '登录服务未部署，请执行 Edge Function login 部署';
    }
    return `登录服务异常（HTTP ${err.context.status}）`;
  }
  return err instanceof Error ? err.message : '登录失败';
}

/** 密码重置走 Supabase Auth 后，兼容未部署新版 login Edge：按内部邮箱尝试登录 */
async function tryDirectAuthLogin(account: string, password: string): Promise<Error | null> {
  const trimmed = account.trim();
  const emails = trimmed.includes('@')
    ? [trimmed]
    : [`${trimmed}@ciond.com`, `${trimmed}@internal.ciond.local`];

  let lastMsg = '用户名或手机号不存在，或密码错误';
  for (const email of emails) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) return null;
    lastMsg = error.message;
  }
  return new Error(lastMsg);
}

function isPhoneAccount(account: string): boolean {
  const digits = account.replace(/\D/g, '');
  return digits.length === 11 && /^1\d{10}$/.test(digits);
}

/** 用户名或手机号 + 密码（用户名先走 Supabase Auth，与 reset-super-admin 一致） */
export async function signInWithAccount(
  account: string,
  password: string,
): Promise<{ error: Error | null }> {
  const trimmed = account.trim();
  if (!trimmed || !password) {
    return { error: new Error('请输入用户名或手机号和密码') };
  }

  // 用户名登录：优先直连 Auth（admin → admin@ciond.com），避免旧版 login Edge 查库明文密码
  if (!isPhoneAccount(trimmed)) {
    const directErr = await tryDirectAuthLogin(trimmed, password);
    if (!directErr) return { error: null };
  }

  const { data, error } = await supabase.functions.invoke<LoginEdgeResponse>('login', {
    body: { account: trimmed, username: trimmed, password },
  });

  const edgeMsg = data?.error || (error ? await describeLoginInvokeError(error) : '');
  const hasSession = Boolean(data?.access_token && data?.refresh_token && data?.success !== false);

  if (hasSession) {
    const { error: sessionErr } = await supabase.auth.setSession({
      access_token: data!.access_token!,
      refresh_token: data!.refresh_token!,
    });
    if (sessionErr) {
      return { error: new Error(sessionErr.message || '建立会话失败') };
    }
    return { error: null };
  }

  if (!isPhoneAccount(trimmed)) {
    const directErr = await tryDirectAuthLogin(trimmed, password);
    if (!directErr) return { error: null };
    return { error: directErr };
  }

  if (edgeMsg) return { error: new Error(edgeMsg) };
  return { error: new Error('用户名或手机号不存在，或密码错误') };
}
