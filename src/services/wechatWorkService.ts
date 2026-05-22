import { WECHAT_WORK_CONFIG, WECHAT_WORK_API, buildAuthUrl, validateWechatWorkConfig } from '../config/wechatWork';

export { validateWechatWorkConfig } from '../config/wechatWork';

export interface WechatWorkUserInfo {
  userid: string;
  name: string;
  avatar?: string;
  email?: string;
  mobile?: string;
}

export interface WechatWorkAuthResponse {
  code: string;
  state: string;
}

export interface WechatWorkLoginResult {
  success: boolean;
  message: string;
  token?: string;
  user?: WechatWorkUserInfo;
}

export function getAuthUrl(): string {
  if (!validateWechatWorkConfig()) {
    throw new Error('企业微信配置未完成');
  }
  return buildAuthUrl(WECHAT_WORK_CONFIG);
}

export function getAuthParamsFromUrl(): WechatWorkAuthResponse | null {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const state = urlParams.get('state');
  
  if (!code) {
    return null;
  }
  
  return {
    code,
    state: state || '',
  };
}

export async function exchangeCodeForToken(_code: string): Promise<{ accessToken: string; expiresIn: number }> {
  const response = await fetch(WECHAT_WORK_API.accessTokenUrl, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  const data = await response.json();
  
  if (data.errcode !== 0) {
    throw new Error(data.errmsg || '获取访问令牌失败');
  }
  
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
}

export async function getUserInfo(accessToken: string, code: string): Promise<WechatWorkUserInfo> {
  const url = `${WECHAT_WORK_API.userInfoUrl}?access_token=${accessToken}&code=${code}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  const data = await response.json();
  
  if (data.errcode !== 0) {
    throw new Error(data.errmsg || '获取用户信息失败');
  }
  
  return {
    userid: data.UserId,
    name: data.Name,
    avatar: data.Avatar,
    email: data.Email,
    mobile: data.Mobile,
  };
}

export async function getDetailedUserInfo(accessToken: string, userId: string): Promise<WechatWorkUserInfo> {
  const url = `${WECHAT_WORK_API.userDetailUrl}?access_token=${accessToken}&userid=${userId}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  const data = await response.json();
  
  if (data.errcode !== 0) {
    throw new Error(data.errmsg || '获取用户详情失败');
  }
  
  return {
    userid: data.userid,
    name: data.name,
    avatar: data.avatar,
    email: data.email,
    mobile: data.mobile,
  };
}

export async function loginWithWechatWork(code: string): Promise<WechatWorkLoginResult> {
  try {
    const { accessToken } = await exchangeCodeForToken(code);
    const userInfo = await getUserInfo(accessToken, code);
    
    const response = await fetch('/api/auth/wechat-work/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        userInfo,
      }),
    });
    
    const result = await response.json();
    
    if (!result.success) {
      return {
        success: false,
        message: result.message || '登录失败',
      };
    }
    
    return {
      success: true,
      message: '登录成功',
      token: result.token,
      user: result.user,
    };
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '登录失败',
    };
  }
}

export function isWechatWorkAuthCallback(): boolean {
  const params = getAuthParamsFromUrl();
  return params !== null && !!params.code;
}