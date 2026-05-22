/**
 * =============================================================================
 * 前端访问控制 — 临时开关（内部分析 / AI 功能巡检）
 * =============================================================================
 *
 * 将 DISABLE_FRONTEND_AUTH 设为 true：跳过路由层登录校验，根路径进入工作台。
 * 设为 false：恢复需登录后访问业务页与后台的原始行为。
 *
 * 生产构建：`npm run build` 会先运行 `scripts/assert-prod-auth.mjs`，若本开关非 false 则构建失败。
 *
 * -----------------------------------------------------------------------------
 * 涉及文件（收到「恢复登录界面」指令时请逐项核对）
 * -----------------------------------------------------------------------------
 * 1) src/config/accessControl.ts（本文件）
 *    - 将 DISABLE_FRONTEND_AUTH 改为 false
 *
 * 2) src/components/ProtectedRoute.tsx
 *    - 从本文件 import DISABLE_FRONTEND_AUTH；校验逻辑保留，仅由开关短路
 *
 * 3) src/config/routes.tsx
 *    - 根路由 `/` 的 Navigate 目标随 DISABLE_FRONTEND_AUTH 切换：
 *      true → /dashboard；false → /login
 *
 * 说明：Supabase RLS / 服务端权限未在此开关范围内；仅关闭「前端路由守卫」。
 * =============================================================================
 */
export const DISABLE_FRONTEND_AUTH = false;
