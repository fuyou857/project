export interface KeyMetadata {
  keyId: string;
  keyType: 'service_role' | 'anon' | 'api';
  createdAt: string;
  expiresAt: string;
  rotationIntervalDays: number;
  status: 'active' | 'expired' | 'pending_rotation';
  lastRotatedAt?: string;
  nextRotationReminderAt?: string;
}

export interface KeyRotationPolicy {
  minRotationIntervalDays: number;
  maxRotationIntervalDays: number;
  reminderDaysBeforeExpiry: number;
  enabled: boolean;
}

export const KEY_ROTATION_POLICY: KeyRotationPolicy = {
  minRotationIntervalDays: 60,
  maxRotationIntervalDays: 90,
  reminderDaysBeforeExpiry: 30,
  enabled: true,
};

export function parseJwtExpiry(jwt: string): Date | null {
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp) {
      return new Date(payload.exp * 1000);
    }
    return null;
  } catch {
    return null;
  }
}

export function calculateNextRotation(date: Date, intervalDays: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + intervalDays);
  return result;
}

export function calculateReminderDate(expiryDate: Date, reminderDays: number): Date {
  const result = new Date(expiryDate);
  result.setDate(result.getDate() - reminderDays);
  return result;
}

export function checkKeyExpiryStatus(metadata: KeyMetadata): 'active' | 'expired' | 'pending_rotation' {
  const now = new Date();
  
  if (new Date(metadata.expiresAt) < now) {
    return 'expired';
  }
  
  const reminderDate = calculateReminderDate(new Date(metadata.expiresAt), KEY_ROTATION_POLICY.reminderDaysBeforeExpiry);
  if (now >= reminderDate) {
    return 'pending_rotation';
  }
  
  return 'active';
}

export function generateKeyMetadata(keyId: string, keyType: KeyMetadata['keyType'], createdAt: Date = new Date()): KeyMetadata {
  const expiresAt = calculateNextRotation(createdAt, KEY_ROTATION_POLICY.maxRotationIntervalDays);
  const nextRotationReminderAt = calculateReminderDate(expiresAt, KEY_ROTATION_POLICY.reminderDaysBeforeExpiry);
  
  return {
    keyId,
    keyType,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    rotationIntervalDays: KEY_ROTATION_POLICY.maxRotationIntervalDays,
    status: 'active',
    nextRotationReminderAt: nextRotationReminderAt.toISOString(),
  };
}

export function getKeyStatusColor(status: KeyMetadata['status']): string {
  switch (status) {
    case 'active':
      return 'bg-green-500';
    case 'pending_rotation':
      return 'bg-yellow-500';
    case 'expired':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
}

export function formatDaysRemaining(expiresAt: string): string {
  const expiryDate = new Date(expiresAt);
  const now = new Date();
  const diffTime = expiryDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return `已过期 ${Math.abs(diffDays)} 天`;
  if (diffDays === 0) return '今日过期';
  if (diffDays <= 7) return `${diffDays} 天（即将过期）`;
  return `${diffDays} 天`;
}