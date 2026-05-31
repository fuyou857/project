export interface StoredUser {
  id?: string;
  role?: string;
  role_ids?: string[];
  username?: string;
  real_name?: string;
  email?: string;
}

/**
 * 从 localStorage 读取当前登录用户的 UI 缓存。
 *
 * ⚠️ 安全说明：
 *   此数据仅用于前端 UI 展示（如菜单显隐、用户名显示），
 *   不得用于任何后端权限判断。所有后端操作均受 Supabase RLS
 *   策略保护，不受 localStorage 数据影响。用户篡改此缓存
 *   最多导致看到的 UI 与实际权限不匹配，无法执行未授权的后端操作。
 */
export function getStoredUser(): StoredUser {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredUser;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    localStorage.removeItem('user');
    return {};
  }
}

/** 仅用于前端 UI 判断，后端权限由 Supabase RLS 保证 */
export function isSuperAdminUser(): boolean {
  const user = getStoredUser();
  return user.role === 'super_admin' || Boolean(user.role_ids?.includes('super_admin'));
}
