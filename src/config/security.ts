export const SECURITY_CONFIG = {
  jwt: {
    expiresIn: '24h',
    algorithm: 'HS256' as const,
  },
  password: {
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSpecialChar: true,
  },
  session: {
    maxAge: 86400000,
    secure: true,
    httpOnly: true,
    sameSite: 'strict' as const,
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: 100,
  },
};

export function validateAnonKey(): boolean {
  const key = process.env.SUPABASE_ANON_KEY;
  if (!key) {
    console.error('SUPABASE_ANON_KEY 未配置');
    return false;
  }
  if (key === 'your_supabase_anon_key_here') {
    console.error('SUPABASE_ANON_KEY 仍使用默认值，请修改');
    return false;
  }
  return true;
}

/** 浏览器端仅校验匿名密钥；Service Role 仅允许存在于 Edge / 服务端。 */
export function validateSecurityConfig(): boolean {
  return validateAnonKey();
}

export function generateSecureKey(length: number = 64): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
  let result = '';
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    result += charset[array[i] % charset.length];
  }
  return result;
}