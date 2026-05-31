-- ========================================
-- 物资管理模块：完整数据库结构（修复版）
-- 会先删除可能存在的冲突表，然后重新创建
-- ========================================

-- 删除可能存在的冲突表（按依赖顺序，反向删除）
DROP TABLE IF EXISTS public.purchase_request_items CASCADE;
DROP TABLE IF EXISTS public.purchase_requests CASCADE;
DROP TABLE IF EXISTS public.material_stock CASCADE;
DROP TABLE IF EXISTS public.material_issue_items CASCADE;
DROP TABLE IF EXISTS public.material_issues CASCADE;
DROP TABLE IF EXISTS public.material_receipt_items CASCADE;
DROP TABLE IF EXISTS public.material_receipts CASCADE;
DROP TABLE IF EXISTS public.purchase_order_items CASCADE;
DROP TABLE IF EXISTS public.purchase_orders CASCADE;
DROP TABLE IF EXISTS public.asset_scrap_requests CASCADE;
DROP TABLE IF EXISTS public.asset_depreciation_records CASCADE;
DROP TABLE IF EXISTS public.asset_transactions CASCADE;
DROP TABLE IF EXISTS public.fixed_assets CASCADE;
DROP TABLE IF EXISTS public.fixed_asset_categories CASCADE;
DROP TABLE IF EXISTS public.materials CASCADE;
DROP TABLE IF EXISTS public.material_categories CASCADE;
DROP TABLE IF EXISTS public.warehouses CASCADE;

-- ===== 第一部分：基础数据表 =====

-- 1. 仓库表 warehouses
CREATE TABLE public.warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  code VARCHAR(50),
  name VARCHAR(100) NOT NULL,
  location VARCHAR(200),
  manager_id UUID REFERENCES public.users(id),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "warehouses_select" ON public.warehouses FOR SELECT USING (true);
CREATE POLICY "warehouses_insert" ON public.warehouses FOR INSERT WITH CHECK (true);
CREATE POLICY "warehouses_update" ON public.warehouses FOR UPDATE USING (true);
CREATE POLICY "warehouses_delete" ON public.warehouses FOR DELETE USING (true);

-- 2. 物资分类表 material_categories
CREATE TABLE public.material_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50),
  name VARCHAR(100) NOT NULL,
  parent_id UUID REFERENCES public.material_categories(id) ON DELETE SET NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.material_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "material_categories_select" ON public.material_categories FOR SELECT USING (true);
CREATE POLICY "material_categories_insert" ON public.material_categories FOR INSERT WITH CHECK (true);
CREATE POLICY "material_categories_update" ON public.material_categories FOR UPDATE USING (true);
CREATE POLICY "material_categories_delete" ON public.material_categories FOR DELETE USING (true);

-- 3. 物资档案表 materials
CREATE TABLE public.materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  specification VARCHAR(200),
  unit VARCHAR(20) NOT NULL,
  category_id UUID REFERENCES public.material_categories(id) ON DELETE SET NULL,
  default_price DECIMAL(10,2),
  min_stock DECIMAL(10,2) DEFAULT 0,
  current_stock DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'discontinued')),
  remark TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "materials_select" ON public.materials FOR SELECT USING (true);
CREATE POLICY "materials_insert" ON public.materials FOR INSERT WITH CHECK (true);
CREATE POLICY "materials_update" ON public.materials FOR UPDATE USING (true);
CREATE POLICY "materials_delete" ON public.materials FOR DELETE USING (true);

CREATE INDEX idx_materials_category ON public.materials(category_id);
CREATE INDEX idx_materials_code ON public.materials(code);
CREATE INDEX idx_materials_status ON public.materials(status);

-- ===== 第二部分：固定资产相关表 =====

-- 4. 固定资产分类表 fixed_asset_categories
CREATE TABLE public.fixed_asset_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50),
  name VARCHAR(100) NOT NULL,
  depreciation_years INT DEFAULT 5,
  depreciation_method VARCHAR(20) DEFAULT 'straight_line' CHECK (depreciation_method IN ('straight_line', 'double_declining', 'units_of_production')),
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.fixed_asset_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fixed_asset_categories_select" ON public.fixed_asset_categories FOR SELECT USING (true);
CREATE POLICY "fixed_asset_categories_insert" ON public.fixed_asset_categories FOR INSERT WITH CHECK (true);
CREATE POLICY "fixed_asset_categories_update" ON public.fixed_asset_categories FOR UPDATE USING (true);
CREATE POLICY "fixed_asset_categories_delete" ON public.fixed_asset_categories FOR DELETE USING (true);

-- 5. 固定资产档案表 fixed_assets
CREATE TABLE public.fixed_assets (
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

ALTER TABLE public.fixed_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fixed_assets_select" ON public.fixed_assets FOR SELECT USING (true);
CREATE POLICY "fixed_assets_insert" ON public.fixed_assets FOR INSERT WITH CHECK (true);
CREATE POLICY "fixed_assets_update" ON public.fixed_assets FOR UPDATE USING (true);
CREATE POLICY "fixed_assets_delete" ON public.fixed_assets FOR DELETE USING (true);

CREATE INDEX idx_fixed_assets_project ON public.fixed_assets(project_id);
CREATE INDEX idx_fixed_assets_category ON public.fixed_assets(category_id);
CREATE INDEX idx_fixed_assets_status ON public.fixed_assets(status);
CREATE INDEX idx_fixed_assets_keeper ON public.fixed_assets(keeper_id);

-- 6. 资产变动记录表 asset_transactions
CREATE TABLE public.asset_transactions (
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

ALTER TABLE public.asset_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "asset_transactions_select" ON public.asset_transactions FOR SELECT USING (true);
CREATE POLICY "asset_transactions_insert" ON public.asset_transactions FOR INSERT WITH CHECK (true);

CREATE INDEX idx_asset_transactions_asset ON public.asset_transactions(asset_id);
CREATE INDEX idx_asset_transactions_date ON public.asset_transactions(transaction_date);

-- 7. 资产折旧记录表 asset_depreciation_records
CREATE TABLE public.asset_depreciation_records (
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

ALTER TABLE public.asset_depreciation_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "asset_depreciation_records_select" ON public.asset_depreciation_records FOR SELECT USING (true);
CREATE POLICY "asset_depreciation_records_insert" ON public.asset_depreciation_records FOR INSERT WITH CHECK (true);

CREATE INDEX idx_depreciation_asset ON public.asset_depreciation_records(asset_id);
CREATE INDEX idx_depreciation_period ON public.asset_depreciation_records(period_year, period_month);
CREATE INDEX idx_depreciation_project ON public.asset_depreciation_records(project_id);

-- 8. 资产报废申请单表 asset_scrap_requests
CREATE TABLE public.asset_scrap_requests (
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

ALTER TABLE public.asset_scrap_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "asset_scrap_requests_select" ON public.asset_scrap_requests FOR SELECT USING (true);
CREATE POLICY "asset_scrap_requests_insert" ON public.asset_scrap_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "asset_scrap_requests_update" ON public.asset_scrap_requests FOR UPDATE USING (true);

CREATE INDEX idx_scrap_asset ON public.asset_scrap_requests(asset_id);
CREATE INDEX idx_scrap_status ON public.asset_scrap_requests(status);

-- ===== 第三部分：采购与库存表 =====

-- 9. 采购订单主表 purchase_orders
CREATE TABLE public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no VARCHAR(50) UNIQUE NOT NULL,
  contract_id UUID REFERENCES public.expense_contracts(id) ON DELETE SET NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.party_b(id),
  order_date DATE NOT NULL,
  total_amount DECIMAL(12,2) DEFAULT 0,
  paid_amount DECIMAL(12,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'partially_received', 'received', 'cancelled')),
  delivery_date DATE,
  payment_terms VARCHAR(100),
  remark TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approval_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchase_orders_select" ON public.purchase_orders FOR SELECT USING (true);
CREATE POLICY "purchase_orders_insert" ON public.purchase_orders FOR INSERT WITH CHECK (true);
CREATE POLICY "purchase_orders_update" ON public.purchase_orders FOR UPDATE USING (true);
CREATE POLICY "purchase_orders_delete" ON public.purchase_orders FOR DELETE USING (true);

CREATE INDEX idx_purchase_orders_project ON public.purchase_orders(project_id);
CREATE INDEX idx_purchase_orders_supplier ON public.purchase_orders(supplier_id);
CREATE INDEX idx_purchase_orders_status ON public.purchase_orders(status);

-- 10. 采购订单明细表 purchase_order_items
CREATE TABLE public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES public.materials(id),
  quantity DECIMAL(10,2) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  amount DECIMAL(12,2) GENERATED ALWAYS AS (quantity * price) STORED,
  total_amount DECIMAL(12,2) GENERATED ALWAYS AS (quantity * price * (1 + COALESCE(tax_rate, 0) / 100)) STORED,
  received_quantity DECIMAL(10,2) DEFAULT 0,
  delivered_quantity DECIMAL(10,2) DEFAULT 0,
  remark TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchase_order_items_select" ON public.purchase_order_items FOR SELECT USING (true);
CREATE POLICY "purchase_order_items_insert" ON public.purchase_order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "purchase_order_items_update" ON public.purchase_order_items FOR UPDATE USING (true);
CREATE POLICY "purchase_order_items_delete" ON public.purchase_order_items FOR DELETE USING (true);

CREATE INDEX idx_order_items_order ON public.purchase_order_items(order_id);
CREATE INDEX idx_order_items_material ON public.purchase_order_items(material_id);

-- 11. 入库单主表 material_receipts
CREATE TABLE public.material_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_no VARCHAR(50) UNIQUE NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.party_b(id),
  order_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  receipt_date DATE NOT NULL,
  total_amount DECIMAL(12,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'confirmed', 'cancelled')),
  inspector VARCHAR(100),
  remark TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approval_id UUID,
  confirmed_at TIMESTAMP,
  confirmed_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.material_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "material_receipts_select" ON public.material_receipts FOR SELECT USING (true);
CREATE POLICY "material_receipts_insert" ON public.material_receipts FOR INSERT WITH CHECK (true);
CREATE POLICY "material_receipts_update" ON public.material_receipts FOR UPDATE USING (true);
CREATE POLICY "material_receipts_delete" ON public.material_receipts FOR DELETE USING (true);

CREATE INDEX idx_material_receipts_project ON public.material_receipts(project_id);
CREATE INDEX idx_material_receipts_warehouse ON public.material_receipts(warehouse_id);
CREATE INDEX idx_material_receipts_order ON public.material_receipts(order_id);
CREATE INDEX idx_material_receipts_status ON public.material_receipts(status);

-- 12. 入库单明细表 material_receipt_items
CREATE TABLE public.material_receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES public.material_receipts(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES public.materials(id),
  order_item_id UUID REFERENCES public.purchase_order_items(id) ON DELETE SET NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  price DECIMAL(10,2),
  amount DECIMAL(12,2) GENERATED ALWAYS AS (quantity * COALESCE(price, 0)) STORED,
  batch_no VARCHAR(50),
  production_date DATE,
  expiry_date DATE,
  qualified_quantity DECIMAL(10,2),
  remark TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.material_receipt_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "material_receipt_items_select" ON public.material_receipt_items FOR SELECT USING (true);
CREATE POLICY "material_receipt_items_insert" ON public.material_receipt_items FOR INSERT WITH CHECK (true);
CREATE POLICY "material_receipt_items_update" ON public.material_receipt_items FOR UPDATE USING (true);
CREATE POLICY "material_receipt_items_delete" ON public.material_receipt_items FOR DELETE USING (true);

CREATE INDEX idx_receipt_items_receipt ON public.material_receipt_items(receipt_id);
CREATE INDEX idx_receipt_items_material ON public.material_receipt_items(material_id);

-- 13. 领料单主表 material_issues
CREATE TABLE public.material_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_no VARCHAR(50) UNIQUE NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  cost_center VARCHAR(100),
  issue_date DATE NOT NULL,
  total_amount DECIMAL(12,2) DEFAULT 0,
  purpose VARCHAR(50),
  requester_id UUID REFERENCES public.users(id),
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'confirmed', 'cancelled')),
  approval_id UUID,
  confirmed_at TIMESTAMP,
  confirmed_by UUID REFERENCES public.users(id),
  remark TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.material_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "material_issues_select" ON public.material_issues FOR SELECT USING (true);
CREATE POLICY "material_issues_insert" ON public.material_issues FOR INSERT WITH CHECK (true);
CREATE POLICY "material_issues_update" ON public.material_issues FOR UPDATE USING (true);
CREATE POLICY "material_issues_delete" ON public.material_issues FOR DELETE USING (true);

CREATE INDEX idx_material_issues_project ON public.material_issues(project_id);
CREATE INDEX idx_material_issues_warehouse ON public.material_issues(warehouse_id);
CREATE INDEX idx_material_issues_status ON public.material_issues(status);

-- 14. 领料单明细表 material_issue_items
CREATE TABLE public.material_issue_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES public.material_issues(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES public.materials(id),
  quantity DECIMAL(10,2) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  price DECIMAL(10,2),
  amount DECIMAL(12,2) GENERATED ALWAYS AS (quantity * COALESCE(price, 0)) STORED,
  remark TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.material_issue_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "material_issue_items_select" ON public.material_issue_items FOR SELECT USING (true);
CREATE POLICY "material_issue_items_insert" ON public.material_issue_items FOR INSERT WITH CHECK (true);
CREATE POLICY "material_issue_items_update" ON public.material_issue_items FOR UPDATE USING (true);
CREATE POLICY "material_issue_items_delete" ON public.material_issue_items FOR DELETE USING (true);

CREATE INDEX idx_issue_items_issue ON public.material_issue_items(issue_id);
CREATE INDEX idx_issue_items_material ON public.material_issue_items(material_id);

-- 15. 项目库存表 material_stock
CREATE TABLE public.material_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  stock_quantity DECIMAL(10,2) DEFAULT 0,
  avg_price DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(12,2) DEFAULT 0,
  last_in_date DATE,
  last_out_date DATE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, material_id, warehouse_id)
);

ALTER TABLE public.material_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "material_stock_select" ON public.material_stock FOR SELECT USING (true);
CREATE POLICY "material_stock_update" ON public.material_stock FOR UPDATE USING (true);

CREATE INDEX idx_material_stock_project ON public.material_stock(project_id);
CREATE INDEX idx_material_stock_material ON public.material_stock(material_id);
CREATE INDEX idx_material_stock_warehouse ON public.material_stock(warehouse_id);

-- 16. 采购申请单主表 purchase_requests
CREATE TABLE public.purchase_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_no VARCHAR(50) UNIQUE NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES public.users(id),
  department VARCHAR(100),
  request_date DATE NOT NULL,
  expected_date DATE,
  total_amount DECIMAL(12,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'cancelled')),
  approval_id UUID,
  approved_at TIMESTAMP,
  approver_id UUID REFERENCES public.users(id),
  reject_reason TEXT,
  remark TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchase_requests_select" ON public.purchase_requests FOR SELECT USING (true);
CREATE POLICY "purchase_requests_insert" ON public.purchase_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "purchase_requests_update" ON public.purchase_requests FOR UPDATE USING (true);

CREATE INDEX idx_purchase_requests_project ON public.purchase_requests(project_id);
CREATE INDEX idx_purchase_requests_requester ON public.purchase_requests(requester_id);
CREATE INDEX idx_purchase_requests_status ON public.purchase_requests(status);

-- 17. 采购申请单明细表 purchase_request_items
CREATE TABLE public.purchase_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.purchase_requests(id) ON DELETE CASCADE,
  material_id UUID REFERENCES public.materials(id),
  material_name VARCHAR(200),
  specification VARCHAR(200),
  unit VARCHAR(20),
  quantity DECIMAL(10,2) NOT NULL,
  estimated_price DECIMAL(10,2),
  estimated_amount DECIMAL(12,2) GENERATED ALWAYS AS (quantity * COALESCE(estimated_price, 0)) STORED,
  supplier_id UUID REFERENCES public.party_b(id),
  remark TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.purchase_request_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchase_request_items_select" ON public.purchase_request_items FOR SELECT USING (true);
CREATE POLICY "purchase_request_items_insert" ON public.purchase_request_items FOR INSERT WITH CHECK (true);
CREATE POLICY "purchase_request_items_update" ON public.purchase_request_items FOR UPDATE USING (true);

CREATE INDEX idx_purchase_request_items_request ON public.purchase_request_items(request_id);

-- ===== 第四部分：扩展字段 =====

ALTER TABLE public.expense_contracts ADD COLUMN IF NOT EXISTS contract_type VARCHAR(20);
ALTER TABLE public.expense_contracts ADD COLUMN IF NOT EXISTS total_budget_amount DECIMAL(12,2);
ALTER TABLE public.expense_contracts ADD COLUMN IF NOT EXISTS used_amount DECIMAL(12,2) DEFAULT 0;
ALTER TABLE public.expense_contracts ADD COLUMN IF NOT EXISTS received_amount DECIMAL(12,2) DEFAULT 0;
ALTER TABLE public.expense_contracts ADD COLUMN IF NOT EXISTS settled_amount DECIMAL(12,2) DEFAULT 0;
ALTER TABLE public.expense_contracts ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(12,2) DEFAULT 0;

-- ===== 第五部分：触发器和函数 =====

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER update_warehouses_updated_at
  BEFORE UPDATE ON public.warehouses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_materials_updated_at
  BEFORE UPDATE ON public.materials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_fixed_assets_updated_at
  BEFORE UPDATE ON public.fixed_assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_purchase_orders_updated_at
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_material_receipts_updated_at
  BEFORE UPDATE ON public.material_receipts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_material_issues_updated_at
  BEFORE UPDATE ON public.material_issues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION calculate_asset_depreciation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.depreciation_method = 'straight_line' AND NEW.depreciation_years > 0 THEN
    NEW.monthly_depreciation := (NEW.purchase_amount - COALESCE(NEW.salvage_value, 0)) / (NEW.depreciation_years * 12);
  END IF;
  IF NEW.current_value IS NULL THEN
    NEW.current_value := NEW.purchase_amount;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_calculate_asset_depreciation
  BEFORE INSERT OR UPDATE ON public.fixed_assets
  FOR EACH ROW EXECUTE FUNCTION calculate_asset_depreciation();

-- ===== 第六部分：示例数据 =====

INSERT INTO public.material_categories (code, name, sort_order) VALUES
  ('01', '钢材类', 1),
  ('02', '水泥类', 2),
  ('03', '木材类', 3),
  ('04', '混凝土类', 4),
  ('05', '砂石类', 5),
  ('06', '防水材料', 6),
  ('07', '保温材料', 7),
  ('08', '电气材料', 8),
  ('09', '管材管件', 9),
  ('10', '五金工具', 10)
ON CONFLICT DO NOTHING;

INSERT INTO public.materials (code, name, specification, unit, default_price, status) VALUES
  ('STL001', '螺纹钢', 'HRB400 Φ12', '吨', 4200.00, 'active'),
  ('STL002', '螺纹钢', 'HRB400 Φ14', '吨', 4200.00, 'active'),
  ('STL003', '螺纹钢', 'HRB400 Φ16', '吨', 4150.00, 'active'),
  ('STL004', '螺纹钢', 'HRB400 Φ18', '吨', 4150.00, 'active'),
  ('STL005', '螺纹钢', 'HRB400 Φ20', '吨', 4100.00, 'active'),
  ('STL006', '螺纹钢', 'HRB400 Φ22', '吨', 4100.00, 'active'),
  ('STL007', '盘圆', 'HPB300 Φ6', '吨', 4300.00, 'active'),
  ('STL008', '盘圆', 'HPB300 Φ8', '吨', 4250.00, 'active'),
  ('STL009', '工字钢', 'Q235 14#', '吨', 4100.00, 'active'),
  ('STL010', '槽钢', 'Q235 10#', '吨', 4000.00, 'active'),
  ('CEM001', '普通硅酸盐水泥', 'P.O 42.5', '吨', 380.00, 'active'),
  ('CEM002', '普通硅酸盐水泥', 'P.O 52.5', '吨', 420.00, 'active'),
  ('WD001', '方木', '40*60*4000', '立方米', 1200.00, 'active'),
  ('WD002', '方木', '50*80*4000', '立方米', 1300.00, 'active'),
  ('WD003', '胶合板', '1220*2440*15', '张', 85.00, 'active'),
  ('CON001', '商品混凝土', 'C15', '立方米', 380.00, 'active'),
  ('CON002', '商品混凝土', 'C20', '立方米', 400.00, 'active'),
  ('CON003', '商品混凝土', 'C25', '立方米', 420.00, 'active'),
  ('CON004', '商品混凝土', 'C30', '立方米', 450.00, 'active')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.fixed_asset_categories (code, name, depreciation_years, sort_order) VALUES
  ('01', '生产设备', 10, 1),
  ('02', '运输设备', 5, 2),
  ('03', '办公设备', 5, 3),
  ('04', '施工机械', 8, 4),
  ('05', '测量仪器', 5, 5),
  ('06', '电子设备', 3, 6),
  ('07', '其他设备', 5, 7)
ON CONFLICT DO NOTHING;

INSERT INTO public.warehouses (code, name, location, status) VALUES
  ('WH001', '公司总部仓库', '北京市朝阳区', 'active'),
  ('WH002', '项目临时仓库A', '项目现场A', 'active'),
  ('WH003', '项目临时仓库B', '项目现场B', 'active')
ON CONFLICT DO NOTHING;

-- ===== 第七部分：审批步骤配置 =====

INSERT INTO public.approval_steps (source_type, step_order, step_name, approver_role) VALUES 
  ('purchase_request', 1, '项目经理审核', 'manager'),
  ('purchase_request', 2, '商务审核', 'business'),
  ('purchase_request', 3, '公司领导审批', 'admin'),
  ('purchase_order', 1, '项目经理审核', 'manager'),
  ('purchase_order', 2, '商务审核', 'business'),
  ('purchase_order', 3, '财务复核', 'finance'),
  ('material_issue', 1, '项目经理审核', 'manager'),
  ('asset_scrap', 1, '项目经理审核', 'manager'),
  ('asset_scrap', 2, '财务审核', 'finance'),
  ('asset_scrap', 3, '公司领导审批', 'admin'),
  ('asset_transfer', 1, '调出方项目经理审核', 'manager'),
  ('asset_transfer', 2, '调入方项目经理确认', 'manager')
ON CONFLICT DO NOTHING;
