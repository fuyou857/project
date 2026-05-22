-- 审批系统第三阶段：催办、代理、意见模板、评论@、操作日志
-- 可重复执行

CREATE TABLE IF NOT EXISTS public.approval_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id UUID NOT NULL REFERENCES public.approvals(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_reminders_approval ON public.approval_reminders(approval_id);
CREATE INDEX IF NOT EXISTS idx_approval_reminders_requester_day ON public.approval_reminders(requester_id, created_at);

CREATE TABLE IF NOT EXISTS public.approval_delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delegator_id UUID NOT NULL,
  delegate_id UUID NOT NULL,
  source_type VARCHAR(50),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT approval_delegations_no_self CHECK (delegator_id <> delegate_id)
);

CREATE INDEX IF NOT EXISTS idx_approval_delegations_delegate ON public.approval_delegations(delegate_id, is_active);
CREATE INDEX IF NOT EXISTS idx_approval_delegations_delegator ON public.approval_delegations(delegator_id, is_active);

CREATE TABLE IF NOT EXISTS public.approval_opinion_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_opinion_templates_user ON public.approval_opinion_templates(user_id, sort_order);

CREATE TABLE IF NOT EXISTS public.approval_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id UUID NOT NULL REFERENCES public.approvals(id) ON DELETE CASCADE,
  step_order INT NOT NULL,
  step_name VARCHAR(100) NOT NULL,
  author_id UUID NOT NULL,
  author_name VARCHAR(100) NOT NULL,
  action VARCHAR(20) NOT NULL DEFAULT 'comment',
  content TEXT,
  mentioned_user_ids JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_comments_approval ON public.approval_comments(approval_id, created_at);

CREATE TABLE IF NOT EXISTS public.approval_operation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id UUID REFERENCES public.approvals(id) ON DELETE SET NULL,
  operator_id UUID,
  operation_type VARCHAR(50) NOT NULL,
  detail JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_operation_logs_approval ON public.approval_operation_logs(approval_id, created_at);

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'approval_reminders',
    'approval_delegations',
    'approval_opinion_templates',
    'approval_comments',
    'approval_operation_logs'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t AND policyname = '公开读取'
    ) THEN
      EXECUTE format('CREATE POLICY "公开读取" ON public.%I FOR SELECT USING (true)', t);
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t AND policyname = '公开插入'
    ) THEN
      EXECUTE format('CREATE POLICY "公开插入" ON public.%I FOR INSERT WITH CHECK (true)', t);
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t AND policyname = '公开更新'
    ) THEN
      EXECUTE format('CREATE POLICY "公开更新" ON public.%I FOR UPDATE USING (true)', t);
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t AND policyname = '管理员删除'
    ) THEN
      EXECUTE format('CREATE POLICY "管理员删除" ON public.%I FOR DELETE USING (true)', t);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
