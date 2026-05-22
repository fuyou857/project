-- 为 roles 表添加缺失的字段
-- code: 角色标识（用于权限判断）
-- permissions: 角色拥有的权限列表（JSONB格式）

ALTER TABLE roles ADD COLUMN IF NOT EXISTS code VARCHAR(50) UNIQUE;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]';

-- 为现有角色设置 code 值（code = name）
UPDATE roles SET code = name WHERE code IS NULL;

-- 确保 code 不为空
ALTER TABLE roles ALTER COLUMN code SET NOT NULL;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_roles_code ON roles(code);
