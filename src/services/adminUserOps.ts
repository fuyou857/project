import { supabase } from '../supabase/client';

type EdgePayload = { error?: string; ok?: boolean };

/**
 * 调用 Edge Function `admin-user-ops`（服务端 Service Role），请求自动携带当前用户 JWT。
 */
export async function invokeAdminUserOps<T extends EdgePayload>(
  body: Record<string, unknown>
): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('admin-user-ops', { body });
  if (error) {
    throw new Error(error.message || 'Edge Function 调用失败');
  }
  if (data && typeof data === 'object' && data.error) {
    throw new Error(data.error);
  }
  return data as T;
}
