-- 物资管理模块：固定资产相关表
-- 功能：固定资产档案、分类、变动、折旧、报废
-- 执行顺序：2

-- 1. 创建固定资产分类表 fixed_asset_categories
CREATE TABLE IF NOT EXISTS public.fixed_asset_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50),
  name VARCHAR(100) NOT NULL,
  depreciation_years INT DEFAULT 5,
  depreciation_method VARCHAR(20) DEFAULT 'straight_line' CHECK (depreciation_method IN ('straight_line', 'double_declining', 'units_of_production')),
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.fixed_asset_categories IS '固定资产分类表';
COMMENT ON COLUMN public.fixed_asset_categories.depreciation_method IS '折旧方法：straight_line-直线法, double_declining-双倍余额递减, units_of_production-工作量法';

ALTER TABLE public.fixed_asset_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fixed_asset_categories_select" ON public.fixed_asset_categories FOR SELECT USING (true);
CREATE POLICY "fixed_asset_categories_insert" ON public.fixed_asset_categories FOR INSERT WITH CHECK (true);
CREATE POLICY "fixed_asset_categories_update" ON public.fixed_asset_categories FOR UPDATE USING (true);
CREATE POLICY "fixed_asset_categories_delete" ON public.fixed_asset_categories FOR DELETE USING (true);

-- 2. 创建固定资产档案表 fixed_assets
CREATE TABLE IF NOT EXISTS public.fixed_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  category_id UUID REFERENCES public.fixed_asset_categories(id) ON DELETE SET NULL,
  model VARCHAR(100),
  serial_no VARCHAR(100),
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.party_b(id) ON DELETE SET NULL,
  purchase_date DATE,
  purchase_amount DECIMAL(12,2) NOT NULL,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  depreciation_method VARCHAR(20) DEFAULT 'straight_line',
  depreciation_years INT DEFAULT 5,
  salvage_value DECIMAL(12,2) DEFAULT 0,
  monthly_depreciation DECIMAL(12,2),
  current_value DECIMAL(12,2),
  status VARCHAR(20) DEFAULT 'in_use' CHECK (status IN ('idling', 'in_use', 'repair', 'scrapped', 'transferred')),
  location VARCHAR(200),
  keeper_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  qr_code_url TEXT,
  remark TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.fixed_assets IS '固定资产档案表';
COMMENT ON COLUMN public.fixed_assets.asset_code IS '资产编码，格式：ZC-项目缩写-分类-日期流水';
COMMENT ON COLUMN public.fixed_assets.monthly_depreciation IS '月折旧额（自动计算）';
COMMENT ON COLUMN public.fixed_assets.current_value IS '当前净值';

ALTER TABLE public.fixed_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fixed_assets_select" ON public.fixed_assets FOR SELECT USING (true);
CREATE POLICY "fixed_assets_insert" ON public.fixed_assets FOR INSERT WITH CHECK (true);
CREATE POLICY "fixed_assets_update" ON public.fixed_assets FOR UPDATE USING (true);
CREATE POLICY "fixed_assets_delete" ON public.fixed_assets FOR DELETE USING (true);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_fixed_assets_project ON public.fixed_assets(project_id);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_category ON public.fixed_assets(category_id);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_status ON public.fixed_assets(status);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_keeper ON public.fixed_assets(keeper_id);

-- 3. 创建资产变动记录表 asset_transactions
CREATE TABLE IF NOT EXISTS public.asset_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.fixed_assets(id) ON DELETE CASCADE,
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('allocation', 'transfer', 'return', 'keeper_change', 'location_change', 'scrapped')),
  from_user_id UUID REFERENCES public.users(id),
  to_user_id UUID REFERENCES public.users(id),
  from_project_id UUID REFERENCES public.projects(id),
  to_project_id UUID REFERENCES public.projects(id),
  from_location VARCHAR(200),
  to_location VARCHAR(200),
  transaction_date DATE NOT NULL,
  approval_id UUID,
  remark TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.asset_transactions IS '资产变动记录表';
COMMENT ON COLUMN public.asset_transactions.transaction_type IS '变动类型：allocation-领用, transfer-调拨, return-归还, keeper_change-保管人变更, location_change-位置变更, scrapped-报废';

ALTER TABLE public.asset_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "asset_transactions_select" ON public.asset_transactions FOR SELECT USING (true);
CREATE POLICY "asset_transactions_insert" ON public.asset_transactions FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_asset_transactions_asset ON public.asset_transactions(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_transactions_date ON public.asset_transactions(transaction_date);

-- 4. 创建资产折旧记录表 asset_depreciation_records
CREATE TABLE IF NOT EXISTS public.asset_depreciation_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.fixed_assets(id) ON DELETE CASCADE,
  period_year INT NOT NULL,
  period_month INT NOT NULL,
  depreciation_amount DECIMAL(12,2) NOT NULL,
  cumulative_depreciation DECIMAL(12,2),
  net_value DECIMAL(12,2),
  project_id UUID REFERENCES public.projects(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.asset_depreciation_records IS '资产折旧记录表';

ALTER TABLE public.asset_depreciation_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "asset_depreciation_records_select" ON public.asset_depreciation_records FOR SELECT USING (true);
CREATE POLICY "asset_depreciation_records_insert" ON public.asset_depreciation_records FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_depreciation_asset ON public.asset_depreciation_records(asset_id);
CREATE INDEX IF NOT EXISTS idx_depreciation_period ON public.asset_depreciation_records(period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_depreciation_project ON public.asset_depreciation_records(project_id);

-- 5. 创建资产报废申请单表 asset_scrap_requests
CREATE TABLE IF NOT EXISTS public.asset_scrap_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scrap_no VARCHAR(50) UNIQUE NOT NULL,
  asset_id UUID NOT NULL REFERENCES public.fixed_assets(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id),
  reason TEXT NOT NULL,
  estimated_loss DECIMAL(12,2),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  approval_id UUID,
  approved_at TIMESTAMP,
  approver_id UUID REFERENCES public.users(id),
  reject_reason TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.asset_scrap_requests IS '资产报废申请单表';

ALTER TABLE public.asset_scrap_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "asset_scrap_requests_select" ON public.asset_scrap_requests FOR SELECT USING (true);
CREATE POLICY "asset_scrap_requests_insert" ON public.asset_scrap_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "asset_scrap_requests_update" ON public.asset_scrap_requests FOR UPDATE USING (true);

CREATE INDEX IF NOT EXISTS idx_scrap_asset ON public.asset_scrap_requests(asset_id);
CREATE INDEX IF NOT EXISTS idx_scrap_status ON public.asset_scrap_requests(status);

-- 6. 插入示例固定资产分类数据
INSERT INTO public.fixed_asset_categories (code, name, depreciation_years, sort_order) VALUES
  ('01', '生产设备', 10, 1),
  ('02', '运输设备', 5, 2),
  ('03', '办公设备', 5, 3),
  ('04', '施工机械', 8, 4),
  ('05', '测量仪器', 5, 5),
  ('06', '电子设备', 3, 6),
  ('07', '其他设备', 5, 7)
ON CONFLICT DO NOTHING;

-- 7. 创建触发器：自动计算月折旧额和当前净值
CREATE OR REPLACE FUNCTION calculate_asset_depreciation()
RETURNS TRIGGER AS $$
BEGIN
  -- 计算月折旧额（直线法）
  IF NEW.depreciation_method = 'straight_line' AND NEW.depreciation_years > 0 THEN
    NEW.monthly_depreciation := (NEW.purchase_amount - COALESCE(NEW.salvage_value, 0)) / (NEW.depreciation_years * 12);
  END IF;
  
  -- 初始化当前净值为购买金额
  IF NEW.current_value IS NULL THEN
    NEW.current_value := NEW.purchase_amount;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_calculate_asset_depreciation
  BEFORE INSERT OR UPDATE ON public.fixed_assets
  FOR EACH ROW
  EXECUTE FUNCTION calculate_asset_depreciation();

-- 8. 创建 updated_at 触发器
CREATE OR REPLACE TRIGGER update_fixed_assets_updated_at
  BEFORE UPDATE ON public.fixed_assets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
