/**
 * 企微 / 钉钉 / Webhook / REST+OAuth 契约与占位实现。
 * 实际令牌交换、签名与投递应在服务端（Supabase Edge Function 或自建网关）完成，避免密钥进前端 bundle。
 */

export type WebhookTaskEvent =
  | 'task.created'
  | 'task.updated'
  | 'task.progress'
  | 'task.completed'
  | 'task.acceptance_requested'
  | 'task.acceptance_result';

export interface WebhookPayload {
  event: WebhookTaskEvent;
  occurred_at: string;
  data: Record<string, unknown>;
}

export interface OAuth2TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

/** 预留：从自建授权服务用授权码换 token（非浏览器直连第三方 OAuth） */
export async function exchangeOAuthCodePlaceholder(_params: {
  grant_type: 'authorization_code';
  code: string;
  redirect_uri: string;
}): Promise<OAuth2TokenResponse> {
  throw new Error('OAuth 令牌交换未配置：请在服务端实现并改为调用您的 /oauth/token');
}

/**
 * 预留：向 integration_webhooks 表中配置的地址投递事件。
 * 生产环境应由 Edge Function 读取 secret、计算签名后 POST。
 */
export async function deliverWebhookEventPlaceholder(_payload: WebhookPayload): Promise<void> {
  /*  intentionally no-op in browser */
}
