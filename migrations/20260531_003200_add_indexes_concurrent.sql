-- 使用 CONCURRENTLY 避免锁表（PostgreSQL）
-- 注意：不能在事务中运行

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_approver_status
ON approval_tasks(approver_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_project_material
ON material_stock(project_id, material_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_logs_created_at
ON operation_logs(created_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contracts_project_status
ON contracts(project_id, status);

-- 验证索引创建状态
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE indexname LIKE 'idx_%';