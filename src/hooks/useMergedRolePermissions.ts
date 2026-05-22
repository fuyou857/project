import { useState, useEffect } from 'react';
import { supabase } from '../supabase/client';
import { useAuth } from './useAuth';
import { expandPermissionKeys } from '../config/menuAccess';

/** 兼容 roles.permissions 为 jsonb 数组或历史字符串存储 */
function normalizeRolePermissionsCell(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .filter((p): p is string => typeof p === 'string' && !!p.trim())
      .map(p => p.trim());
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .filter((p): p is string => typeof p === 'string' && !!p.trim())
          .map(p => p.trim());
      }
    } catch {
      /* ignore */
    }
  }
  return [];
}

/**
 * 当前用户所有角色的 permissions 合并（含旧文案别名展开）。
 * 超级管理员不查库，返回空 Set，由调用方配合 isSuperAdmin 视为「拥有全部」。
 */
export function useMergedRolePermissions(): {
  mergedPerms: Set<string>;
  loading: boolean;
} {
  const { user, isSuperAdmin } = useAuth();
  const [mergedPerms, setMergedPerms] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refetchTick, setRefetchTick] = useState(0);

  useEffect(() => {
    const bump = () => setRefetchTick(t => t + 1);
    window.addEventListener('app:role-permissions-changed', bump);
    const onVis = () => {
      if (document.visibilityState === 'visible') bump();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('app:role-permissions-changed', bump);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  useEffect(() => {
    if (isSuperAdmin) {
      setMergedPerms(new Set());
      setLoading(false);
      return;
    }
    if (!user?.role_ids?.length) {
      setMergedPerms(new Set());
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('roles')
        .select('permissions')
        .in('id', user.role_ids as string[]);
      if (cancelled) return;
      if (error || !data) {
        setMergedPerms(new Set());
        setLoading(false);
        return;
      }
      const flat: string[] = [];
      for (const row of data) {
        flat.push(...normalizeRolePermissionsCell(row.permissions));
      }
      setMergedPerms(expandPermissionKeys(flat));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.role_ids, isSuperAdmin, refetchTick]);

  return { mergedPerms, loading };
}
