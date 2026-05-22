-- 添加任务优先级字段
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium';

-- 为常用查询添加索引
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
