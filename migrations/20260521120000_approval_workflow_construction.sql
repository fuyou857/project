-- 建筑工程管理系统 - 审批系统（建表 + 完整流程配置）
-- 生产库若从未执行过 20260512 审批迁移，本脚本可单独执行
-- 可重复执行（IF NOT EXISTS / 策略存在则跳过）

-- =============================================================================
-- 0. 审批基础表（不存在则创建）
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type VARCHAR(50) NOT NULL,
  source_id UUID NOT NULL,
  source_name VARCHAR(255),
  current_step INT DEFAULT 1,
  status VARCHAR(20) DEFAULT 'pending',
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.approval_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type VARCHAR(50) NOT NULL,
  step_order INT NOT NULL,
  step_name VARCHAR(100) NOT NULL,
  approver_role VARCHAR(50),
  approver_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.approval_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id UUID NOT NULL REFERENCES public.approvals(id) ON DELETE CASCADE,
  step_order INT NOT NULL,
  step_name VARCHAR(100) NOT NULL,
  approver_id UUID,
  approver_name VARCHAR(100),
  action VARCHAR(20) NOT NULL,
  comment TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approvals_source ON public.approvals(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON public.approvals(status);
CREATE INDEX IF NOT EXISTS idx_approval_steps_type ON public.approval_steps(source_type);
CREATE INDEX IF NOT EXISTS idx_approval_records_approval_id ON public.approval_records(approval_id);

-- 已有旧表时放宽 step_name 长度
ALTER TABLE public.approval_steps ALTER COLUMN step_name TYPE VARCHAR(100);
ALTER TABLE public.approval_records ALTER COLUMN step_name TYPE VARCHAR(100);

-- RLS + 公开策略（与 final_database_setup 一致，存在则跳过）
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY['approvals', 'approval_steps', 'approval_records'];
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

-- =============================================================================
-- 1. 审批岗位角色（roles.code，表存在时）
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'roles') THEN
    INSERT INTO public.roles (name, code, description)
    SELECT '发起人', 'initiator', '业务经办、提交申请'
    WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE code = 'initiator');

    INSERT INTO public.roles (name, code, description)
    SELECT '商务', 'business', '商务条款与价格审核'
    WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE code = 'business');

    INSERT INTO public.roles (name, code, description)
    SELECT '项目经理', 'manager', '项目业务初审'
    WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE code = 'manager');

    INSERT INTO public.roles (name, code, description)
    SELECT '会计', 'accountant', '财务审核'
    WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE code = 'accountant');

    INSERT INTO public.roles (name, code, description)
    SELECT '出纳', 'cashier', '资金收付执行'
    WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE code = 'cashier');
  END IF;
END $$;

-- =============================================================================
-- 2. 写入 12 类业务审批步骤（覆盖旧配置）
-- =============================================================================
DELETE FROM public.approval_steps;

INSERT INTO public.approval_steps (source_type, step_order, step_name, approver_role) VALUES
('income_contract', 1, '发起人提交', 'initiator'),
('income_contract', 2, '商务审核', 'business'),
('income_contract', 3, '项目经理审核', 'manager'),
('income_contract', 4, '会计审核', 'accountant'),
('income_contract', 5, '公司领导审批', 'admin'),
('income_contract', 6, '出纳执行', 'cashier'),

('expense_contract', 1, '发起人提交', 'initiator'),
('expense_contract', 2, '商务审核', 'business'),
('expense_contract', 3, '项目经理审核', 'manager'),
('expense_contract', 4, '会计审核', 'accountant'),
('expense_contract', 5, '公司领导审批', 'admin'),
('expense_contract', 6, '出纳执行', 'cashier'),

('income_variation', 1, '发起人提交', 'initiator'),
('income_variation', 2, '项目经理确认', 'manager'),
('income_variation', 3, '会计审核', 'accountant'),
('income_variation', 4, '公司领导审批', 'admin'),
('income_variation', 5, '出纳执行', 'cashier'),

('expense_variation', 1, '发起人提交', 'initiator'),
('expense_variation', 2, '项目经理确认', 'manager'),
('expense_variation', 3, '会计审核', 'accountant'),
('expense_variation', 4, '公司领导审批', 'admin'),
('expense_variation', 5, '出纳执行', 'cashier'),

('income_supplement', 1, '发起人提交', 'initiator'),
('income_supplement', 2, '项目经理审核', 'manager'),
('income_supplement', 3, '会计审核', 'accountant'),
('income_supplement', 4, '公司领导审批', 'admin'),
('income_supplement', 5, '出纳执行', 'cashier'),

('expense_supplement', 1, '发起人提交', 'initiator'),
('expense_supplement', 2, '项目经理审核', 'manager'),
('expense_supplement', 3, '会计审核', 'accountant'),
('expense_supplement', 4, '公司领导审批', 'admin'),
('expense_supplement', 5, '出纳执行', 'cashier'),

('income_deduction', 1, '发起人提交', 'initiator'),
('income_deduction', 2, '项目经理确认', 'manager'),
('income_deduction', 3, '会计审核', 'accountant'),
('income_deduction', 4, '公司领导审批', 'admin'),
('income_deduction', 5, '出纳执行', 'cashier'),

('expense_deduction', 1, '发起人提交', 'initiator'),
('expense_deduction', 2, '项目经理确认', 'manager'),
('expense_deduction', 3, '会计审核', 'accountant'),
('expense_deduction', 4, '公司领导审批', 'admin'),
('expense_deduction', 5, '出纳执行', 'cashier'),

('income_output', 1, '发起人提交', 'initiator'),
('income_output', 2, '项目经理确认', 'manager'),
('income_output', 3, '会计复核', 'accountant'),
('income_output', 4, '公司领导审批', 'admin'),
('income_output', 5, '出纳执行', 'cashier'),

('income_settlement', 1, '发起人提交', 'initiator'),
('income_settlement', 2, '项目经理确认', 'manager'),
('income_settlement', 3, '会计审核', 'accountant'),
('income_settlement', 4, '公司领导审批', 'admin'),
('income_settlement', 5, '出纳关账', 'cashier'),

('expense_settlement', 1, '发起人提交', 'initiator'),
('expense_settlement', 2, '项目经理确认', 'manager'),
('expense_settlement', 3, '会计审核', 'accountant'),
('expense_settlement', 4, '公司领导审批', 'admin'),
('expense_settlement', 5, '出纳关账', 'cashier'),

('expense_performance', 1, '发起人提交', 'initiator'),
('expense_performance', 2, '项目经理确认', 'manager'),
('expense_performance', 3, '会计确认', 'accountant'),
('expense_performance', 4, '公司领导审批', 'admin'),
('expense_performance', 5, '出纳执行', 'cashier');

NOTIFY pgrst, 'reload schema';
