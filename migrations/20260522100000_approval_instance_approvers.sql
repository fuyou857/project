-- 审批实例审批人（发起时可指定各步骤实际审批人）
-- 可重复执行

CREATE TABLE IF NOT EXISTS public.approval_instance_approvers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id UUID NOT NULL REFERENCES public.approvals(id) ON DELETE CASCADE,
  step_order INT NOT NULL,
  approver_role VARCHAR(50) NOT NULL,
  approver_id UUID NOT NULL,
  approver_name VARCHAR(100),
  is_default BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (approval_id, step_order)
);

CREATE INDEX IF NOT EXISTS idx_approval_instance_approvers_approval
  ON public.approval_instance_approvers(approval_id);

ALTER TABLE public.approvals
  ADD COLUMN IF NOT EXISTS submit_remark TEXT;

ALTER TABLE public.approval_instance_approvers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'approval_instance_approvers' AND policyname = '公开读取'
  ) THEN
    CREATE POLICY "公开读取" ON public.approval_instance_approvers FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'approval_instance_approvers' AND policyname = '公开插入'
  ) THEN
    CREATE POLICY "公开插入" ON public.approval_instance_approvers FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'approval_instance_approvers' AND policyname = '公开更新'
  ) THEN
    CREATE POLICY "公开更新" ON public.approval_instance_approvers FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'approval_instance_approvers' AND policyname = '管理员删除'
  ) THEN
    CREATE POLICY "管理员删除" ON public.approval_instance_approvers FOR DELETE USING (true);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
