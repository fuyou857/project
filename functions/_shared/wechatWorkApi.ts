import type { WechatWorkBundle } from './resolveIntegrationConfig.ts';
import { readFirstEnv } from './systemApiKeyRegistry.ts';

const QYAPI_ORIGIN = 'https://qyapi.weixin.qq.com';
const TOKEN_PATH = '/cgi-bin/gettoken';
const USER_INFO_PATH = '/cgi-bin/auth/getuserinfo';
const USER_DETAIL_PATH = '/cgi-bin/user/get';
const SEND_PATH = '/cgi-bin/message/send';

let cachedToken: { token: string; expiresAt: number; corpId: string } | null = null;

export type WechatMember = {
  userid: string;
  name: string;
  avatar?: string;
  email?: string;
  mobile?: string;
};

type ProxyConfig = { baseUrl: string; secret: string };

export function isWechatProxyConfigured(bundle?: WechatWorkBundle | null): boolean {
  return resolveProxyConfig(bundle) !== null;
}

function resolveProxyConfig(bundle?: WechatWorkBundle | null): ProxyConfig | null {
  const ext = bundle as (WechatWorkBundle & { proxy_url?: string; proxy_secret?: string }) | null | undefined;
  if (ext?.proxy_url?.trim() && ext?.proxy_secret?.trim()) {
    return { baseUrl: ext.proxy_url.trim().replace(/\/$/, ''), secret: ext.proxy_secret.trim() };
  }
  const secret = readFirstEnv(['WECHAT_WORK_PROXY_SECRET']);
  const base =
    readFirstEnv(['WECHAT_WORK_PROXY_URL']) ||
    (secret ? 'https://www.ciond.com/api/wechat-work-proxy' : null);
  if (base && secret) {
    return { baseUrl: base.replace(/\/$/, ''), secret };
  }
  return null;
}

/** 经固定 IP 代理或直连企微 API */
export async function qyapiRequest(
  path: string,
  init: RequestInit = {},
  bundle?: WechatWorkBundle | null,
): Promise<Response> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const proxy = resolveProxyConfig(bundle);
  const headers = new Headers(init.headers || {});
  let url: string;
  if (proxy) {
    url = `${proxy.baseUrl}${normalizedPath}`;
    headers.set('X-Wechat-Proxy-Secret', proxy.secret);
  } else {
    url = `${QYAPI_ORIGIN}${normalizedPath}`;
  }
  return fetch(url, { ...init, headers });
}

export async function fetchWechatAccessToken(bundle: WechatWorkBundle): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.corpId === bundle.corp_id && now < cachedToken.expiresAt) {
    return cachedToken.token;
  }
  const params = new URLSearchParams({ corpid: bundle.corp_id, corpsecret: bundle.corp_secret });
  const res = await qyapiRequest(`${TOKEN_PATH}?${params}`, { method: 'GET' }, bundle);
  const data = await res.json() as {
    errcode?: number;
    errmsg?: string;
    access_token?: string;
    expires_in?: number;
  };
  if (data.errcode !== 0 || !data.access_token) {
    throw new Error(data.errmsg || '获取企业微信 access_token 失败');
  }
  cachedToken = {
    token: data.access_token,
    expiresAt: now + (data.expires_in ?? 7200) * 1000 - 60_000,
    corpId: bundle.corp_id,
  };
  return cachedToken.token;
}

/** OAuth 扫码 code 换取成员 userid */
export async function fetchUserIdByOAuthCode(
  accessToken: string,
  code: string,
  bundle?: WechatWorkBundle | null,
): Promise<string> {
  const q = new URLSearchParams({ access_token: accessToken, code });
  const res = await qyapiRequest(`${USER_INFO_PATH}?${q}`, { method: 'GET' }, bundle);
  const data = await res.json() as { errcode?: number; errmsg?: string; userid?: string };
  if (data.errcode !== 0 || !data.userid) {
    throw new Error(data.errmsg || '企业微信授权码无效或已过期');
  }
  return data.userid;
}

export async function fetchWechatMember(
  accessToken: string,
  userid: string,
  bundle?: WechatWorkBundle | null,
): Promise<WechatMember> {
  const q = new URLSearchParams({ access_token: accessToken, userid });
  const res = await qyapiRequest(`${USER_DETAIL_PATH}?${q}`, { method: 'GET' }, bundle);
  const data = await res.json() as {
    errcode?: number;
    errmsg?: string;
    userid?: string;
    name?: string;
    avatar?: string;
    email?: string;
    mobile?: string;
  };
  if (data.errcode !== 0 || !data.userid) {
    throw new Error(data.errmsg || '获取企业微信成员详情失败');
  }
  return {
    userid: data.userid,
    name: data.name || data.userid,
    avatar: data.avatar,
    email: data.email,
    mobile: data.mobile,
  };
}

export async function sendWechatMessage(
  accessToken: string,
  message: Record<string, unknown>,
  bundle?: WechatWorkBundle | null,
): Promise<unknown> {
  const q = new URLSearchParams({ access_token: accessToken });
  const res = await qyapiRequest(`${SEND_PATH}?${q}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  }, bundle);
  return res.json();
}

export async function resolveMemberByOAuthCode(
  bundle: WechatWorkBundle,
  code: string,
): Promise<WechatMember> {
  const token = await fetchWechatAccessToken(bundle);
  const userid = await fetchUserIdByOAuthCode(token, code, bundle);
  return fetchWechatMember(token, userid, bundle);
}
