import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { DISABLE_FRONTEND_AUTH } from '../config/accessControl';
import { LayoutSkeleton } from './Skeleton';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  // 由 src/config/accessControl.ts 的 DISABLE_FRONTEND_AUTH 控制；为 true 时不做登录校验
  if (DISABLE_FRONTEND_AUTH) {
    return <>{children}</>;
  }

  // 加载中显示骨架屏
  if (loading) {
    return <LayoutSkeleton />;
  }

  // 未登录，重定向到登录页
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 已登录，显示子组件
  return <>{children}</>;
}
