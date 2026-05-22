import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { DISABLE_FRONTEND_AUTH } from '../config/accessControl';
import {
  canAccessPathWithPermissions,
  normalizePathname,
  STRICT_SUPER_ADMIN_PATH_PREFIXES,
} from '../config/routePermissions';

/**
 * 在已登录 Layout 内按 URL 校验功能权限，防止仅靠直链绕过侧栏。
 * mergedPerms / loading 由 Layout 统一拉取后传入，避免重复请求。
 */
export default function RoutePermissionGuard({
  children,
  mergedPerms,
  loading,
}: {
  children: React.ReactNode;
  mergedPerms: Set<string>;
  loading: boolean;
}) {
  const location = useLocation();
  const { isSuperAdmin, isStrictSuperAdmin } = useAuth();
  const pathname = normalizePathname(location.pathname);

  if (DISABLE_FRONTEND_AUTH) {
    return <>{children}</>;
  }

  const strictOnly =
    STRICT_SUPER_ADMIN_PATH_PREFIXES.some(
      prefix => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );

  if (strictOnly && !isStrictSuperAdmin) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-12 bg-[#f3f4f6]">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-semibold text-gray-800 mb-2">403 禁止访问</h1>
          <p className="text-gray-600 text-sm mb-6">API 密钥中心仅超级管理员（super_admin）可访问。</p>
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          >
            工作台
          </Link>
        </div>
      </div>
    );
  }

  if (isSuperAdmin) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-12 text-gray-500 text-sm">
        校验权限中…
      </div>
    );
  }

  if (!canAccessPathWithPermissions(pathname, isSuperAdmin, mergedPerms, isStrictSuperAdmin)) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-12 bg-[#f3f4f6]">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-semibold text-gray-800 mb-2">无权访问该页面</h1>
          <p className="text-gray-600 text-sm mb-6">
            当前账号未分配此功能权限。如需使用请联系管理员在「角色管理 → 分配权限」中勾选对应模块。
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-800 text-sm font-medium hover:bg-gray-50"
            >
              返回上一页
            </button>
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
            >
              工作台
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
