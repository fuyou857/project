import { KEY_ROTATION_POLICY, checkKeyExpiryStatus, type KeyMetadata } from '../config/keyManagement';

export interface Alert {
  id: string;
  type: 'key_expiry' | 'key_rotation_due' | 'config_error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  keyMetadata?: KeyMetadata;
  createdAt: string;
  acknowledged: boolean;
}

let alerts: Alert[] = [];

export function checkKeyStatus(metadata: KeyMetadata): Alert | null {
  const status = checkKeyExpiryStatus(metadata);
  const now = new Date();
  
  if (status === 'expired') {
    return {
      id: `key_expired_${metadata.keyId}_${Date.now()}`,
      type: 'key_expiry',
      severity: 'critical',
      message: `密钥 ${metadata.keyId} (${metadata.keyType}) 已过期，请立即轮换`,
      keyMetadata: metadata,
      createdAt: now.toISOString(),
      acknowledged: false,
    };
  }
  
  if (status === 'pending_rotation') {
    const expiryDate = new Date(metadata.expiresAt);
    const daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      id: `key_rotation_due_${metadata.keyId}_${Date.now()}`,
      type: 'key_rotation_due',
      severity: daysRemaining <= 7 ? 'high' : 'medium',
      message: `密钥 ${metadata.keyId} (${metadata.keyType}) 将在 ${daysRemaining} 天后过期，请安排轮换`,
      keyMetadata: metadata,
      createdAt: now.toISOString(),
      acknowledged: false,
    };
  }
  
  return null;
}

export function checkAllKeys(keyMetadataList: KeyMetadata[]): Alert[] {
  const newAlerts: Alert[] = [];
  
  keyMetadataList.forEach(metadata => {
    const alert = checkKeyStatus(metadata);
    if (alert) {
      const existingAlert = alerts.find(
        a => a.type === alert.type && a.keyMetadata?.keyId === metadata.keyId && !a.acknowledged
      );
      
      if (!existingAlert) {
        newAlerts.push(alert);
      }
    }
  });
  
  alerts = [...alerts, ...newAlerts];
  return newAlerts;
}

export function getActiveAlerts(): Alert[] {
  return alerts.filter(a => !a.acknowledged).sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

export function acknowledgeAlert(alertId: string): void {
  alerts = alerts.map(a => 
    a.id === alertId ? { ...a, acknowledged: true } : a
  );
}

export function acknowledgeAllAlerts(): void {
  alerts = alerts.map(a => ({ ...a, acknowledged: true }));
}

export function getAlertSummary(): { total: number; critical: number; high: number; medium: number; low: number } {
  const activeAlerts = getActiveAlerts();
  return {
    total: activeAlerts.length,
    critical: activeAlerts.filter(a => a.severity === 'critical').length,
    high: activeAlerts.filter(a => a.severity === 'high').length,
    medium: activeAlerts.filter(a => a.severity === 'medium').length,
    low: activeAlerts.filter(a => a.severity === 'low').length,
  };
}

export function scheduleKeyRotationCheck(keyMetadataList: KeyMetadata[]): void {
  const interval = KEY_ROTATION_POLICY.reminderDaysBeforeExpiry * 24 * 60 * 60 * 1000;
  
  setInterval(() => {
    checkAllKeys(keyMetadataList);
  }, interval);
}

export function getSeverityColor(severity: Alert['severity']): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-600';
    case 'high':
      return 'bg-orange-500';
    case 'medium':
      return 'bg-yellow-500';
    case 'low':
      return 'bg-blue-500';
    default:
      return 'bg-gray-500';
  }
}

export function getSeverityLabel(severity: Alert['severity']): string {
  switch (severity) {
    case 'critical':
      return '严重';
    case 'high':
      return '高';
    case 'medium':
      return '中';
    case 'low':
      return '低';
    default:
      return '未知';
  }
}