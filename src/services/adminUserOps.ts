import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';

type EdgePayload = { error?: string; ok?: boolean; message?: string };

async function describeAdminUserOpsError(err: unknown): Promise<string> {
  if (err instanceof FunctionsHttpError && err.context instanceof Response) {
    const res = err.context;
    try {
      const j = (await res.clone().json()) as { error?: string; message?: string; code?: string };
      const detail = j.error || j.message;
      if (detail) return detail;
    } catch {
      /* ignore */
    }
    return `Edge Function 异常（HTTP ${res.status}）`;
  }
  return err instanceof Error ? err.message : 'Edge Function 调用失败';
}

/**
 * 调用 Edge Function `admin-user-ops`（服务端 Service Role），请求自动携带当前用户 JWT。
 */
export async function invokeAdminUserOps<T extends EdgePayload>(
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('admin-user-ops', { body });
  if (error) {
    throw new Error(await describeAdminUserOpsError(error));
  }
  if (data && typeof data === 'object' && (data.error || data.ok === false)) {
    throw new Error(data.error || '操作失败');
  }
  return data as T;
}
