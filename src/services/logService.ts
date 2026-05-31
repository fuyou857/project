import { supabase } from '../supabase/client';

export interface OperationLog {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  ip_address: string;
  module: string;
  action: string;
  description: string;
  request_params: string;
  status: string;
  created_at: string;
}

export interface LogFilter {
  user_id?: string;
  module?: string;
  action?: string;
  start_date?: string;
  end_date?: string;
  keyword?: string;
}

const MODULES = {
  PROJECT: '项目管理',
  CONTRACT: '合同管理',
  INVOICE: '财务管理',
  PAYMENT: '付款管理',
  SEAL: '印章管理',
  USER: '用户管理',
  SYSTEM: '系统管理',
  BASE_DATA: '基础数据',
};

const ACTIONS = {
  CREATE: '新增',
  UPDATE: '编辑',
  DELETE: '删除',
  VIEW: '查看',
  LOGIN: '登录',
  LOGOUT: '登出',
  IMPORT: '导入',
  EXPORT: '导出',
  SWITCH_COMPANY: '公司切换',
  BORROW: '外借',
  RETURN: '销号',
  CHANGE_PASSWORD: '密码修改',
  CHANGE_ROLE: '权限变更',
};

/**
 * 敏感操作与 module/action 对照（便于审计检索；防越权仍以 Supabase RLS 为准）：
 * - 删除业务/主数据：DELETE + 对应模块（如 BASE_DATA、USER）
 * - 导出大范围列表：EXPORT（财务导出、操作日志导出等）
 * - 修改角色 permissions：CHANGE_ROLE + USER
 */

export const logModule = MODULES;
export const logAction = ACTIONS;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resolveLogUserId(user: Record<string, unknown>): string | null {
  const id = typeof user.id === 'string' ? user.id.trim() : '';
  return UUID_RE.test(id) ? id : null;
}

export async function addLog(
  module: string,
  action: string,
  description: string,
  requestParams: Record<string, unknown> = {},
  status: 'success' | 'failed' = 'success',
) {
  try {
    const userStr = localStorage.getItem('user');
    let user: Record<string, unknown> = {};
    if (userStr) {
      try {
        user = JSON.parse(userStr) as Record<string, unknown>;
      } catch {
        user = {};
      }
    }

    const ip = await getClientIP();
    const sanitizedParams = sanitizeParams(requestParams);

    const userId = resolveLogUserId(user);
    const logData: Record<string, unknown> = {
      user_name:
        (typeof user.real_name === 'string' && user.real_name) ||
        (typeof user.username === 'string' && user.username) ||
        (typeof user.email === 'string' && user.email) ||
        '未知用户',
      user_email: typeof user.email === 'string' ? user.email : '',
      ip_address: ip,
      module,
      action,
      request_params: JSON.stringify(sanitizedParams),
      status,
    };
    if (userId) {
      logData.user_id = userId;
    }

    const { error } = await supabase.from('operation_logs').insert([logData]);

    if (error) {
      void error;
    }
  } catch {
    /* 日志写入失败时静默，避免影响主流程 */
  }
}

export async function getLogs(
  filter: LogFilter = {},
  page: number = 1,
  pageSize: number = 20
) {
  let query = supabase
    .from('operation_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (filter.user_id) {
    query = query.eq('user_id', filter.user_id);
  }
  if (filter.module) {
    query = query.eq('module', filter.module);
  }
  if (filter.action) {
    query = query.eq('action', filter.action);
  }
  if (filter.start_date) {
    query = query.gte('created_at', filter.start_date + ' 00:00:00');
  }
  if (filter.end_date) {
    query = query.lte('created_at', filter.end_date + ' 23:59:59');
  }
  if (filter.keyword) {
    query = query.ilike('description', `%${filter.keyword}%`);
  }

  const { data, count } = await query;
  return { logs: data as OperationLog[], total: count || 0 };
}

export async function getLogDetail(id: string): Promise<OperationLog | null> {
  const { data } = await supabase
    .from('operation_logs')
    .select('*')
    .eq('id', id)
    .single();
  return data as OperationLog || null;
}

export async function getUsersForFilter(): Promise<{ id: string; name: string; email: string }[]> {
  const { data } = await supabase.from('users').select('id, name, email');
  return (data || []).map((u: { id: string; name?: string | null; email?: string | null }) => ({
    id: u.id,
    name: u.name || u.email || '',
    email: u.email || '',
  }));
}

function sanitizeParams(params: Record<string, unknown>): Record<string, unknown> {
  const sensitiveFields = [
    'password',
    'password_hash',
    'token',
    'secret',
    'authorization',
    'apikey',
    'service_role',
  ];
  const result: Record<string, unknown> = {};

  for (const key of Object.keys(params)) {
    if (sensitiveFields.some(s => key.toLowerCase().includes(s))) {
      result[key] = '******';
    } else if (typeof params[key] === 'object' && params[key] !== null && !Array.isArray(params[key])) {
      result[key] = sanitizeParams(params[key] as Record<string, unknown>);
    } else {
      result[key] = params[key];
    }
  }

  return result;
}

async function getClientIP(): Promise<string> {
  const ipServices = [
    { url: 'https://myip.ipip.net', parse: (text: string) => text.split(' ')[1] },
    { url: 'https://ip.awk.so', parse: (text: string) => text.trim() },
    { url: 'https://api.ipify.org?format=json', parse: (json: { ip: string }) => json.ip },
  ];

  for (const service of ipServices) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(service.url, {
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        continue;
      }

      const text = await response.text();
      const ip = (service.parse as (x: string) => string)(text);
      if (ip && ip !== 'unknown') {
        return ip;
      }
    } catch {
      continue;
    }
  }

  return 'unknown';
}