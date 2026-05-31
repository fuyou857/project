import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import type { WechatMember } from './wechatWorkApi.ts';

export type DbAuthUser = {
  id: string;
  username: string;
  email: string | null;
  real_name: string | null;
  phone: string | null;
  status: string | null;
  wechat_work_userid?: string | null;
  wechat_work_name?: string | null;
};

/** 仅保留数字，去掉国家码 86 前缀 */
export function normalizePhone(input: string | null | undefined): string {
  if (!input) return '';
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('86') && digits.length > 11) {
    digits = digits.slice(2);
  }
  return digits;
}

export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 11 && nb.length >= 11) {
    return na.slice(-11) === nb.slice(-11);
  }
  return false;
}

export function namesMatch(dbName: string | null | undefined, wechatName: string | null | undefined): boolean {
  const a = (dbName || '').trim();
  const b = (wechatName || '').trim();
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}

/** 用户名或手机号 + 密码登录：解析 public.users */
export async function findUserByAccount(
  admin: SupabaseClient,
  account: string,
): Promise<DbAuthUser | null> {
  const raw = account.trim();
  if (!raw) return null;

  const digits = normalizePhone(raw);
  const isPhoneLike = digits.length >= 11 && /^1\d{10}$/.test(digits);

  if (isPhoneLike) {
    const { data: rows, error } = await admin
      .from('users')
      .select('id, username, email, real_name, phone, status, wechat_work_userid, wechat_work_name')
      .not('phone', 'is', null);
    if (error) throw error;
    const matched = (rows as DbAuthUser[] | null)?.filter((u) => phonesMatch(u.phone, raw)) ?? [];
    if (matched.length === 1) return matched[0];
    if (matched.length > 1) {
      throw new Error('该手机号对应多个账号，请联系管理员处理');
    }
    return null;
  }

  const { data, error } = await admin
    .from('users')
    .select('id, username, email, real_name, phone, status, wechat_work_userid, wechat_work_name')
    .eq('username', raw)
    .maybeSingle();
  if (error) throw error;
  return data as DbAuthUser | null;
}

export async function findUsersByWechatPhone(
  admin: SupabaseClient,
  mobile: string | null | undefined,
): Promise<DbAuthUser[]> {
  const norm = normalizePhone(mobile);
  if (!norm || norm.length < 11) return [];

  const { data: rows, error } = await admin
    .from('users')
    .select('id, username, email, real_name, phone, status, wechat_work_userid, wechat_work_name')
    .not('phone', 'is', null);
  if (error) throw error;
  return (rows as DbAuthUser[] | null)?.filter((u) => phonesMatch(u.phone, mobile)) ?? [];
}

export async function findUsersByWechatName(
  admin: SupabaseClient,
  name: string | null | undefined,
): Promise<DbAuthUser[]> {
  const target = (name || '').trim();
  if (!target) return [];

  const { data: rows, error } = await admin
    .from('users')
    .select('id, username, email, real_name, phone, status, wechat_work_userid, wechat_work_name')
    .not('real_name', 'is', null);
  if (error) throw error;
  return (rows as DbAuthUser[] | null)?.filter((u) => namesMatch(u.real_name, target)) ?? [];
}

/** 企微扫码：优先手机号，其次姓名（均不与邮箱匹配） */
export async function findUserByWechatMember(
  admin: SupabaseClient,
  member: WechatMember,
): Promise<{ user: DbAuthUser | null; matchBy: 'phone' | 'name' | null; ambiguous: boolean }> {
  const byPhone = await findUsersByWechatPhone(admin, member.mobile);
  if (byPhone.length === 1) return { user: byPhone[0], matchBy: 'phone', ambiguous: false };
  if (byPhone.length > 1) return { user: null, matchBy: 'phone', ambiguous: true };

  const byName = await findUsersByWechatName(admin, member.name);
  if (byName.length === 1) return { user: byName[0], matchBy: 'name', ambiguous: false };
  if (byName.length > 1) return { user: null, matchBy: 'name', ambiguous: true };

  return { user: null, matchBy: null, ambiguous: false };
}

export function resolveAuthEmail(dbUser: DbAuthUser): string | null {
  const email = (dbUser.email || '').trim();
  return email || null;
}

export function buildInternalAuthEmail(username: string, phone?: string | null): string {
  const digits = normalizePhone(phone);
  if (digits.length >= 11) return `${digits}@internal.ciond.local`;
  const safe = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '_') || 'user';
  return `${safe}@internal.ciond.local`;
}
