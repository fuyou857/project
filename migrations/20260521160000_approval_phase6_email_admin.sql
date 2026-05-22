-- 审批系统第六阶段：邮件队列（待接入 SMTP/Edge）、统计快照（可选）
-- 可重复执行

CREATE TABLE IF NOT EXISTS public.approval_email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  to_email VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  category VARCHAR(50) DEFAULT 'approval',
  status VARCHAR(20) DEFAULT 'pending',
  error_message TEXT,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_email_queue_status ON public.approval_email_queue(status, created_at);

ALTER TABLE public.approval_email_queue ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'approval_email_queue' AND policyname = '公开读取'
  ) THEN
    CREATE POLICY "公开读取" ON public.approval_email_queue FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'approval_email_queue' AND policyname = '公开插入'
  ) THEN
    CREATE POLICY "公开插入" ON public.approval_email_queue FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'approval_email_queue' AND policyname = '公开更新'
  ) THEN
    CREATE POLICY "公开更新" ON public.approval_email_queue FOR UPDATE USING (true);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
