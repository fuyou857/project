/** 密钥状态与预警等级（Edge 与 api-key-ops 共用） */

export type ApiKeyStatus = 'active' | 'expiring_soon' | 'expired' | 'disabled';
export type ApiKeyWarningLevel = 'none' | 'warn_15d' | 'warn_7d' | 'expired';

export function computeKeyStatus(
  expiresAt: string | null,
  isEnabled: boolean,
): { status: ApiKeyStatus; warning_level: ApiKeyWarningLevel } {
  if (!isEnabled) return { status: 'disabled', warning_level: 'none' };
  if (!expiresAt) return { status: 'active', warning_level: 'none' };
  const days = (new Date(expiresAt).getTime() - Date.now()) / 86400000;
  if (days <= 0) return { status: 'expired', warning_level: 'expired' };
  if (days <= 7) return { status: 'expiring_soon', warning_level: 'warn_7d' };
  if (days <= 15) return { status: 'active', warning_level: 'warn_15d' };
  return { status: 'active', warning_level: 'none' };
}
