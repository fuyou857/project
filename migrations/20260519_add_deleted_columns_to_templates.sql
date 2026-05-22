-- 添加 contract_templates 表缺失的软删除字段
-- deleted_at 可能已存在，只添加 deleted_by
ALTER TABLE contract_templates
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_contract_templates_deleted_at ON contract_templates(deleted_at);
