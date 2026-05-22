-- 添加 project_code 字段到 projects 表
-- 注意：执行此 SQL 前请先备份数据库

ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_code TEXT;

-- 为 project_code 字段添加索引以提高搜索性能
CREATE INDEX IF NOT EXISTS idx_projects_project_code ON projects(project_code);
