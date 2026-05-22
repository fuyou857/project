/**
 * Simple feature flag utility for gradual rollout and testing.
 */
export const FEATURE_FLAGS = {
  COST_INVOICE_V2: 'feature_cost_invoice_v2',
};

export function isFeatureEnabled(flag: string): boolean {
  if (typeof window === 'undefined') return false;
  // V2 is now stable and deployed as default
  const stored = localStorage.getItem(flag);
  if (stored === null) return true; // Default to true if not set
  return stored === 'true';
}

export function setFeatureEnabled(flag: string, enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(flag, String(enabled));
}
