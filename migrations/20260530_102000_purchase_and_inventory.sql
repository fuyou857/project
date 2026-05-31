-- 物资管理模块：采购与库存相关表
-- 功能：采购订单、入库单、领料单、库存
-- 执行顺序：3

-- 1. 创建采购订单主表 purchase_orders
CREATE TABLE IF NOT EXISTS public.purchase_orders (
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

COMMENT ON TABLE public.purchase_orders IS '采购订单主表';

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchase_orders_select" ON public.purchase_orders FOR SELECT USING (true);
CREATE POLICY "purchase_orders_insert" ON public.purchase_orders FOR INSERT WITH CHECK (true);
CREATE POLICY "purchase_orders_update" ON public.purchase_orders FOR UPDATE USING (true);
CREATE POLICY "purchase_orders_delete" ON public.purchase_orders FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_project ON public.purchase_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON public.purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON public.purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_date ON public.purchase_orders(order_date);

-- 2. 创建采购订单明细表 purchase_order_items
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
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

COMMENT ON TABLE public.purchase_order_items IS '采购订单明细表';

ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchase_order_items_select" ON public.purchase_order_items FOR SELECT USING (true);
CREATE POLICY "purchase_order_items_insert" ON public.purchase_order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "purchase_order_items_update" ON public.purchase_order_items FOR UPDATE USING (true);
CREATE POLICY "purchase_order_items_delete" ON public.purchase_order_items FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.purchase_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_material ON public.purchase_order_items(material_id);

-- 3. 创建入库单主表 material_receipts
CREATE TABLE IF NOT EXISTS public.material_receipts (
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

COMMENT ON TABLE public.material_receipts IS '入库单主表';

ALTER TABLE public.material_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "material_receipts_select" ON public.material_receipts FOR SELECT USING (true);
CREATE POLICY "material_receipts_insert" ON public.material_receipts FOR INSERT WITH CHECK (true);
CREATE POLICY "material_receipts_update" ON public.material_receipts FOR UPDATE USING (true);
CREATE POLICY "material_receipts_delete" ON public.material_receipts FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_material_receipts_project ON public.material_receipts(project_id);
CREATE INDEX IF NOT EXISTS idx_material_receipts_warehouse ON public.material_receipts(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_material_receipts_order ON public.material_receipts(order_id);
CREATE INDEX IF NOT EXISTS idx_material_receipts_status ON public.material_receipts(status);
CREATE INDEX IF NOT EXISTS idx_material_receipts_date ON public.material_receipts(receipt_date);

-- 4. 创建入库单明细表 material_receipt_items
CREATE TABLE IF NOT EXISTS public.material_receipt_items (
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

COMMENT ON TABLE public.material_receipt_items IS '入库单明细表';

ALTER TABLE public.material_receipt_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "material_receipt_items_select" ON public.material_receipt_items FOR SELECT USING (true);
CREATE POLICY "material_receipt_items_insert" ON public.material_receipt_items FOR INSERT WITH CHECK (true);
CREATE POLICY "material_receipt_items_update" ON public.material_receipt_items FOR UPDATE USING (true);
CREATE POLICY "material_receipt_items_delete" ON public.material_receipt_items FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt ON public.material_receipt_items(receipt_id);
CREATE INDEX IF NOT EXISTS idx_receipt_items_material ON public.material_receipt_items(material_id);

-- 5. 创建领料单主表 material_issues
CREATE TABLE IF NOT EXISTS public.material_issues (
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

COMMENT ON TABLE public.material_issues IS '领料单主表';
COMMENT ON COLUMN public.material_issues.cost_center IS '成本中心/施工段/楼栋';

ALTER TABLE public.material_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "material_issues_select" ON public.material_issues FOR SELECT USING (true);
CREATE POLICY "material_issues_insert" ON public.material_issues FOR INSERT WITH CHECK (true);
CREATE POLICY "material_issues_update" ON public.material_issues FOR UPDATE USING (true);
CREATE POLICY "material_issues_delete" ON public.material_issues FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_material_issues_project ON public.material_issues(project_id);
CREATE INDEX IF NOT EXISTS idx_material_issues_warehouse ON public.material_issues(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_material_issues_status ON public.material_issues(status);
CREATE INDEX IF NOT EXISTS idx_material_issues_date ON public.material_issues(issue_date);

-- 6. 创建领料单明细表 material_issue_items
CREATE TABLE IF NOT EXISTS public.material_issue_items (
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

COMMENT ON TABLE public.material_issue_items IS '领料单明细表';

ALTER TABLE public.material_issue_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "material_issue_items_select" ON public.material_issue_items FOR SELECT USING (true);
CREATE POLICY "material_issue_items_insert" ON public.material_issue_items FOR INSERT WITH CHECK (true);
CREATE POLICY "material_issue_items_update" ON public.material_issue_items FOR UPDATE USING (true);
CREATE POLICY "material_issue_items_delete" ON public.material_issue_items FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_issue_items_issue ON public.material_issue_items(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_items_material ON public.material_issue_items(material_id);

-- 7. 创建项目库存表 material_stock
CREATE TABLE IF NOT EXISTS public.material_stock (
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

COMMENT ON TABLE public.material_stock IS '项目库存表（按项目+仓库+物资聚合）';

ALTER TABLE public.material_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "material_stock_select" ON public.material_stock FOR SELECT USING (true);
CREATE POLICY "material_stock_update" ON public.material_stock FOR UPDATE USING (true);

CREATE INDEX IF NOT EXISTS idx_material_stock_project ON public.material_stock(project_id);
CREATE INDEX IF NOT EXISTS idx_material_stock_material ON public.material_stock(material_id);
CREATE INDEX IF NOT EXISTS idx_material_stock_warehouse ON public.material_stock(warehouse_id);

-- 8. 创建采购申请单主表 purchase_requests（可选）
CREATE TABLE IF NOT EXISTS public.purchase_requests (
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

COMMENT ON TABLE public.purchase_requests IS '采购申请单主表';

ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchase_requests_select" ON public.purchase_requests FOR SELECT USING (true);
CREATE POLICY "purchase_requests_insert" ON public.purchase_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "purchase_requests_update" ON public.purchase_requests FOR UPDATE USING (true);

CREATE INDEX IF NOT EXISTS idx_purchase_requests_project ON public.purchase_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_requester ON public.purchase_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_status ON public.purchase_requests(status);

-- 9. 创建采购申请单明细表 purchase_request_items
CREATE TABLE IF NOT EXISTS public.purchase_request_items (
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

COMMENT ON TABLE public.purchase_request_items IS '采购申请单明细表';

ALTER TABLE public.purchase_request_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchase_request_items_select" ON public.purchase_request_items FOR SELECT USING (true);
CREATE POLICY "purchase_request_items_insert" ON public.purchase_request_items FOR INSERT WITH CHECK (true);
CREATE POLICY "purchase_request_items_update" ON public.purchase_request_items FOR UPDATE USING (true);

CREATE INDEX IF NOT EXISTS idx_purchase_request_items_request ON public.purchase_request_items(request_id);

-- 10. 创建触发器：自动更新 updated_at
CREATE OR REPLACE TRIGGER update_purchase_orders_updated_at
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_material_receipts_updated_at
  BEFORE UPDATE ON public.material_receipts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_material_issues_updated_at
  BEFORE UPDATE ON public.material_issues
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
