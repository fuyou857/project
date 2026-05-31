import { Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { DISABLE_FRONTEND_AUTH } from '../config/accessControl';
import { LayoutSkeleton } from './Skeleton';
import { supabase } from '../supabase/client';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [sessionGrace, setSessionGrace] = useState(false);

  useEffect(() => {
    if (user || loading || DISABLE_FRONTEND_AUTH) {
      setSessionGrace(false);
      return;
    }

    let cancelled = false;
    let graceTimer: ReturnType<typeof setTimeout> | undefined;

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled || !data.session) return;
      setSessionGrace(true);
      graceTimer = setTimeout(() => {
        if (!cancelled) setSessionGrace(false);
      }, 4000);
    });

    return () => {
      cancelled = true;
      if (graceTimer) clearTimeout(graceTimer);
    };
  }, [user, loading]);

  // 由 src/config/accessControl.ts 的 DISABLE_FRONTEND_AUTH 控制；为 true 时不做登录校验
  if (DISABLE_FRONTEND_AUTH) {
    return <>{children}</>;
  }

  // 加载中，或 session 已建立但 user 尚未写入 context 时显示骨架屏
  if (loading || sessionGrace) {
    return <LayoutSkeleton />;
  }

  // 未登录，重定向到登录页（HashRouter 内 SPA 跳转）
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 已登录，显示子组件
  return <>{children}</>;
}
