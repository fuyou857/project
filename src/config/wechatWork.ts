export interface WechatWorkConfig {
  corpId: string;
  agentId: string;
  redirectUri: string;
  authScope: string;
}

export const WECHAT_WORK_CONFIG: WechatWorkConfig = {
  corpId: process.env.WECHAT_WORK_CORP_ID || 'wwea223b1a3cc25eeb',
  agentId: process.env.WECHAT_WORK_AGENT_ID || '1000026',
  redirectUri: process.env.WECHAT_WORK_REDIRECT_URI || 'https://www.ciond.com/login',
  authScope: 'snsapi_base',
};

export const WECHAT_WORK_API = {
  qrcodeUrl: 'https://open.work.weixin.qq.com/wwopen/sso/qrConnect',
  accessTokenUrl: 'https://qyapi.weixin.qq.com/cgi-bin/gettoken',
  userInfoUrl: 'https://qyapi.weixin.qq.com/cgi-bin/user/getuserinfo',
  userDetailUrl: 'https://qyapi.weixin.qq.com/cgi-bin/user/get',
  sendMessageUrl: 'https://qyapi.weixin.qq.com/cgi-bin/message/send',
};

export function buildAuthUrl(options?: { state?: string }): string {
  const config = WECHAT_WORK_CONFIG;
  const params = new URLSearchParams({
    appid: config.corpId,
    agentid: config.agentId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: config.authScope,
    state: options?.state || 'login',
  });
  return `${WECHAT_WORK_API.qrcodeUrl}?${params.toString()}`;
}

export function validateWechatWorkConfig(): boolean {
  const { corpId, agentId, redirectUri } = WECHAT_WORK_CONFIG;
  
  if (!corpId || corpId === 'your_corp_id_here') {
    console.error('WECHAT_WORK_CORP_ID 未配置');
    return false;
  }
  
  if (!agentId || agentId === 'your_agent_id_here') {
    console.error('WECHAT_WORK_AGENT_ID 未配置');
    return false;
  }
  
  if (!redirectUri || redirectUri === 'your_redirect_uri_here') {
    console.error('WECHAT_WORK_REDIRECT_URI 未配置');
    return false;
  }
  
  return true;
}