-- 审批系统第四阶段：抄送、SLA、步骤签批类型（会签/或签预留）
-- 可重复执行

CREATE TABLE IF NOT EXISTS public.approval_cc (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id UUID NOT NULL REFERENCES public.approvals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  cc_step INT DEFAULT 0,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (approval_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_approval_cc_approval ON public.approval_cc(approval_id);
CREATE INDEX IF NOT EXISTS idx_approval_cc_user ON public.approval_cc(user_id);

CREATE TABLE IF NOT EXISTS public.approval_sla_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type VARCHAR(50) NOT NULL,
  step_order INT NOT NULL,
  sla_hours INT NOT NULL DEFAULT 48,
  remind_before_hours INT DEFAULT 24,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (source_type, step_order)
);

ALTER TABLE public.approval_steps
  ADD COLUMN IF NOT EXISTS sign_type VARCHAR(20) DEFAULT 'normal';

COMMENT ON COLUMN public.approval_steps.sign_type IS 'normal=单人; countersign=会签(预留); orsign=或签(预留)';

-- 默认 SLA：非发起人步骤 48 小时，出纳 24 小时（按业务类型批量插入，已存在则跳过）
INSERT INTO public.approval_sla_config (source_type, step_order, sla_hours, remind_before_hours)
SELECT st.source_type, st.step_order,
  CASE WHEN st.approver_role = 'cashier' THEN 24 ELSE 48 END,
  CASE WHEN st.approver_role = 'cashier' THEN 12 ELSE 24 END
FROM public.approval_steps st
WHERE st.approver_role IS NOT NULL AND st.approver_role <> 'initiator'
ON CONFLICT (source_type, step_order) DO NOTHING;

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY['approval_cc', 'approval_sla_config'];
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
