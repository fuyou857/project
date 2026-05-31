-- project_members 唯一约束
-- 先清理重复数据（保留最早的记录）
DELETE FROM project_members a USING project_members b
WHERE a.id > b.id AND a.project_id = b.project_id AND a.user_id = b.user_id;

ALTER TABLE project_members ADD CONSTRAINT IF NOT EXISTS unique_project_member UNIQUE (project_id, user_id);

-- approval_tasks 复合索引（加速待办查询）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_approver_status ON approval_tasks(approver_id, status);

-- material_stock 项目+物资复合索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_project_material ON material_stock(project_id, material_id);

-- operation_logs 时间索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_logs_created_at ON operation_logs(created_at);