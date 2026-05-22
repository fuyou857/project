-- ============================================
-- 最终完整数据库脚本
-- ============================================

-- 1. 公司表
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  company_type VARCHAR(20) DEFAULT 'head' CHECK (company_type IN ('head', 'branch')),
  parent_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  credit_code VARCHAR(50),
  contact_person VARCHAR(100),
  contact_phone VARCHAR(20),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  remark TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. 项目表
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  code VARCHAR(100),
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  party_a_id UUID,
  signatory_id UUID,
  start_date DATE,
  end_date DATE,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
  owner_address TEXT,
  remark TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. 甲方单位表
CREATE TABLE IF NOT EXISTS public.party_a (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  unit_type VARCHAR(100),
  credit_code VARCHAR(50),
  bank_name VARCHAR(200),
  bank_account VARCHAR(100),
  phone VARCHAR(20),
  address TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. 乙方单位表
CREATE TABLE IF NOT EXISTS public.party_b (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  unit_type VARCHAR(100),
  credit_code VARCHAR(50),
  bank_name VARCHAR(200),
  bank_account VARCHAR(100),
  phone VARCHAR(20),
  address TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 5. 供应商表
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  credit_code VARCHAR(50),
  contact_person VARCHAR(100),
  contact_phone VARCHAR(20),
  address TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 6. 签约单位表
CREATE TABLE IF NOT EXISTS public.signatory_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_name VARCHAR(200) NOT NULL,
  credit_code VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 7. 角色表
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 8. 用户表
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(100) NOT NULL UNIQUE,
  password TEXT NOT NULL,
  real_name VARCHAR(100),
  phone VARCHAR(20),
  email VARCHAR(100),
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  role_ids UUID[] DEFAULT '{}',
  project_ids UUID[] DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 9. 印章使用记录表
CREATE TABLE IF NOT EXISTS public.seal_usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  seal_type VARCHAR(100) NOT NULL,
  borrower VARCHAR(100) NOT NULL,
  borrower_id_card VARCHAR(50),
  borrower_id_card_file TEXT,
  borrow_date TIMESTAMP NOT NULL,
  expected_return_date TIMESTAMP,
  actual_return_date TIMESTAMP,
  purpose TEXT NOT NULL,
  attachment_files TEXT[] DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'borrowed' CHECK (status IN ('borrowed', 'returned')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 10. 收入合同表
CREATE TABLE IF NOT EXISTS public.income_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_name VARCHAR(200) NOT NULL,
  contract_code VARCHAR(100),
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  party_a_id UUID REFERENCES public.party_a(id) ON DELETE SET NULL,
  signatory_id UUID REFERENCES public.signatory_units(id) ON DELETE SET NULL,
  contract_amount NUMERIC(18, 2) DEFAULT 0,
  signing_date DATE,
  start_date DATE,
  end_date DATE,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'signed', 'completed')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 11. 支出合同表
CREATE TABLE IF NOT EXISTS public.expense_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_name VARCHAR(200) NOT NULL,
  contract_code VARCHAR(100),
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  party_b_id UUID REFERENCES public.party_b(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  contract_amount NUMERIC(18, 2) DEFAULT 0,
  signing_date DATE,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'signed', 'completed')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 12. 付款记录表
CREATE TABLE IF NOT EXISTS public.payment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  contract_id UUID REFERENCES public.expense_contracts(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  amount NUMERIC(18, 2) NOT NULL,
  transfer_date DATE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  invoice_id UUID,
  remark TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 13. 成本发票表
CREATE TABLE IF NOT EXISTS public.cost_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  party_b_id UUID REFERENCES public.party_b(id) ON DELETE SET NULL,
  invoice_no VARCHAR(100),
  invoice_date DATE,
  amount NUMERIC(18, 2) NOT NULL,
  tax_amount NUMERIC(18, 2) DEFAULT 0,
  is_paid BOOLEAN DEFAULT false,
  remaining_amount NUMERIC(18, 2) DEFAULT 0,
  remark TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 14. 收入发票表
CREATE TABLE IF NOT EXISTS public.income_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  party_a_id UUID REFERENCES public.party_a(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  invoice_no VARCHAR(100),
  invoice_date DATE,
  amount NUMERIC(18, 2) NOT NULL,
  tax_amount NUMERIC(18, 2) DEFAULT 0,
  tax_rate NUMERIC(5, 2),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'issued', 'received')),
  remark TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 15. 收款登记表
CREATE TABLE IF NOT EXISTS public.receipt_registration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  party_a_id UUID REFERENCES public.party_a(id) ON DELETE SET NULL,
  amount NUMERIC(18, 2) NOT NULL,
  receipt_date DATE,
  receipt_method VARCHAR(100),
  remark TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 16. 预警表
CREATE TABLE IF NOT EXISTS public.warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,
  related_id UUID,
  message TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 17. 操作日志表
CREATE TABLE IF NOT EXISTS public.operation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action VARCHAR(200) NOT NULL,
  details TEXT,
  ip_address VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 18. 其他收入表
CREATE TABLE IF NOT EXISTS public.other_incomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  source VARCHAR(200) NOT NULL,
  amount NUMERIC(18, 2) NOT NULL,
  date DATE,
  remark TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 19. 收入变更表
CREATE TABLE IF NOT EXISTS public.income_variations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  main_contract_id UUID REFERENCES public.income_contracts(id) ON DELETE SET NULL,
  change_amount NUMERIC(18, 2) NOT NULL,
  change_reason TEXT,
  change_date DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 20. 收入补充表
CREATE TABLE IF NOT EXISTS public.income_supplements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  main_contract_id UUID REFERENCES public.income_contracts(id) ON DELETE SET NULL,
  supplement_name VARCHAR(200) NOT NULL,
  supplement_amount NUMERIC(18, 2) NOT NULL,
  supplement_date DATE,
  remark TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 21. 收入结算表
CREATE TABLE IF NOT EXISTS public.income_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  main_contract_id UUID REFERENCES public.income_contracts(id) ON DELETE SET NULL,
  settlement_amount NUMERIC(18, 2) NOT NULL,
  settlement_date DATE,
  remark TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 22. 收入产值确认表
CREATE TABLE IF NOT EXISTS public.income_output_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  main_contract_id UUID REFERENCES public.income_contracts(id) ON DELETE SET NULL,
  output_amount NUMERIC(18, 2) NOT NULL,
  confirmation_date DATE,
  remark TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 23. 收入扣款表
CREATE TABLE IF NOT EXISTS public.income_deductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  main_contract_id UUID REFERENCES public.income_contracts(id) ON DELETE SET NULL,
  deduction_amount NUMERIC(18, 2) NOT NULL,
  deduction_reason TEXT,
  deduction_date DATE,
  remark TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 启用 RLS
-- ============================================
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_a ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_b ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signatory_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seal_usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_registration ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.other_incomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_variations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_supplements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_output_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_deductions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 创建 RLS 策略（使用 DO 避免语法错误）
-- ============================================
DO $$ 
DECLARE
  tables TEXT[] := ARRAY['companies', 'projects', 'party_a', 'party_b', 'suppliers', 'signatory_units', 'roles', 'users', 'seal_usage_records', 'income_contracts', 'expense_contracts', 'payment_records', 'cost_invoices', 'income_invoices', 'receipt_registration', 'warnings', 'operation_logs', 'other_incomes', 'income_variations', 'income_supplements', 'income_settlements', 'income_output_confirmations', 'income_deductions'];
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY tables LOOP
    -- 读策略
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = table_name AND policyname = '公开读取') THEN
      EXECUTE format('CREATE POLICY "公开读取" ON public.%I FOR SELECT USING (true)', table_name);
    END IF;
    -- 写策略
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = table_name AND policyname = '公开插入') THEN
      EXECUTE format('CREATE POLICY "公开插入" ON public.%I FOR INSERT WITH CHECK (true)', table_name);
    END IF;
    -- 更新策略
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = table_name AND policyname = '公开更新') THEN
      EXECUTE format('CREATE POLICY "公开更新" ON public.%I FOR UPDATE USING (true)', table_name);
    END IF;
    -- 删除策略
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = table_name AND policyname = '管理员删除') THEN
      EXECUTE format('CREATE POLICY "管理员删除" ON public.%I FOR DELETE USING (true)', table_name);
    END IF;
  END LOOP;
END $$;

-- ============================================
-- 插入默认数据
-- ============================================

-- 默认角色
INSERT INTO public.roles (name, code, description)
SELECT '超级管理员', 'super_admin', '拥有所有权限'
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE code = 'super_admin');

INSERT INTO public.roles (name, code, description)
SELECT '公司管理员', 'company_admin', '管理公司相关功能'
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE code = 'company_admin');

INSERT INTO public.roles (name, code, description)
SELECT '项目经理', 'project_manager', '管理项目相关功能'
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE code = 'project_manager');

INSERT INTO public.roles (name, code, description)
SELECT '普通员工', 'staff', '普通员工权限'
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE code = 'staff');

-- 默认管理员用户 (用户名: admin, 密码: admin123 base64)
INSERT INTO public.users (username, password, real_name, status)
SELECT 'admin', 'YWRtaW4xMjM=', '系统管理员', 'active'
WHERE NOT EXISTS (SELECT 1 FROM public.users WHERE username = 'admin');

-- ============================================
-- 完成！所有 23 个表已创建！
-- ============================================
