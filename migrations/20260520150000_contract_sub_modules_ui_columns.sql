-- 合同子业务表：补齐 UI 字段 + 创建生产库缺失的支出子表
-- 兼容 final_database_setup（旧列名保留）；可重复执行
-- 执行后：Supabase Dashboard → Settings → API → Reload schema cache

-- =============================================================================
-- 1. 支出侧子表（final_database_setup 未创建，此处 IF NOT EXISTS 补建）
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.expense_supplements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplement_code VARCHAR(50),
  main_contract_id UUID REFERENCES public.expense_contracts(id) ON DELETE CASCADE,
  supplement_name VARCHAR(255),
  supplement_amount DECIMAL(15,2) DEFAULT 0,
  sign_date DATE,
  attachment_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.expense_variations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variation_code VARCHAR(50),
  contract_id UUID REFERENCES public.expense_contracts(id) ON DELETE CASCADE,
  variation_name VARCHAR(255),
  variation_amount DECIMAL(15,2) DEFAULT 0,
  variation_date DATE,
  attachment_url TEXT,
  approval_status VARCHAR(20) DEFAULT '待审核',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.expense_deductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deduction_code VARCHAR(50),
  contract_id UUID REFERENCES public.expense_contracts(id) ON DELETE CASCADE,
  deduction_reason TEXT,
  deduction_amount DECIMAL(15,2) DEFAULT 0,
  deduction_date DATE,
  attachment_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.expense_performances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES public.expense_contracts(id) ON DELETE CASCADE,
  performance_content TEXT,
  performance_ratio DECIMAL(5,2) DEFAULT 0,
  performance_date DATE,
  attachment_url TEXT,
  cumulative_amount DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.expense_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_code VARCHAR(50),
  contract_id UUID REFERENCES public.expense_contracts(id) ON DELETE CASCADE,
  settlement_amount DECIMAL(15,2) DEFAULT 0,
  settlement_date DATE,
  attachment_url TEXT,
  status VARCHAR(20) DEFAULT '未结算',
  created_at TIMESTAMP DEFAULT NOW()
);

-- 支出子表 RLS（与现有公开策略一致）
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'expense_supplements', 'expense_variations', 'expense_deductions',
    'expense_performances', 'expense_settlements'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = '公开读取') THEN
        EXECUTE format('CREATE POLICY "公开读取" ON public.%I FOR SELECT USING (true)', t);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = '公开插入') THEN
        EXECUTE format('CREATE POLICY "公开插入" ON public.%I FOR INSERT WITH CHECK (true)', t);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = '公开更新') THEN
        EXECUTE format('CREATE POLICY "公开更新" ON public.%I FOR UPDATE USING (true)', t);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = '管理员删除') THEN
        EXECUTE format('CREATE POLICY "管理员删除" ON public.%I FOR DELETE USING (true)', t);
      END IF;
    END IF;
  END LOOP;
END $$;

-- =============================================================================
-- 2. 收入侧：在已有表上 ADD COLUMN（表不存在则跳过）
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'income_supplements') THEN
    ALTER TABLE public.income_supplements
      ADD COLUMN IF NOT EXISTS supplement_code VARCHAR(50),
      ADD COLUMN IF NOT EXISTS supplement_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS supplement_amount DECIMAL(15,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS sign_date DATE,
      ADD COLUMN IF NOT EXISTS attachment_url TEXT;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'income_variations') THEN
    ALTER TABLE public.income_variations
      ADD COLUMN IF NOT EXISTS variation_code VARCHAR(50),
      ADD COLUMN IF NOT EXISTS contract_id UUID REFERENCES public.income_contracts(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS variation_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS variation_amount DECIMAL(15,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS variation_date DATE,
      ADD COLUMN IF NOT EXISTS attachment_url TEXT,
      ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT '待审核';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'income_deductions') THEN
    ALTER TABLE public.income_deductions
      ADD COLUMN IF NOT EXISTS deduction_code VARCHAR(50),
      ADD COLUMN IF NOT EXISTS contract_id UUID REFERENCES public.income_contracts(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS deduction_reason TEXT,
      ADD COLUMN IF NOT EXISTS deduction_amount DECIMAL(15,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS deduction_date DATE,
      ADD COLUMN IF NOT EXISTS attachment_url TEXT;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'income_output_confirmations') THEN
    ALTER TABLE public.income_output_confirmations
      ADD COLUMN IF NOT EXISTS confirmation_code VARCHAR(50),
      ADD COLUMN IF NOT EXISTS contract_id UUID REFERENCES public.income_contracts(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS output_month VARCHAR(7),
      ADD COLUMN IF NOT EXISTS confirmation_amount DECIMAL(15,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS confirmation_date DATE,
      ADD COLUMN IF NOT EXISTS attachment_url TEXT,
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT '待确认';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'income_settlements') THEN
    ALTER TABLE public.income_settlements
      ADD COLUMN IF NOT EXISTS settlement_code VARCHAR(50),
      ADD COLUMN IF NOT EXISTS contract_id UUID REFERENCES public.income_contracts(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS settlement_amount DECIMAL(15,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS settlement_date DATE,
      ADD COLUMN IF NOT EXISTS attachment_url TEXT,
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT '未结算';
  END IF;
END $$;

-- =============================================================================
-- 3. 支出侧：在已有表上 ADD COLUMN（新建表已含全字段，此处兜底旧表）
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'expense_supplements') THEN
    ALTER TABLE public.expense_supplements
      ADD COLUMN IF NOT EXISTS supplement_code VARCHAR(50),
      ADD COLUMN IF NOT EXISTS supplement_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS supplement_amount DECIMAL(15,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS sign_date DATE,
      ADD COLUMN IF NOT EXISTS attachment_url TEXT;
    -- 若仅有 main_contract_id 无 contract_id 列名差异：补充协议统一用 main_contract_id，无需 contract_id
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'expense_supplements' AND column_name = 'main_contract_id'
    ) THEN
      ALTER TABLE public.expense_supplements
        ADD COLUMN IF NOT EXISTS main_contract_id UUID REFERENCES public.expense_contracts(id) ON DELETE CASCADE;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'expense_variations') THEN
    ALTER TABLE public.expense_variations
      ADD COLUMN IF NOT EXISTS variation_code VARCHAR(50),
      ADD COLUMN IF NOT EXISTS contract_id UUID REFERENCES public.expense_contracts(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS variation_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS variation_amount DECIMAL(15,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS variation_date DATE,
      ADD COLUMN IF NOT EXISTS attachment_url TEXT,
      ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT '待审核';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'expense_deductions') THEN
    ALTER TABLE public.expense_deductions
      ADD COLUMN IF NOT EXISTS deduction_code VARCHAR(50),
      ADD COLUMN IF NOT EXISTS contract_id UUID REFERENCES public.expense_contracts(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS deduction_reason TEXT,
      ADD COLUMN IF NOT EXISTS deduction_amount DECIMAL(15,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS deduction_date DATE,
      ADD COLUMN IF NOT EXISTS attachment_url TEXT;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'expense_performances') THEN
    ALTER TABLE public.expense_performances
      ADD COLUMN IF NOT EXISTS contract_id UUID REFERENCES public.expense_contracts(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS performance_content TEXT,
      ADD COLUMN IF NOT EXISTS performance_ratio DECIMAL(5,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS performance_date DATE,
      ADD COLUMN IF NOT EXISTS attachment_url TEXT,
      ADD COLUMN IF NOT EXISTS cumulative_amount DECIMAL(15,2) DEFAULT 0;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'expense_settlements') THEN
    ALTER TABLE public.expense_settlements
      ADD COLUMN IF NOT EXISTS settlement_code VARCHAR(50),
      ADD COLUMN IF NOT EXISTS contract_id UUID REFERENCES public.expense_contracts(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS settlement_amount DECIMAL(15,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS settlement_date DATE,
      ADD COLUMN IF NOT EXISTS attachment_url TEXT,
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT '未结算';
  END IF;
END $$;

-- =============================================================================
-- 4. 旧列 → UI 列回填（仅当旧列存在时）
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'income_variations' AND column_name = 'main_contract_id') THEN
    UPDATE public.income_variations SET contract_id = main_contract_id WHERE contract_id IS NULL AND main_contract_id IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'income_variations' AND column_name = 'change_amount') THEN
    UPDATE public.income_variations SET variation_amount = change_amount WHERE variation_amount IS NULL AND change_amount IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'income_variations' AND column_name = 'change_reason') THEN
    UPDATE public.income_variations SET variation_name = change_reason WHERE variation_name IS NULL AND change_reason IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'income_variations' AND column_name = 'change_date') THEN
    UPDATE public.income_variations SET variation_date = change_date WHERE variation_date IS NULL AND change_date IS NOT NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'income_supplements' AND column_name = 'supplement_date') THEN
    UPDATE public.income_supplements SET sign_date = supplement_date WHERE sign_date IS NULL AND supplement_date IS NOT NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'income_settlements' AND column_name = 'main_contract_id') THEN
    UPDATE public.income_settlements SET contract_id = main_contract_id WHERE contract_id IS NULL AND main_contract_id IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'income_output_confirmations' AND column_name = 'main_contract_id') THEN
    UPDATE public.income_output_confirmations SET contract_id = main_contract_id WHERE contract_id IS NULL AND main_contract_id IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'income_output_confirmations' AND column_name = 'output_amount') THEN
    UPDATE public.income_output_confirmations SET confirmation_amount = output_amount WHERE confirmation_amount IS NULL AND output_amount IS NOT NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'income_deductions' AND column_name = 'main_contract_id') THEN
    UPDATE public.income_deductions SET contract_id = main_contract_id WHERE contract_id IS NULL AND main_contract_id IS NOT NULL;
  END IF;
END $$;
