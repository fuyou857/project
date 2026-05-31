/**
 * 用户管理服务
 * 封装用户相关的 API 操作
 */

import { supabase } from '../supabase/client';
import { invokeAdminUserOps } from './adminUserOps';

export interface User {
  id: string;
  username: string;
  real_name: string | null;
  phone: string | null;
  email: string | null;
  company_id: string | null;
  role_ids: string[];
  project_ids: string[];
  status: 'active' | 'disabled';
  created_at: string;
  updated_at: string | null;
  last_login_at: string | null;
  wechat_work_userid?: string | null;
  wechat_work_name?: string | null;
  /** 前端缓存用：由 isSuperAdmin() 计算，非数据库列 */
  is_super_admin?: boolean;
}

export interface Role {
  id: string;
  name: string;
  code: string;
  description: string;
}

export interface Company {
  id: string;
  name: string;
  parent_id: string | null;
}

export interface Project {
  id: string;
  name: string;
}

/**
 * 获取所有用户列表
 */
export async function getUsers(): Promise<User[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data.map(user => ({
    ...user,
    role_ids: user.role_ids || [],
    project_ids: user.project_ids || []
  }));
}

/**
 * 获取单个用户
 */
export async function getUserById(userId: string): Promise<User | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select()
      .eq('id', userId)
      .limit(1);

    if (error) {
      console.error('获取用户失败:', error);
      if (error.code === 'PGRST116' || error.code === '404') return null;
      throw error;
    }

    if (!data || data.length === 0) return null;

    const user = data[0];
    return {
      ...user,
      role_ids: Array.isArray(user.role_ids) ? user.role_ids : [],
      project_ids: Array.isArray(user.project_ids) ? user.project_ids : []
    };
  } catch (error) {
    console.error('getUserById 异常:', error);
    return null;
  }
}

/**
 * 获取所有角色
 */
export async function getRoles(): Promise<Role[]> {
  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .order('name');

  if (error) throw error;
  return data;
}

/**
 * 获取所有公司
 */
export async function getCompanies(): Promise<Company[]> {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .order('name');

  if (error) throw error;
  return data;
}

/**
 * 获取所有项目
 */
export async function getProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name')
    .order('name');

  if (error) throw error;
  return data;
}

/**
 * 创建新用户（Auth + public.users 由 Edge Function `admin-user-ops` 完成）
 */
export async function createUser(userData: {
  email?: string;
  password: string;
  username: string;
  real_name?: string;
  phone?: string;
  company_id?: string;
  role_ids: string[];
  project_ids: string[];
  status?: 'active' | 'disabled';
}): Promise<User> {
  const res = await invokeAdminUserOps<{ ok: boolean; userId: string }>({
    action: 'createUser',
    email: userData.email ?? '',
    password: userData.password,
    username: userData.username,
    real_name: userData.real_name ?? null,
    phone: userData.phone ?? null,
    company_id: userData.company_id ?? null,
    role_ids: userData.role_ids,
    project_ids: userData.project_ids,
    status: userData.status || 'active',
  });

  if (!res?.ok || !res.userId) {
    throw new Error('创建用户失败');
  }

  const created = await getUserById(res.userId);
  if (!created) {
    throw new Error('创建用户成功但无法读取用户资料');
  }
  return created;
}

/**
 * 更新用户信息
 */
export async function updateUser(userId: string, userData: {
  real_name?: string;
  phone?: string;
  email?: string;
  company_id?: string;
  role_ids?: string[];
  project_ids?: string[];
  status?: 'active' | 'disabled';
  wechat_work_userid?: string | null;
  wechat_work_name?: string | null;
}): Promise<User> {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString()
  };

  if (userData.real_name !== undefined) updateData.real_name = userData.real_name || null;
  if (userData.phone !== undefined) updateData.phone = userData.phone || null;
  if (userData.email !== undefined) updateData.email = userData.email || null;
  if (userData.company_id !== undefined) updateData.company_id = userData.company_id || null;
  if (userData.role_ids !== undefined) updateData.role_ids = userData.role_ids;
  if (userData.project_ids !== undefined) updateData.project_ids = userData.project_ids;
  if (userData.status !== undefined) updateData.status = userData.status;
  if (userData.wechat_work_userid !== undefined) {
    updateData.wechat_work_userid = userData.wechat_work_userid || null;
  }
  if (userData.wechat_work_name !== undefined) {
    updateData.wechat_work_name = userData.wechat_work_name || null;
  }

  const { error } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', userId);

  if (error) throw error;

  if (userData.email) {
    await invokeAdminUserOps<{ ok: boolean }>({
      action: 'updateAuthEmail',
      userId,
      email: userData.email,
    });
  }

  const updated = await getUserById(userId);
  if (!updated) {
    throw new Error('更新成功但无法读取用户资料');
  }
  return updated;
}

/**
 * 重置用户密码（Edge Function）
 */
export async function resetPassword(userId: string, newPassword: string): Promise<void> {
  const user = await getUserById(userId);
  if (!user) throw new Error('用户不存在');

  await invokeAdminUserOps<{ ok: boolean }>({
    action: 'resetPassword',
    userId,
    newPassword,
  });
}

/**
 * 删除用户（Edge Function：Auth + public.users）
 */
export async function deleteUser(userId: string): Promise<void> {
  const user = await getUserById(userId);
  if (!user) throw new Error('用户不存在');

  await invokeAdminUserOps<{ ok: boolean }>({
    action: 'deleteUser',
    userId,
  });
}

/**
 * 检查用户是否有关联数据
 */
export async function checkUserRelatedData(userId: string): Promise<string[]> {
  const warnings: string[] = [];

  const [projectsRes, invoicesRes, contractsRes] = await Promise.all([
    supabase.from('projects').select('id').eq('created_by', userId),
    supabase.from('income_invoices').select('id').eq('created_by', userId),
    supabase.from('income_contracts').select('id').eq('created_by', userId)
  ]);

  if (projectsRes.data && projectsRes.data.length > 0) {
    warnings.push(`创建了 ${projectsRes.data.length} 个项目`);
  }
  if (invoicesRes.data && invoicesRes.data.length > 0) {
    warnings.push(`创建了 ${invoicesRes.data.length} 条发票记录`);
  }
  if (contractsRes.data && contractsRes.data.length > 0) {
    warnings.push(`创建了 ${contractsRes.data.length} 份合同`);
  }

  return warnings;
}

/**
 * 判断是否为超级管理员（含历史 admin 角色码，用于菜单/删除等宽泛权限）
 */
export async function isSuperAdmin(user: User): Promise<boolean> {
  const { data: roles, error } = await supabase
    .from('roles')
    .select('id, code')
    .in('id', user.role_ids);

  if (error) {
    console.error('获取角色信息失败:', error);
    return false;
  }

  return (
    roles?.some(role => role.code === 'super_admin' || role.code === 'admin') ?? false
  );
}

/** 严格超管：仅 super_admin，用于 API 密钥中心等高危模块 */
export async function isStrictSuperAdmin(user: User): Promise<boolean> {
  const { data: roles, error } = await supabase
    .from('roles')
    .select('id, code')
    .in('id', user.role_ids);

  if (error) {
    console.error('获取角色信息失败:', error);
    return false;
  }

  return roles?.some(role => role.code === 'super_admin') ?? false;
}

/**
 * 判断是否为管理员（有管理权限）
 */
export function isAdmin(user: User): boolean {
  return user.role_ids.some(id => id.toLowerCase().includes('admin'));
}
