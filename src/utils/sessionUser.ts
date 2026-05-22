export interface StoredUser {
  id?: string;
  role?: string;
  role_ids?: string[];
  username?: string;
  real_name?: string;
  email?: string;
}

/** 从 localStorage 读取当前登录用户（与合同/结算等页原逻辑一致） */
export function getStoredUser(): StoredUser {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}') as StoredUser;
  } catch {
    return {};
  }
}

export function isSuperAdminUser(): boolean {
  const user = getStoredUser();
  return user.role === 'super_admin' || Boolean(user.role_ids?.includes('super_admin'));
}
