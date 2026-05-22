-- 审批系统第五阶段：会签投票、金额条件分支
-- 可重复执行

CREATE TABLE IF NOT EXISTS public.approval_step_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id UUID NOT NULL REFERENCES public.approvals(id) ON DELETE CASCADE,
  step_order INT NOT NULL,
  approver_id UUID NOT NULL,
  action VARCHAR(20) NOT NULL DEFAULT 'approve',
  comment TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (approval_id, step_order, approver_id)
);

CREATE INDEX IF NOT EXISTS idx_approval_step_votes_lookup
  ON public.approval_step_votes(approval_id, step_order);

CREATE TABLE IF NOT EXISTS public.approval_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type VARCHAR(50) NOT NULL,
  field_name VARCHAR(50) NOT NULL,
  operator VARCHAR(10) NOT NULL CHECK (operator IN ('lt', 'lte', 'gte', 'gt')),
  threshold_value NUMERIC NOT NULL,
  /** 条件成立时流程最多走到该步骤（含） */
  max_step_order INT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  description VARCHAR(200),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_conditions_type ON public.approval_conditions(source_type);

-- 变更签证：金额 < 10 万仅走发起人→项目经理→会计（跳过领导、出纳）
INSERT INTO public.approval_conditions (source_type, field_name, operator, threshold_value, max_step_order, description)
SELECT 'income_variation', 'variation_amount', 'lt', 100000, 3, '收入变更金额小于10万简化流程'
WHERE NOT EXISTS (
  SELECT 1 FROM public.approval_conditions
  WHERE source_type = 'income_variation' AND field_name = 'variation_amount' AND operator = 'lt'
);

INSERT INTO public.approval_conditions (source_type, field_name, operator, threshold_value, max_step_order, description)
SELECT 'expense_variation', 'variation_amount', 'lt', 100000, 3, '支出变更金额小于10万简化流程'
WHERE NOT EXISTS (
  SELECT 1 FROM public.approval_conditions
  WHERE source_type = 'expense_variation' AND field_name = 'variation_amount' AND operator = 'lt'
);

-- 公司领导步骤默认或签（任一领导可通过）；可按业务在库中改为 countersign
UPDATE public.approval_steps
SET sign_type = 'orsign'
WHERE approver_role = 'admin' AND (sign_type IS NULL OR sign_type = 'normal');

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY['approval_step_votes', 'approval_conditions'];
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
