import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js';
import { supabase, supabaseAnonKey, supabaseUrl } from '../supabase/client';
import {
  compactHtmlGatewayErrorMessage,
  underlyingNetworkMessage,
} from '../utils/httpErrorMessage';

/**
 * 解析文档转换服务基础 URL
 */
function resolveDocConvertServiceBaseUrl(): string | null {
  const baseUrl = typeof process !== 'undefined' ? process.env.DOC_CONVERT_SERVICE_BASE_URL : '';
  if (typeof baseUrl !== 'string' || !baseUrl.trim()) {
    return null;
  }
  return baseUrl.trim().replace(/\/$/, '');
}

/**
 * 直接调用自建文档转换服务
 */
async function invokeDocConvertServiceDirectly(
  body: Record<string, unknown>,
): Promise<{ data: unknown; error: Error | null }> {
  const baseUrl = resolveDocConvertServiceBaseUrl();
  if (!baseUrl) {
    return { data: null, error: new Error('未配置 DOC_CONVERT_SERVICE_BASE_URL') };
  }

  const url = `${baseUrl}/api/v1/convert`;
  const tokenResult = await resolveBearerForEdge(body);
  if ('error' in tokenResult) {
    return { data: null, error: new Error(tokenResult.error) };
  }

  try {
    // 设置超时时间（120秒）
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenResult.token}`,
        'x-client-info': 'ciond-contract-convert-direct',
      },
      body: JSON.stringify(body),
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { error: text || `HTTP ${res.status}` };
    }

    if (!res.ok) {
      const d = data && typeof data === 'object' ? (data as { message?: string; error?: string; code?: string }) : {};
      const msg = d.message || d.error || `文档转换服务返回 HTTP ${res.status}`;
      return { data, error: new Error(`${compactHtmlGatewayErrorMessage(msg)} [请求: ${url}]`) };
    }

    return { data, error: null };
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      return { data: null, error: new Error('文档转换请求超时（120秒）') };
    }
    const networkError = new FunctionsFetchError({ cause: e, url });
    const msg = await describeSupabaseInvokeError(networkError);
    return { data: null, error: new Error(msg) };
  }
}

/** Edge Function `contract-document-convert` 返回的能力说明 */
export type ConvertCapabilitiesResponse = {
  ok: boolean;
  /** 已登录时为 UUID；未登录（anon 调用 capabilities）为 null */
  user_id: string | null;
  webhook_configured: boolean;
  checklist: Record<string, string[]>;
  hint: string;
  orchestration_ready?: boolean;
  service_role_configured?: boolean;
  /** 实际生效的 Secret 名，便于区分 SUPABASE_SERVICE_ROLE_KEY 与别名 APP_SERVICE_ROLE_KEY */
  service_role_env_used?: 'SUPABASE_SERVICE_ROLE_KEY' | 'APP_SERVICE_ROLE_KEY' | null;
  doc_convert_service_base_set?: boolean;
  doc_convert_webhook_url_set?: boolean;
  orchestration_invoke_url?: string | null;
};

/**
 * 构建时可选：SUPABASE_FUNCTIONS_URL
 * - **未设置**：使用 `supabase.functions.invoke` 直连 `SUPABASE_URL`（与 createClient 同源），由 SDK 正确附带 JWT，**推荐**，可避免 Nginx 反代改写/丢失 Authorization。
 * - 相对路径：`/supabase/functions/v1`（经本站 Nginx 反代到 Supabase，仅在你确认反代头无误时使用）
 * - 绝对地址：`https://…/functions/v1`
 */
function resolveFunctionsBaseOverride(): string | null {
  const raw = typeof process !== 'undefined' ? process.env.SUPABASE_FUNCTIONS_URL : '';
  if (typeof raw !== 'string' || !raw.trim()) {
    return null;
  }
  const t = raw.trim().replace(/\/$/, '');
  if (t.startsWith('http://') || t.startsWith('https://')) return t;
  if (t.startsWith('/')) {
    if (typeof window === 'undefined') return null;
    return `${window.location.origin}${t}`.replace(/\/$/, '');
  }
  return t;
}

/** 将 Supabase Functions 客户端错误转译为可操作的说明（含「Failed to send a request to the Edge Function」） */
export function humanizeConvertInvokeError(err: unknown): string {
  if (err instanceof FunctionsFetchError) {
    const detail = underlyingNetworkMessage(err.context);
    return [
      '浏览器无法连接到 Edge Function「contract-document-convert」（请求在到达服务器前失败，常见于网络拦截、DNS、混合内容或地区性访问问题）。',
      '请确认：① 已执行 `supabase functions deploy contract-document-convert`；② 转换服务与 Edge 密钥已在控制台配置；③ 若仅 Functions 不可达：在 Nginx 为 Supabase 的 `functions/v1` 做 HTTPS 反代，构建变量 `SUPABASE_FUNCTIONS_URL` 可写绝对前缀（如 `https://你的域名/supabase/functions/v1`）或同源相对路径（如 `/supabase/functions/v1`）。',
      '在修复前可先用「上传 Word」写入 generated_docx_storage_path。',
      detail ? `技术细节：${detail}` : '',
    ]
      .filter(Boolean)
      .join(' ');
  }
  if (err instanceof FunctionsRelayError) {
    return 'Supabase 中继调用 Edge Function 失败。请到控制台查看 Functions 日志，确认函数未崩溃且区域可用。';
  }
  if (err instanceof Error) {
    if (err.message.includes('Failed to send a request to the Edge Function')) {
      return humanizeConvertInvokeError(new FunctionsFetchError((err as Error & { context?: unknown }).context));
    }
    return err.message;
  }
  return String(err);
}

type EdgeErrorJson = {
  message?: string;
  error?: string;
  code?: string;
  ok?: boolean;
};

/** 解析 `supabase.functions.invoke` 在 4xx/5xx 时抛出的 `FunctionsHttpError`（默认 message 过于笼统） */
async function describeSupabaseInvokeError(err: unknown): Promise<string> {
  if (err instanceof FunctionsHttpError) {
    const ctx = err.context;
    if (ctx instanceof Response) {
      const status = ctx.status;
      let text = '';
      try {
        text = await ctx.clone().text();
      } catch {
        return `Edge Function 返回 HTTP ${status}。`;
      }
      const trimmed = text.trim();
      if (trimmed) {
        const ct = (ctx.headers.get('content-type') || '').toLowerCase();
        if (ct.includes('application/json')) {
          try {
            const j = JSON.parse(trimmed) as EdgeErrorJson;
            if (j.code === 'NOT_CONFIGURED') {
              return (
                j.message ||
                '未设置 DOC_CONVERT_WEBHOOK_URL，无法原样转发 convert；若使用 docx_to_pdf 等编排能力，请在 Edge Secrets 中配置 DOC_CONVERT_SERVICE_BASE_URL 或 DOC_CONVERT_WEBHOOK_URL，并设置 SUPABASE_SERVICE_ROLE_KEY。'
              );
            }
            if (j.code === 'NO_SERVICE_ROLE') {
              return (
                j.message ||
                'Edge 未配置 SUPABASE_SERVICE_ROLE_KEY（或兼容别名 APP_SERVICE_ROLE_KEY），无法为转换服务生成签名 URL 或上传结果。请在 Supabase 控制台为该函数配置 Service Role Secret。'
              );
            }
            if (j.code === 'BAD_ORCHESTRATION_URL' || j.code === 'INVOKE_TRANSPORT_ERROR') {
              const raw = j.message || j.error || trimmed;
              return compactHtmlGatewayErrorMessage(String(raw));
            }
            const detail = j.message || j.error;
            if (detail) return `${compactHtmlGatewayErrorMessage(String(detail))}（HTTP ${status}）`;
            return `${compactHtmlGatewayErrorMessage(trimmed.slice(0, 800))}（HTTP ${status}）`;
          } catch {
            return `${compactHtmlGatewayErrorMessage(trimmed.slice(0, 800))}（HTTP ${status}）`;
          }
        } else {
          if (/contract-convert|dns error|Name or service not known/i.test(trimmed)) {
            return (
              `${compactHtmlGatewayErrorMessage(trimmed.slice(0, 500))}。` +
              '若 URL 为 http://contract-convert:8788，请改为 https://你的域名/api/contract-convert（Nginx 反代到本机 8788），并在 Supabase 更新 DOC_CONVERT_SERVICE_BASE_URL。'
            );
          }
          return `${compactHtmlGatewayErrorMessage(trimmed.slice(0, 800))}（HTTP ${status}）`;
        }
      }
      return `Edge Function 返回 HTTP ${status}。`;
    }
    return err.message;
  }
  return humanizeConvertInvokeError(err);
}

/**
 * 为需登录的 Edge 调用解析用户 access_token：优先与服务器对齐，必要时刷新。
 */
async function resolveUserAccessTokenForEdge(): Promise<{ token: string } | { error: string }> {
  const {
    data: { session: s0 },
  } = await supabase.auth.getSession();
  const now = Math.floor(Date.now() / 1000);
  const exp = s0?.expires_at;
  const stale = !s0?.access_token || (exp != null && exp < now + 90);
  if (stale && s0?.refresh_token) {
    const { data: ref, error } = await supabase.auth.refreshSession();
    if (!error && ref.session?.access_token) {
      return { token: ref.session.access_token };
    }
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (!userError && userData.user) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) return { token: session.access_token };
  }

  if (s0?.refresh_token) {
    const { data: ref, error } = await supabase.auth.refreshSession();
    if (!error && ref.session?.access_token) return { token: ref.session.access_token };
  }

  return { error: '登录已失效，请重新登录后再试文档转换' };
}

/** capabilities 允许未登录（Bearer 用 anon）；其余 action 须用户 JWT */
async function resolveBearerForEdge(body: Record<string, unknown>): Promise<{ token: string } | { error: string }> {
  if (body.action === 'capabilities') {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      const exp = session.expires_at;
      const now = Math.floor(Date.now() / 1000);
      const expiringSoon = exp != null && exp < now + 120;
      if (expiringSoon && session.refresh_token) {
        const { data: ref, error } = await supabase.auth.refreshSession();
        if (!error && ref.session?.access_token) return { token: ref.session.access_token };
      }
      return { token: session.access_token };
    }
    return { token: supabaseAnonKey };
  }
  return resolveUserAccessTokenForEdge();
}

async function invokeContractDocumentConvert(
  body: Record<string, unknown>,
): Promise<{ data: unknown; error: Error | null }> {
  const base = resolveFunctionsBaseOverride();

  const invokeWithCli = async (): Promise<{ data: unknown; error: unknown }> => {
    const tr = await resolveBearerForEdge(body);
    if ('error' in tr) return { data: null, error: new Error(tr.error) };
    return supabase.functions.invoke('contract-document-convert', {
      body,
      headers: {
        Authorization: `Bearer ${tr.token}`,
        'x-client-info': 'ciond-contract-convert',
      },
    });
  };

  if (!base) {
    let { data, error } = await invokeWithCli();
    if (
      error &&
      body.action !== 'capabilities' &&
      error instanceof FunctionsHttpError &&
      error.context instanceof Response &&
      error.context.status === 401
    ) {
      await supabase.auth.refreshSession();
      ({ data, error } = await invokeWithCli());
    }
    if (error) {
      const msg = await describeSupabaseInvokeError(error);
      return { data: null, error: new Error(msg) };
    }
    return { data, error: null };
  }

  const url = `${base.replace(/\/$/, '')}/contract-document-convert`;

  const fetchOnce = async (token: string) =>
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`,
        'x-client-info': 'ciond-contract-convert',
      },
      body: JSON.stringify(body),
      credentials: 'same-origin',
      cache: 'no-store',
    });

  const tokenResult = await resolveBearerForEdge(body);
  if ('error' in tokenResult) {
    return { data: null, error: new Error(tokenResult.error) };
  }

  let res: Response;
  try {
    res = await fetchOnce(tokenResult.token);
  } catch (e) {
    return { data: null, error: new FunctionsFetchError({ cause: e, url }) };
  }

  if (res.status === 401 && body.action !== 'capabilities') {
    const { data: ref, error: rErr } = await supabase.auth.refreshSession();
    if (!rErr && ref.session?.access_token) {
      try {
        res = await fetchOnce(ref.session.access_token);
      } catch (e) {
        return { data: null, error: new FunctionsFetchError({ cause: e, url }) };
      }
    }
  }

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text || `HTTP ${res.status}` };
  }

  if (!res.ok) {
    const d = data && typeof data === 'object' ? (data as { message?: string; error?: string; code?: string }) : {};
    const msg = d.message || d.error || `Edge Function 返回 HTTP ${res.status}`;
    let hint = msg;
    if (res.status === 404 && String(d.code || '').includes('NOT_FOUND')) {
      hint = `${msg}（请确认已在该项目执行：supabase functions deploy contract-document-convert）`;
    }
    if (res.status === 401 && (msg === '登录已失效' || msg.includes('未授权'))) {
      hint = `${msg}。请重新登录后再试；若已登录仍失败，请刷新页面以同步会话。`;
    }
    return { data, error: new Error(`${hint} [请求: ${url}]`) };
  }

  return { data, error: null };
}

/**
 * 查询文档转换网关状态（不执行转换）。
 * 如果配置了 DOC_CONVERT_SERVICE_BASE_URL，则直接调用；否则使用 Edge Function。
 */
export async function fetchConvertCapabilities(): Promise<ConvertCapabilitiesResponse> {
  const baseUrl = resolveDocConvertServiceBaseUrl();
  
  // 如果配置了直接调用模式
  if (baseUrl) {
    try {
      const url = `${baseUrl}/api/v1/capabilities`;
      const tokenResult = await resolveBearerForEdge({ action: 'capabilities' });
      if ('error' in tokenResult) {
        throw new Error(tokenResult.error);
      }
      
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${tokenResult.token}`,
          'x-client-info': 'ciond-contract-convert-direct',
        },
        credentials: 'same-origin',
        cache: 'no-store',
      });
      
      if (!res.ok) {
        throw new Error(`文档转换服务返回 HTTP ${res.status}`);
      }
      
      const data = await res.json();
      return data as ConvertCapabilitiesResponse;
    } catch (error) {
      // 如果直接调用失败，尝试回退到 Edge Function（如果配置了的话）
      if (supabaseUrl && supabaseAnonKey) {
        const { data, error: edgeError } = await invokeContractDocumentConvert({ action: 'capabilities' });
        if (edgeError) throw new Error(humanizeConvertInvokeError(edgeError));
        if (data && typeof data === 'object' && 'error' in data) {
          throw new Error(String((data as { error: string }).error));
        }
        return data as ConvertCapabilitiesResponse;
      }
      throw error;
    }
  } 
  // 否则使用 Edge Function
  else if (supabaseUrl && supabaseAnonKey) {
    const { data, error } = await invokeContractDocumentConvert({ action: 'capabilities' });
    if (error) throw new Error(humanizeConvertInvokeError(error));
    if (data && typeof data === 'object' && 'error' in data) {
      throw new Error(String((data as { error: string }).error));
    }
    return data as ConvertCapabilitiesResponse;
  }
  
  throw new Error('未配置文档转换服务（DOC_CONVERT_SERVICE_BASE_URL）或 Supabase Edge Function（SUPABASE_URL / SUPABASE_ANON_KEY）');
}

/** 编排型转换成功时 Edge 返回（写回 Storage 后） */
export type ConvertOrchestrationOk = {
  ok: true;
  output_path: string;
  bucket: string;
  caller_user_id?: string;
};

/**
 * 调用文档转换服务。
 * 如果配置了 DOC_CONVERT_SERVICE_BASE_URL，则直接调用自建服务；否则使用 Edge Function。
 * - `convert`：原样 JSON 转发到文档转换服务。
 * - `docx_to_pdf` / `merge_pdf` / `fill_docx` / `pdf_stamp`：调用文档转换服务的对应功能。
 * - `docx_diff`：返回含 `unified_diff` 的 JSON。
 */
export async function invokeConvert(body: Record<string, unknown>): Promise<unknown> {
  const baseUrl = resolveDocConvertServiceBaseUrl();
  
  // 如果配置了直接调用模式
  if (baseUrl) {
    const { data, error } = await invokeDocConvertServiceDirectly(body);
    if (error) {
      if (data && typeof data === 'object') {
        const d = data as { message?: string; error?: string };
        const msg = d.message || d.error;
        if (msg) throw new Error(compactHtmlGatewayErrorMessage(String(msg)));
      }
      throw error;
    }
    
    if (data && typeof data === 'object' && 'ok' in data && (data as { ok: boolean }).ok === false) {
      const d = data as { message?: string; code?: string; error?: string };
      const rawMsg = d.message || d.error || '转换未配置';
      const err = new Error(compactHtmlGatewayErrorMessage(String(rawMsg))) as Error & { code?: string };
      err.code = d.code;
      throw err;
    }
    
    return data;
  } 
  // 否则使用 Edge Function
  else if (supabaseUrl && supabaseAnonKey) {
    const { data, error } = await invokeContractDocumentConvert(body);
    if (error) {
      if (data && typeof data === 'object') {
        const d = data as { message?: string; error?: string };
        const msg = d.message || d.error;
        if (msg) throw new Error(compactHtmlGatewayErrorMessage(String(msg)));
      }
      throw new Error(humanizeConvertInvokeError(error));
    }
    
    if (data && typeof data === 'object' && 'ok' in data && (data as { ok: boolean }).ok === false) {
      const d = data as { message?: string; code?: string; error?: string };
      const rawMsg = d.message || d.error || '转换未配置';
      const err = new Error(compactHtmlGatewayErrorMessage(String(rawMsg))) as Error & { code?: string };
      err.code = d.code;
      throw err;
    }
    
    return data;
  }
  
  throw new Error('未配置文档转换服务（DOC_CONVERT_SERVICE_BASE_URL）或 Supabase Edge Function（SUPABASE_URL / SUPABASE_ANON_KEY）');
}
