/**
 * Supabase Client 配置
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// 使用环境变量
export const supabaseUrl = process.env.SUPABASE_URL || '';
export const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});
