export const FEATURE_FLAGS = {} as const;

export function isFeatureEnabled(flag: string): boolean {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem(flag);
  if (stored === null) return false;
  return stored === 'true';
}

export function setFeatureEnabled(flag: string, enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(flag, String(enabled));
}