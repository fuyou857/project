-- 为 projects 表添加所有缺失的字段
-- 注意：执行此 SQL 前请先备份数据库

-- 添加项目编号字段
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_code TEXT;

-- 添加招标方式字段
ALTER TABLE projects ADD COLUMN IF NOT EXISTS tender_method TEXT DEFAULT 'public_tender';

-- 添加管理费比例字段
ALTER TABLE projects ADD COLUMN IF NOT EXISTS management_fee_rate NUMERIC;

-- 添加成本票比例字段
ALTER TABLE projects ADD COLUMN IF NOT EXISTS cost_ticket_rate NUMERIC;

-- 添加管理费金额字段
ALTER TABLE projects ADD COLUMN IF NOT EXISTS management_fee_amount NUMERIC DEFAULT 0;

-- 添加综合税率字段
ALTER TABLE projects ADD COLUMN IF NOT EXISTS tax_rate NUMERIC DEFAULT 0;

-- 添加负责人电话字段
ALTER TABLE projects ADD COLUMN IF NOT EXISTS manager_phone TEXT;

-- 添加负责人身份证URL字段
ALTER TABLE projects ADD COLUMN IF NOT EXISTS manager_id_card_url TEXT;

-- 添加建设单位联系人字段
ALTER TABLE projects ADD COLUMN IF NOT EXISTS party_a_contact TEXT;

-- 添加项目盖章人字段
ALTER TABLE projects ADD COLUMN IF NOT EXISTS stamp_person TEXT;

-- 添加项目盖章人电话字段
ALTER TABLE projects ADD COLUMN IF NOT EXISTS stamp_person_phone TEXT;

-- 添加盖章人委托书URL字段
ALTER TABLE projects ADD COLUMN IF NOT EXISTS stamp_authorization_url TEXT;

-- 为常用字段添加索引以提高搜索性能
CREATE INDEX IF NOT EXISTS idx_projects_project_code ON projects(project_code);
CREATE INDEX IF NOT EXISTS idx_projects_tender_method ON projects(tender_method);
CREATE INDEX IF NOT EXISTS idx_projects_party_a_id ON projects(party_a_id);
