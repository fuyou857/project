/** HashRouter 规范 URL：根路径 + hash，如 /#/login、/?code=xxx#/login */
const PATHNAME_BOOTSTRAP_ROUTES = ['/login', '/dashboard'] as const;

/**
 * 将 /login、/dashboard 路径式 URL 规范化为 HashRouter 格式（供测试或非 HTML 入口复用）。
 * 生产环境优先使用 template.html 内联脚本，在 React 加载前完成跳转。
 */
export function bootstrapPathnameToHashRoute(): boolean {
  if (typeof window === 'undefined') return false;

  const { pathname, search } = window.location;
  if (!PATHNAME_BOOTSTRAP_ROUTES.includes(pathname as (typeof PATHNAME_BOOTSTRAP_ROUTES)[number])) {
    return false;
  }

  window.location.replace(`/${search}#${pathname}`);
  return true;
}
