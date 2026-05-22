-- ============================================
-- 完整修复 operation_logs 表结构
-- ============================================

-- 删除旧表（如果存在）并重新创建正确结构
DROP TABLE IF EXISTS operation_logs CASCADE;

CREATE TABLE operation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  user_name VARCHAR(255),
  user_email VARCHAR(255),
  ip_address VARCHAR(50),
  module VARCHAR(100),
  action VARCHAR(100),
  description TEXT,
  request_params TEXT,
  status VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 启用 RLS
ALTER TABLE operation_logs ENABLE ROW LEVEL SECURITY;

-- 创建宽松的 RLS 策略（便于开发）
DROP POLICY IF EXISTS "operation_logs_all" ON operation_logs;
CREATE POLICY "operation_logs_all" ON operation_logs FOR ALL USING (true) WITH CHECK (true);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_operation_logs_user ON operation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_operation_logs_created ON operation_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_operation_logs_module ON operation_logs(module);

COMMENT ON TABLE operation_logs IS '操作日志表';
