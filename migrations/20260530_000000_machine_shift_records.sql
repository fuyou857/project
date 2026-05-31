-- 机械管理模块：机器台班记录表及扩展字段
-- 简化版 - 移除对 current_user_id() 的依赖

-- 1. 创建 machines 表（设备/机械档案表）
CREATE TABLE IF NOT EXISTS public.machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  spec VARCHAR(100),
  unit VARCHAR(20) DEFAULT '台班',
  default_shift_price DECIMAL(12,2),
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.party_b(id) ON DELETE SET NULL,
  date DATE,
  status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'repair', 'scrapped')),
  remark TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "machines_select" ON public.machines FOR SELECT USING (true);
CREATE POLICY "machines_insert" ON public.machines FOR INSERT WITH CHECK (true);
CREATE POLICY "machines_update" ON public.machines FOR UPDATE USING (true);
CREATE POLICY "machines_delete" ON public.machines FOR DELETE USING (true);

-- 2. 扩展 expense_contracts 表
ALTER TABLE public.expense_contracts ADD COLUMN IF NOT EXISTS contract_type VARCHAR(20);
ALTER TABLE public.expense_contracts ADD COLUMN IF NOT EXISTS shift_price DECIMAL(12,2);
ALTER TABLE public.expense_contracts ADD COLUMN IF NOT EXISTS total_budget_shifts DECIMAL(12,2);
ALTER TABLE public.expense_contracts ADD COLUMN IF NOT EXISTS used_shifts DECIMAL(12,2) DEFAULT 0;
ALTER TABLE public.expense_contracts ADD COLUMN IF NOT EXISTS used_amount DECIMAL(12,2) DEFAULT 0;

-- 3. 创建 machine_shift_records 表
CREATE TABLE IF NOT EXISTS public.machine_shift_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  rental_contract_id UUID REFERENCES public.expense_contracts(id) ON DELETE SET NULL,
  record_date DATE NOT NULL,
  shift_count DECIMAL(10,2) NOT NULL CHECK (shift_count > 0),
  start_time TIME,
  end_time TIME,
  cost_per_shift DECIMAL(12,2),
  total_cost DECIMAL(12,2) GENERATED ALWAYS AS (
    CASE WHEN shift_count IS NOT NULL AND cost_per_shift IS NOT NULL 
    THEN shift_count * cost_per_shift ELSE NULL END
  ) STORED,
  operator VARCHAR(100),
  remark TEXT,
  images JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'confirmed', 'rejected')),
  approval_id UUID,
  is_settled BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.machine_shift_records ENABLE ROW LEVEL SECURITY;

-- 简化的 RLS 策略（不依赖 current_user_id()）
CREATE POLICY "machine_shift_records_select" ON public.machine_shift_records FOR SELECT USING (true);
CREATE POLICY "machine_shift_records_insert" ON public.machine_shift_records FOR INSERT WITH CHECK (true);
CREATE POLICY "machine_shift_records_update" ON public.machine_shift_records FOR UPDATE USING (true);
CREATE POLICY "machine_shift_records_delete" ON public.machine_shift_records FOR DELETE USING (true);

-- 4. 添加审批流程配置
INSERT INTO public.approval_steps (source_type, step_order, step_name, approver_role) VALUES 
  ('machine_shift', 1, '项目经理审核', 'manager'),
  ('machine_shift', 2, '财务确认', 'finance')
ON CONFLICT DO NOTHING;

-- 5. 插入初始设备数据
INSERT INTO public.machines (code, name, spec, unit, default_shift_price, status) VALUES
  ('EQ001', '挖掘机', 'CAT320', '台', 1800.00, 'available'),
  ('EQ002', '塔吊', 'QTZ80', '台', 2500.00, 'available'),
  ('EQ003', '混凝土泵车', '37米', '辆', 3200.00, 'available'),
  ('EQ004', '压路机', 'XS223J', '台', 1200.00, 'available'),
  ('EQ005', '装载机', 'ZL50', '台', 1000.00, 'available'),
  ('EQ006', '吊车', '25吨', '台', 2800.00, 'in_use'),
  ('EQ007', '推土机', 'D65', '台', 1500.00, 'available'),
  ('EQ008', '发电机', '200KW', '台', 800.00, 'repair')
ON CONFLICT (code) DO NOTHING;
