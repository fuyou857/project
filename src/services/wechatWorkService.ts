import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';
import { buildAuthUrl, validateWechatWorkConfig } from '../config/wechatWork';

export { validateWechatWorkConfig } from '../config/wechatWork';

export type WechatWorkPublicConfig = {
  corp_id: string;
  agent_id: string;
  redirect_uri: string;
  configured: boolean;
};

export type WechatWorkUserInfo = {
  userid: string;
  name: string;
  avatar?: string;
  email?: string;
  mobile?: string;
};

export type WechatWorkLoginResult = {
  success: boolean;
  message: string;
  email?: string;
  token_hash?: string;
  access_token?: string;
  refresh_token?: string;
  user?: {
    id: string;
    username?: string;
    wechat_userid?: string;
    wechat_name?: string;
  };
  wechat_userid?: string;
  wechat_name?: string;
};

type AuthInvokeBody = Record<string, unknown> & { error?: string; message?: string };

async function describeWechatWorkInvokeError(err: unknown): Promise<string> {
  if (err instanceof FunctionsHttpError && err.context instanceof Response) {
    const res = err.context;
    try {
      const j = (await res.clone().json()) as { error?: string; message?: string };
      const detail = j.message || j.error;
      if (detail) {
        if (/invalid corpid/i.test(detail)) {
          return '企业微信 CorpID 无效：请在 API 密钥中心将 wechat_work 的 corp_id 改为企微后台的真实企业 ID（勿用文档占位符）';
        }
        if (/invalid secret|corpsecret/i.test(detail)) {
          return '企业微信应用 Secret 无效：请核对 API 密钥中心 wechat_work 中的 corp_secret';
        }
        return detail;
      }
    } catch {
      /* ignore */
    }
    return `企业微信服务异常（HTTP ${res.status}）`;
  }
  return err instanceof Error ? err.message : 'wechat-work-auth 调用失败';
}

async function invokeWechatWorkAuth<T extends AuthInvokeBody>(body: Record<string, unknown>): Promise<T> {
  console.log('[wechatWorkService] 调用 wechat-work-auth Edge Function', body);
  const { data, error } = await supabase.functions.invoke<T>('wechat-work-auth', { body });
  console.log('[wechatWorkService] wechat-work-auth 返回', { data, error });
  if (error) throw new Error(await describeWechatWorkInvokeError(error));
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

export async function fetchWechatWorkPublicConfig(): Promise<WechatWorkPublicConfig | null> {
  console.log('[wechatWorkService] fetchWechatWorkPublicConfig 开始');
  try {
    const data = await invokeWechatWorkAuth<WechatWorkPublicConfig & { ok?: boolean }>({
      action: 'getPublicConfig',
    });
    console.log('[wechatWorkService] fetchWechatWorkPublicConfig 成功', data);
    return {
      corp_id: data.corp_id || '',
      agent_id: data.agent_id || '',
      redirect_uri: data.redirect_uri || '',
      configured: Boolean(data.configured),
    };
  } catch (err) {
    console.error('[wechatWorkService] fetchWechatWorkPublicConfig 失败', err);
    return null;
  }
}

export function getAuthUrl(state = 'login'): string {
  console.log('[wechatWorkService] getAuthUrl 开始', { state });
  if (!validateWechatWorkConfig()) {
    throw new Error('企业微信配置未完成');
  }
  const url = buildAuthUrl({ state });
  console.log('[wechatWorkService] getAuthUrl 返回', url);
  return url;
}

export function getOAuthCallbackParams(): { code: string; state: string } | null {
  console.log('[wechatWorkService] getOAuthCallbackParams 开始');
  console.log('[wechatWorkService] 当前完整URL:', window.location.href);
  console.log('[wechatWorkService] 当前search:', window.location.search);
  
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const state = urlParams.get('state') || 'login';
  const appid = urlParams.get('appid');
  
  console.log('[wechatWorkService] getOAuthCallbackParams 结果', { 
    code: code ? code.substring(0, 10) + '...' : null, 
    state,
    appid: appid ? appid.substring(0, 10) + '...' : null,
    hasCode: !!code,
    urlSearch: window.location.search 
  });
  
  if (!code) return null;
  return { code, state };
}

export function clearOAuthCallbackFromUrl(): void {
  const url = new URL(window.location.href);

  url.searchParams.delete('code');
  url.searchParams.delete('state');
  url.searchParams.delete('appid');

  // 保留 HashRouter 的 hash（如 #/login），仅清除 OAuth query 参数
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

export function isWechatWorkAuthCallback(): boolean {
  const p = getOAuthCallbackParams();
  return p !== null && !!p.code;
}

const WECHAT_LOGIN_CODE_DONE_KEY = 'wechat_work_login_code_done';
const loginInFlight = new Map<string, Promise<WechatWorkLoginResult>>();

function markOAuthCodeCompleted(code: string): void {
  console.log('[wechatWorkService] markOAuthCodeCompleted', code.substring(0, 10) + '...');
  try {
    sessionStorage.setItem(WECHAT_LOGIN_CODE_DONE_KEY, code);
  } catch {
    /* private mode / quota */
  }
}

function isOAuthCodeCompleted(code: string): boolean {
  try {
    const result = sessionStorage.getItem(WECHAT_LOGIN_CODE_DONE_KEY) === code;
    console.log('[wechatWorkService] isOAuthCodeCompleted', { code: code.substring(0, 10) + '...', result });
    return result;
  } catch {
    return false;
  }
}

async function establishSessionFromTokens(
  accessToken: string,
  refreshToken: string,
): Promise<string | null> {
  const { error: sessionErr } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return sessionErr?.message || null;
}

async function establishSessionFromMagicLink(tokenHash: string): Promise<string | null> {
  for (const type of ['magiclink', 'email'] as const) {
    const { data, error: otpErr } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (!otpErr && data.session) {
      return null;
    }
  }
  return '建立登录会话失败';
}

async function waitForSession(maxAttempts = 10, delayMs = 200): Promise<boolean> {
  console.log('[wechatWorkService] waitForSession 开始，最多尝试', maxAttempts, '次');
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { data: sessionData } = await supabase.auth.getSession();
    console.log('[wechatWorkService] waitForSession 尝试', attempt, '，session:', sessionData.session ? '存在' : '不存在');
    
    if (sessionData.session) {
      console.log('[wechatWorkService] waitForSession 成功');
      return true;
    }
    
    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  console.log('[wechatWorkService] waitForSession 超时');
  return false;
}

/** 扫码登录：code → Edge 校验绑定 → verifyOtp 建立 Supabase 会话 */
async function loginWithWechatWorkOnce(code: string): Promise<WechatWorkLoginResult> {
  console.log('[wechatWorkService] loginWithWechatWorkOnce 开始', code.substring(0, 10) + '...');

  const data = await invokeWechatWorkAuth<WechatWorkLoginResult>({
    action: 'login',
    code,
  });
  console.log('[wechatWorkService] loginWithWechatWorkOnce Edge 返回', data);

  if (!data.success) {
    return {
      success: false,
      message: data.message || '登录失败',
      wechat_userid: data.wechat_userid,
      wechat_name: data.wechat_name,
    };
  }

  let sessionError: string | null = null;
  if (data.access_token && data.refresh_token) {
    sessionError = await establishSessionFromTokens(data.access_token, data.refresh_token);
  } else if (data.token_hash) {
    sessionError = await establishSessionFromMagicLink(data.token_hash);
  } else {
    return { success: false, message: data.message || '登录失败：缺少会话凭证' };
  }

  if (sessionError) {
    return { success: false, message: sessionError || '建立登录会话失败' };
  }

  const sessionReady = await waitForSession();
  if (!sessionReady) {
    return { success: false, message: '登录会话写入失败，请重试' };
  }

  markOAuthCodeCompleted(code);
  clearOAuthCallbackFromUrl();

  return {
    success: true,
    message: data.message || '登录成功',
    email: data.email,
    user: data.user,
  };
}

export async function loginWithWechatWork(code: string): Promise<WechatWorkLoginResult> {
  console.log('[wechatWorkService] loginWithWechatWork 开始', code.substring(0, 10) + '...');
  const trimmed = code.trim();
  if (!trimmed) {
    return { success: false, message: '缺少授权 code' };
  }

  if (isOAuthCodeCompleted(trimmed)) {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session) {
      console.log('[wechatWorkService] 已处理过该 code，且已有会话');
      return { success: true, message: '登录成功' };
    }
    try {
      sessionStorage.removeItem(WECHAT_LOGIN_CODE_DONE_KEY);
    } catch {
      /* ignore */
    }
  }

  const existing = loginInFlight.get(trimmed);
  if (existing) {
    console.log('[wechatWorkService] 登录已在进行中，返回现有 Promise');
    return existing;
  }

  const promise = loginWithWechatWorkOnce(trimmed);
  loginInFlight.set(trimmed, promise);
  try {
    return await promise;
  } finally {
    loginInFlight.delete(trimmed);
  }
}

export async function resolveWechatWorkUser(wechatUserid: string): Promise<WechatWorkUserInfo> {
  console.log('[wechatWorkService] resolveWechatWorkUser 开始', wechatUserid);
  const data = await invokeWechatWorkAuth<{ ok: boolean; member: WechatWorkUserInfo }>({
    action: 'resolveUser',
    wechat_work_userid: wechatUserid,
  });
  console.log('[wechatWorkService] resolveWechatWorkUser 成功', data.member);
  return data.member;
}

export async function bindWechatWorkUser(
  targetUserId: string,
  wechatUserid: string,
  wechatName?: string,
): Promise<{ wechat_work_userid: string; wechat_work_name: string }> {
  console.log('[wechatWorkService] bindWechatWorkUser 开始', { targetUserId, wechatUserid, wechatName });
  const data = await invokeWechatWorkAuth<{
    ok: boolean;
    wechat_work_userid: string;
    wechat_work_name: string;
  }>({
    action: 'bind',
    targetUserId,
    wechat_work_userid: wechatUserid,
    wechat_work_name: wechatName || '',
  });
  console.log('[wechatWorkService] bindWechatWorkUser 成功', data);
  return {
    wechat_work_userid: data.wechat_work_userid,
    wechat_work_name: data.wechat_work_name,
  };
}

export async function bindWechatWorkWithCode(
  code: string,
  targetUserId?: string,
): Promise<{ wechat_work_userid: string; wechat_work_name: string }> {
  console.log('[wechatWorkService] bindWechatWorkWithCode 开始', { code: code.substring(0, 10) + '...', targetUserId });
  const data = await invokeWechatWorkAuth<{
    ok: boolean;
    wechat_work_userid: string;
    wechat_work_name: string;
  }>({
    action: 'bindWithCode',
    code,
    targetUserId,
  });
  console.log('[wechatWorkService] bindWechatWorkWithCode 成功', data);
  return {
    wechat_work_userid: data.wechat_work_userid,
    wechat_work_name: data.wechat_work_name,
  };
}

export async function unbindWechatWorkUser(targetUserId: string): Promise<void> {
  console.log('[wechatWorkService] unbindWechatWorkUser 开始', targetUserId);
  await invokeWechatWorkAuth({ action: 'unbind', targetUserId });
  console.log('[wechatWorkService] unbindWechatWorkUser 成功');
}
