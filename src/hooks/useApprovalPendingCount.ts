import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { countPendingApprovals } from '../services/approvalService';

/** 当前用户待办审批数量（用于侧栏红点，60s 轮询 + 窗口聚焦刷新） */
export function useApprovalPendingCount() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    const userId = user?.id;
    if (!userId) {
      setCount(0);
      return;
    }
    let cancelled = false;
    const refresh = async () => {
      try {
        const n = await countPendingApprovals(userId);
        if (!cancelled) setCount(n);
      } catch {
        if (!cancelled) setCount(0);
      }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 60_000);
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    window.addEventListener('approval-pending-refresh', onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('approval-pending-refresh', onFocus);
    };
  }, [user?.id]);

  return count;
}
