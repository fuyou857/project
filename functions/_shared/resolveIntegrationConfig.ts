/**
 * 从密钥中心解析各业务集成配置（Edge 专用）
 * 优先级：system_api_keys → Deno.env
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { getSystemApiEndpoint, getSystemApiKey } from './systemApiKeys.ts';
import { buildWechatWorkBundle, readFirstEnv } from './systemApiKeyRegistry.ts';

export type DocConvertConfig = {
  serviceBaseUrl: string | null;
  webhookUrl: string | null;
  webhookSecret: string | null;
};

export async function resolveDocConvertConfig(admin: SupabaseClient): Promise<DocConvertConfig> {
  const [baseEp, webhookEp, secretRow] = await Promise.all([
    getSystemApiEndpoint(admin, 'doc_convert_service_base'),
    getSystemApiEndpoint(admin, 'doc_convert_webhook_url'),
    getSystemApiKey(admin, 'doc_convert_webhook_secret'),
  ]);

  return {
    serviceBaseUrl:
      baseEp?.replace(/\/$/, '') ||
      readFirstEnv(['DOC_CONVERT_SERVICE_BASE_URL', 'DOC_CONVERT_WEBHOOK_URL'])?.replace(/\/$/, '') ||
      null,
    webhookUrl:
      webhookEp?.replace(/\/$/, '') ||
      readFirstEnv(['DOC_CONVERT_WEBHOOK_URL'])?.replace(/\/$/, '') ||
      null,
    webhookSecret:
      secretRow?.secret ||
      readFirstEnv(['DOC_CONVERT_WEBHOOK_SECRET', 'CONTRACT_CONVERT_SECRET']) ||
      null,
  };
}

export function resolveInvokeUrlFromConfig(cfg: DocConvertConfig): string | null {
  const raw = cfg.serviceBaseUrl || cfg.webhookUrl;
  if (!raw) return null;
  const b = raw.replace(/\/$/, '');
  if (b.endsWith('/invoke')) return b;
  return `${b}/invoke`;
}

export type WechatWorkBundle = {
  corp_id: string;
  agent_id: string;
  redirect_uri: string;
  corp_secret: string;
  /** 固定 IP 中转，如 https://www.ciond.com/api/wechat-work-proxy */
  proxy_url?: string;
  proxy_secret?: string;
};

export async function resolveWechatWorkBundle(admin: SupabaseClient): Promise<WechatWorkBundle | null> {
  const row = await getSystemApiKey(admin, 'wechat_work');
  if (row?.secret) {
    try {
      const parsed = JSON.parse(row.secret) as WechatWorkBundle;
      if (parsed.corp_secret || parsed.corp_id) {
        return {
          ...parsed,
          proxy_url: parsed.proxy_url?.trim() || readFirstEnv(['WECHAT_WORK_PROXY_URL']) || undefined,
          proxy_secret: parsed.proxy_secret?.trim() || readFirstEnv(['WECHAT_WORK_PROXY_SECRET']) || undefined,
        };
      }
    } catch {
      /* 非 JSON 时视为纯 corpsecret */
      return {
        corp_id: readFirstEnv(['WECHAT_WORK_CORP_ID']) ?? '',
        agent_id: readFirstEnv(['WECHAT_WORK_AGENT_ID']) ?? '',
        redirect_uri: row.apiUrl ?? readFirstEnv(['WECHAT_WORK_REDIRECT_URI']) ?? '',
        corp_secret: row.secret,
      };
    }
  }
  const fromEnv = buildWechatWorkBundle();
  if (!fromEnv?.secret) return null;
  try {
    return JSON.parse(fromEnv.secret) as WechatWorkBundle;
  } catch {
    return null;
  }
}
