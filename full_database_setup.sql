-- ============================================
-- 完整数据库初始化脚本 (修复版)
-- ============================================

-- ============================================
-- 第一部分：ERP 核心表
-- ============================================

-- 角色枚举
DO $$ BEGIN
    CREATE TYPE app_role AS ENUM ('super_admin', 'finance', 'project_manager', 'material_staff', 'mechanical_staff', 'labor_staff', 'supplier', 'labor_team');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 用户档案表
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  real_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  role app_role NOT NULL DEFAULT 'project_manager',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 项目表
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  bid_amount DECIMAL(15,2) DEFAULT 0,
  duration VARCHAR(100),
  start_date DATE,
  end_date DATE,
  project_manager VARCHAR(100),
  manager_phone VARCHAR(20),
  manager_id_card VARCHAR(18),
  manager_id_card_file TEXT,
  management_fee_rate DECIMAL(5,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  owner_name VARCHAR(255),
  owner_credit_code VARCHAR(18),
  owner_address TEXT,
  owner_bank VARCHAR(255),
  owner_account VARCHAR(50),
  owner_contact VARCHAR(100),
  owner_contact_phone VARCHAR(20),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 附件类型枚举
DO $$ BEGIN
    CREATE TYPE attachment_type AS ENUM ('contract', 'bid_notice', 'insurance', 'internal_contract', 'id_card', 'guarantee_letter', 'counter_guarantee', 'budget', 'settlement', 'audit_report', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 项目附件表
CREATE TABLE IF NOT EXISTS public.project_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  attachment_type attachment_type NOT NULL,
  file_name VARCHAR(255),
  file_url TEXT,
  uploaded_at TIMESTAMP DEFAULT NOW(),
  uploaded_by UUID REFERENCES public.profiles(id)
);

-- 供应商表
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  supply_category VARCHAR(50),
  supply_content TEXT,
  contract_amount DECIMAL(15,2) DEFAULT 0,
  contract_file TEXT,
  business_license TEXT,
  bank_account VARCHAR(50),
  bank_name VARCHAR(255),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);

-- 成本发票表
CREATE TABLE IF NOT EXISTS public.cost_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  invoice_type VARCHAR(10),
  invoice_number VARCHAR(100),
  invoice_amount DECIMAL(15,2) NOT NULL,
  deductible_tax DECIMAL(15,2),
  is_paid BOOLEAN DEFAULT FALSE,
  payment_record_id UUID,
  invoice_date DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 付款记录表
CREATE TABLE IF NOT EXISTS public.payment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  payment_type VARCHAR(50),
  amount DECIMAL(15,2) NOT NULL,
  transfer_date DATE,
  transfer_account VARCHAR(50),
  invoice_id UUID REFERENCES public.cost_invoices(id),
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

-- 物资清单表
CREATE TABLE IF NOT EXISTS public.materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  material_code VARCHAR(50),
  material_name VARCHAR(255) NOT NULL,
  unit VARCHAR(20),
  budget_quantity DECIMAL(15,3),
  budget_unit_price DECIMAL(15,2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 物资采购表
CREATE TABLE IF NOT EXISTS public.material_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  material_id UUID REFERENCES public.materials(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  quantity DECIMAL(15,3) NOT NULL,
  unit_price DECIMAL(15,2) NOT NULL,
  total_amount DECIMAL(15,2),
  purchase_date DATE,
  receipt_file TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 机械台班表
CREATE TABLE IF NOT EXISTS public.machine_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  usage_amount DECIMAL(15,2),
  confirm_file TEXT,
  confirmed_at TIMESTAMP DEFAULT NOW(),
  confirmed_by UUID REFERENCES public.profiles(id)
);

-- 劳务班组表
CREATE TABLE IF NOT EXISTS public.labor_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  team_name VARCHAR(255) NOT NULL,
  leader_name VARCHAR(100),
  leader_phone VARCHAR(20),
  monthly_output DECIMAL(15,2),
  output_month DATE,
  voucher_file TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

-- 印章类型枚举
DO $$ BEGIN
    CREATE TYPE seal_type AS ENUM ('project_seal', 'temp_seal', 'seal_borrow');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 印章表
CREATE TABLE IF NOT EXISTS public.seals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  seal_type seal_type NOT NULL,
  file_url TEXT,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);

-- 印章外借表
CREATE TABLE IF NOT EXISTS public.seal_borrows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seal_id UUID REFERENCES public.seals(id) ON DELETE CASCADE,
  borrower_name VARCHAR(100),
  borrower_phone VARCHAR(20),
  purpose TEXT,
  expected_return_date DATE,
  actual_return_date DATE,
  status VARCHAR(20) DEFAULT 'borrowed',
  created_at TIMESTAMP DEFAULT NOW()
);

-- 农民工档案表
CREATE TABLE IF NOT EXISTS public.workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  id_card VARCHAR(18) NOT NULL,
  position VARCHAR(50),
  wage_standard DECIMAL(15,2),
  education_records TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 考勤记录表
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID REFERENCES public.workers(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  work_days INTEGER DEFAULT 0,
  overtime_hours DECIMAL(5,2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 工资支付记录表
CREATE TABLE IF NOT EXISTS public.wage_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID REFERENCES public.workers(id) ON DELETE CASCADE,
  payment_month DATE NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  payment_date DATE,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

-- 预警记录表
CREATE TABLE IF NOT EXISTS public.warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  warning_type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

-- 启用 RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machine_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labor_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seal_borrows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wage_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warnings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS 策略创建 (用 DO 块安全处理)
-- ============================================

DO $$ 
BEGIN
    -- 公开读取策略
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'projects' AND policyname = '公开读取') THEN
        CREATE POLICY "公开读取" ON public.projects FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = '公开读取') THEN
        CREATE POLICY "公开读取" ON public.profiles FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'suppliers' AND policyname = '公开读取') THEN
        CREATE POLICY "公开读取" ON public.suppliers FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cost_invoices' AND policyname = '公开读取') THEN
        CREATE POLICY "公开读取" ON public.cost_invoices FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payment_records' AND policyname = '公开读取') THEN
        CREATE POLICY "公开读取" ON public.payment_records FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'materials' AND policyname = '公开读取') THEN
        CREATE POLICY "公开读取" ON public.materials FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'material_purchases' AND policyname = '公开读取') THEN
        CREATE POLICY "公开读取" ON public.material_purchases FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'machine_usage' AND policyname = '公开读取') THEN
        CREATE POLICY "公开读取" ON public.machine_usage FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'labor_teams' AND policyname = '公开读取') THEN
        CREATE POLICY "公开读取" ON public.labor_teams FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'seals' AND policyname = '公开读取') THEN
        CREATE POLICY "公开读取" ON public.seals FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'seal_borrows' AND policyname = '公开读取') THEN
        CREATE POLICY "公开读取" ON public.seal_borrows FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workers' AND policyname = '公开读取') THEN
        CREATE POLICY "公开读取" ON public.workers FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'attendance' AND policyname = '公开读取') THEN
        CREATE POLICY "公开读取" ON public.attendance FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'wage_payments' AND policyname = '公开读取') THEN
        CREATE POLICY "公开读取" ON public.wage_payments FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'warnings' AND policyname = '公开读取') THEN
        CREATE POLICY "公开读取" ON public.warnings FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'project_attachments' AND policyname = '公开读取') THEN
        CREATE POLICY "公开读取" ON public.project_attachments FOR SELECT USING (true);
    END IF;
    
    -- 公开写入策略
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'projects' AND policyname = '公开插入') THEN
        CREATE POLICY "公开插入" ON public.projects FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = '公开插入') THEN
        CREATE POLICY "公开插入" ON public.profiles FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'suppliers' AND policyname = '公开插入') THEN
        CREATE POLICY "公开插入" ON public.suppliers FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cost_invoices' AND policyname = '公开插入') THEN
        CREATE POLICY "公开插入" ON public.cost_invoices FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payment_records' AND policyname = '公开插入') THEN
        CREATE POLICY "公开插入" ON public.payment_records FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'materials' AND policyname = '公开插入') THEN
        CREATE POLICY "公开插入" ON public.materials FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'material_purchases' AND policyname = '公开插入') THEN
        CREATE POLICY "公开插入" ON public.material_purchases FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'machine_usage' AND policyname = '公开插入') THEN
        CREATE POLICY "公开插入" ON public.machine_usage FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'labor_teams' AND policyname = '公开插入') THEN
        CREATE POLICY "公开插入" ON public.labor_teams FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'seals' AND policyname = '公开插入') THEN
        CREATE POLICY "公开插入" ON public.seals FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'seal_borrows' AND policyname = '公开插入') THEN
        CREATE POLICY "公开插入" ON public.seal_borrows FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workers' AND policyname = '公开插入') THEN
        CREATE POLICY "公开插入" ON public.workers FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'attendance' AND policyname = '公开插入') THEN
        CREATE POLICY "公开插入" ON public.attendance FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'wage_payments' AND policyname = '公开插入') THEN
        CREATE POLICY "公开插入" ON public.wage_payments FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'warnings' AND policyname = '公开插入') THEN
        CREATE POLICY "公开插入" ON public.warnings FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'project_attachments' AND policyname = '公开插入') THEN
        CREATE POLICY "公开插入" ON public.project_attachments FOR INSERT WITH CHECK (true);
    END IF;
    
    -- 公开更新策略
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'projects' AND policyname = '公开更新') THEN
        CREATE POLICY "公开更新" ON public.projects FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = '公开更新') THEN
        CREATE POLICY "公开更新" ON public.profiles FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'suppliers' AND policyname = '公开更新') THEN
        CREATE POLICY "公开更新" ON public.suppliers FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cost_invoices' AND policyname = '公开更新') THEN
        CREATE POLICY "公开更新" ON public.cost_invoices FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payment_records' AND policyname = '公开更新') THEN
        CREATE POLICY "公开更新" ON public.payment_records FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'materials' AND policyname = '公开更新') THEN
        CREATE POLICY "公开更新" ON public.materials FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'material_purchases' AND policyname = '公开更新') THEN
        CREATE POLICY "公开更新" ON public.material_purchases FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'machine_usage' AND policyname = '公开更新') THEN
        CREATE POLICY "公开更新" ON public.machine_usage FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'labor_teams' AND policyname = '公开更新') THEN
        CREATE POLICY "公开更新" ON public.labor_teams FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'seals' AND policyname = '公开更新') THEN
        CREATE POLICY "公开更新" ON public.seals FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'seal_borrows' AND policyname = '公开更新') THEN
        CREATE POLICY "公开更新" ON public.seal_borrows FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workers' AND policyname = '公开更新') THEN
        CREATE POLICY "公开更新" ON public.workers FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'attendance' AND policyname = '公开更新') THEN
        CREATE POLICY "公开更新" ON public.attendance FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'wage_payments' AND policyname = '公开更新') THEN
        CREATE POLICY "公开更新" ON public.wage_payments FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'warnings' AND policyname = '公开更新') THEN
        CREATE POLICY "公开更新" ON public.warnings FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'project_attachments' AND policyname = '公开更新') THEN
        CREATE POLICY "公开更新" ON public.project_attachments FOR UPDATE USING (true);
    END IF;
    
    -- 公开删除策略
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'projects' AND policyname = '管理员删除') THEN
        CREATE POLICY "管理员删除" ON public.projects FOR DELETE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = '管理员删除') THEN
        CREATE POLICY "管理员删除" ON public.profiles FOR DELETE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'suppliers' AND policyname = '管理员删除') THEN
        CREATE POLICY "管理员删除" ON public.suppliers FOR DELETE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cost_invoices' AND policyname = '管理员删除') THEN
        CREATE POLICY "管理员删除" ON public.cost_invoices FOR DELETE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payment_records' AND policyname = '管理员删除') THEN
        CREATE POLICY "管理员删除" ON public.payment_records FOR DELETE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'materials' AND policyname = '管理员删除') THEN
        CREATE POLICY "管理员删除" ON public.materials FOR DELETE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'material_purchases' AND policyname = '管理员删除') THEN
        CREATE POLICY "管理员删除" ON public.material_purchases FOR DELETE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'machine_usage' AND policyname = '管理员删除') THEN
        CREATE POLICY "管理员删除" ON public.machine_usage FOR DELETE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'labor_teams' AND policyname = '管理员删除') THEN
        CREATE POLICY "管理员删除" ON public.labor_teams FOR DELETE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'seals' AND policyname = '管理员删除') THEN
        CREATE POLICY "管理员删除" ON public.seals FOR DELETE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'seal_borrows' AND policyname = '管理员删除') THEN
        CREATE POLICY "管理员删除" ON public.seal_borrows FOR DELETE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workers' AND policyname = '管理员删除') THEN
        CREATE POLICY "管理员删除" ON public.workers FOR DELETE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'attendance' AND policyname = '管理员删除') THEN
        CREATE POLICY "管理员删除" ON public.attendance FOR DELETE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'wage_payments' AND policyname = '管理员删除') THEN
        CREATE POLICY "管理员删除" ON public.wage_payments FOR DELETE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'warnings' AND policyname = '管理员删除') THEN
        CREATE POLICY "管理员删除" ON public.warnings FOR DELETE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'project_attachments' AND policyname = '管理员删除') THEN
        CREATE POLICY "管理员删除" ON public.project_attachments FOR DELETE USING (true);
    END IF;
END $$;

-- ============================================
-- 第二部分：基础数据表
-- ============================================

-- 甲方单位表
CREATE TABLE IF NOT EXISTS party_a (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  unit_type VARCHAR(50),
  credit_code VARCHAR(50),
  bank_name VARCHAR(200),
  legal_person VARCHAR(100),
  bank_account VARCHAR(100),
  phone VARCHAR(50),
  remark TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 签约单位表
CREATE TABLE IF NOT EXISTS signatory_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_name VARCHAR(200) NOT NULL,
  unit_code VARCHAR(50) UNIQUE,
  credit_code VARCHAR(50),
  contact_person VARCHAR(100),
  contact_phone VARCHAR(50),
  office_address TEXT,
  invoice_title VARCHAR(200),
  tax_number VARCHAR(50),
  tax_disk_no VARCHAR(50),
  bank_name VARCHAR(200),
  bank_account VARCHAR(100),
  address TEXT,
  email VARCHAR(100),
  tax_province VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 乙方单位表
CREATE TABLE IF NOT EXISTS party_b (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_name VARCHAR(200) NOT NULL,
  unit_type VARCHAR(50),
  taxpayer_type VARCHAR(50),
  fax VARCHAR(50),
  is_certified BOOLEAN DEFAULT false,
  credit_code VARCHAR(50),
  bank_name VARCHAR(200),
  bank_account VARCHAR(100),
  legal_representative VARCHAR(100),
  phone VARCHAR(50),
  business_license_file TEXT,
  account_license_file TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 启用RLS
ALTER TABLE party_a ENABLE ROW LEVEL SECURITY;
ALTER TABLE signatory_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_b ENABLE ROW LEVEL SECURITY;

-- 基础数据表 RLS 策略
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'party_a' AND policyname = '所有人可查看甲方单位') THEN
        CREATE POLICY "所有人可查看甲方单位" ON party_a FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'party_a' AND policyname = '所有人可创建甲方单位') THEN
        CREATE POLICY "所有人可创建甲方单位" ON party_a FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'party_a' AND policyname = '所有人可更新甲方单位') THEN
        CREATE POLICY "所有人可更新甲方单位" ON party_a FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'party_b' AND policyname = '管理员可删除甲方单位') THEN
        CREATE POLICY "管理员可删除甲方单位" ON party_b FOR DELETE USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'signatory_units' AND policyname = '所有人可查看签约单位') THEN
        CREATE POLICY "所有人可查看签约单位" ON signatory_units FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'signatory_units' AND policyname = '所有人可创建签约单位') THEN
        CREATE POLICY "所有人可创建签约单位" ON signatory_units FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'signatory_units' AND policyname = '所有人可更新签约单位') THEN
        CREATE POLICY "所有人可更新签约单位" ON signatory_units FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'signatory_units' AND policyname = '管理员可删除签约单位') THEN
        CREATE POLICY "管理员可删除签约单位" ON signatory_units FOR DELETE USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'party_b' AND policyname = '所有人可查看乙方单位') THEN
        CREATE POLICY "所有人可查看乙方单位" ON party_b FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'party_b' AND policyname = '所有人可创建乙方单位') THEN
        CREATE POLICY "所有人可创建乙方单位" ON party_b FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'party_b' AND policyname = '所有人可更新乙方单位') THEN
        CREATE POLICY "所有人可更新乙方单位" ON party_b FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'party_b' AND policyname = '管理员可删除乙方单位') THEN
        CREATE POLICY "管理员可删除乙方单位" ON party_b FOR DELETE USING (true);
    END IF;
END $$;

-- ============================================
-- 第三部分：公司管理表
-- ============================================

-- 公司表
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company_type TEXT NOT NULL CHECK (company_type IN ('总公司', '分公司')),
  parent_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  credit_code TEXT,
  contact_person TEXT,
  contact_phone TEXT,
  status TEXT DEFAULT '启用' CHECK (status IN ('启用', '禁用')),
  remark TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 用户公司关联表
CREATE TABLE IF NOT EXISTS user_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT DEFAULT '员工' CHECK (role IN ('超级管理员', '公司管理员', '员工')),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, company_id)
);

-- 项目表增加 company_id
ALTER TABLE projects ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

-- 乙方单位表增加 company_id
ALTER TABLE party_b ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

-- 甲方单位表增加 company_id
ALTER TABLE party_a ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

-- 供应商表增加 company_id
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

-- 启用 RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_companies ENABLE ROW LEVEL SECURITY;

-- 公司管理 RLS 策略
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'companies' AND policyname = '允许所有操作') THEN
        CREATE POLICY "允许所有操作" ON companies FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_companies' AND policyname = '允许所有操作') THEN
        CREATE POLICY "允许所有操作" ON user_companies FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 插入默认总公司 (如果不存在)
INSERT INTO companies (name, company_type, status)
SELECT '默认总公司', '总公司', '启用'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = '默认总公司');

-- ============================================
-- 第四部分：项目表增加 party_a_id 和 signatory_id
-- ============================================

ALTER TABLE projects ADD COLUMN IF NOT EXISTS party_a_id UUID REFERENCES party_a(id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS signatory_id UUID REFERENCES signatory_units(id) ON DELETE SET NULL;

-- ============================================
-- 完成！
-- ============================================
