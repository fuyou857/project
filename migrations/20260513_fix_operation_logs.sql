-- 修复 operation_logs 表结构以匹配代码要求
-- 添加缺失的列并调整字段类型

-- 检查并添加缺失的列
ALTER TABLE operation_logs 
  ADD COLUMN IF NOT EXISTS user_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS user_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS action VARCHAR(100),
  ADD COLUMN IF NOT EXISTS status VARCHAR(50);

-- 如果 action_type 列存在，将其数据复制到 action 列（为了兼容性）
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'operation_logs' AND column_name = 'action_type') THEN
    UPDATE operation_logs SET action = action_type WHERE action IS NULL;
  END IF;
END $$;

-- 将 request_params 从 JSONB 改为 TEXT（代码使用 JSON.stringify）
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'operation_logs' AND column_name = 'request_params' AND data_type = 'jsonb') THEN
    ALTER TABLE operation_logs ALTER COLUMN request_params TYPE TEXT USING request_params::TEXT;
  END IF;
END $$;

-- 更新 RLS 策略
DROP POLICY IF EXISTS "允许查看操作日志" ON operation_logs;
DROP POLICY IF EXISTS "允许创建操作日志" ON operation_logs;

CREATE POLICY "operation_logs_all" ON operation_logs FOR ALL USING (true) WITH CHECK (true);
