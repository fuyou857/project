# 数据库侧：按公司 / 按项目隔离（RLS）

前端菜单与 `routePermissions` **不能**替代数据库权限。以下为策略要点与落地检查清单；具体 SQL 需结合当前表结构（`company_id`、`project_id`、用户归属表）在 Supabase SQL Editor 或迁移中实现。

## 1. 原则

1. **所有业务表**包含租户维度：`company_id` 和/或 `project_id`（或与项目关联的可推导列）。
2. **RLS 开启**：`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`。
3. **策略使用 JWT**：通过 `auth.uid()` 关联应用用户表，解析其 `company_id`、角色、可访问 `project_id` 列表。
4. **service_role** 仅用于服务端任务（备份脚本、批处理），**永不**下发到浏览器。

## 2. 典型策略模式（示意）

- **按公司**：`company_id = public.current_user_company()`（由会话 JWT claim 或 join `users` 得到）。
- **按项目**：用户仅在有权限的项目上 `project_id IN (...)`；或与 `project_members` 类表联结。
- **超级管理员**：在 JWT claim 或角色表中为 super_admin 时绕过限制（**仅在服务端可信写入 claim**）。

具体函数名与 claim 结构须与你们的 Auth 方案一致（Supabase Auth 自定义 claims 或自建 API 写 session）。

## 3. 验收清单

- [ ] 匿名（未登录）除公开读外无法访问业务表。
- [ ] 用户 A（公司 1）无法用 REST + anon key 查询公司 2 的行。
- [ ] 用户无法通过篡改 `company_id` 插入越权行（INSERT 策略校验）。
- [ ] `operation_logs` 等审计表写入策略：普通用户仅可插入自身相关日志，不可删改他人日志（按需）。

## 4. 与操作日志的关系

应用层 `logService.addLog` 写入 `operation_logs` 用于 **审计展示**；**RLS** 用于 **防数据窃取与篡改**。二者互补。
