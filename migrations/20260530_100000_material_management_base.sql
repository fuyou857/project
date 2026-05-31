-- 物资管理模块：基础数据表
-- 功能：仓库、物资分类、物资档案
-- 执行顺序：1

-- 1. 创建仓库表 warehouses
CREATE TABLE IF NOT EXISTS public.warehouses (
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

COMMENT ON TABLE public.warehouses IS '仓库表';
COMMENT ON COLUMN public.warehouses.project_id IS '关联项目，NULL表示公司级仓库';

ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "warehouses_select" ON public.warehouses FOR SELECT USING (true);
CREATE POLICY "warehouses_insert" ON public.warehouses FOR INSERT WITH CHECK (true);
CREATE POLICY "warehouses_update" ON public.warehouses FOR UPDATE USING (true);
CREATE POLICY "warehouses_delete" ON public.warehouses FOR DELETE USING (true);

-- 2. 创建物资分类表 material_categories
CREATE TABLE IF NOT EXISTS public.material_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50),
  name VARCHAR(100) NOT NULL,
  parent_id UUID REFERENCES public.material_categories(id) ON DELETE SET NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.material_categories IS '物资分类表';

ALTER TABLE public.material_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "material_categories_select" ON public.material_categories FOR SELECT USING (true);
CREATE POLICY "material_categories_insert" ON public.material_categories FOR INSERT WITH CHECK (true);
CREATE POLICY "material_categories_update" ON public.material_categories FOR UPDATE USING (true);
CREATE POLICY "material_categories_delete" ON public.material_categories FOR DELETE USING (true);

-- 3. 创建物资档案表 materials
CREATE TABLE IF NOT EXISTS public.materials (
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

COMMENT ON TABLE public.materials IS '物资档案表';
COMMENT ON COLUMN public.materials.current_stock IS '当前库存（可定期同步计算）';

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "materials_select" ON public.materials FOR SELECT USING (true);
CREATE POLICY "materials_insert" ON public.materials FOR INSERT WITH CHECK (true);
CREATE POLICY "materials_update" ON public.materials FOR UPDATE USING (true);
CREATE POLICY "materials_delete" ON public.materials FOR DELETE USING (true);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_materials_category ON public.materials(category_id);
CREATE INDEX IF NOT EXISTS idx_materials_code ON public.materials(code);
CREATE INDEX IF NOT EXISTS idx_materials_status ON public.materials(status);

-- 4. 插入示例物资分类数据
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

-- 5. 插入示例物资数据
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
  ('CEM003', '矿渣硅酸盐水泥', 'P.S 32.5', '吨', 320.00, 'active'),
  ('WD001', '方木', '40*60*4000', '立方米', 1200.00, 'active'),
  ('WD002', '方木', '50*80*4000', '立方米', 1300.00, 'active'),
  ('WD003', '胶合板', '1220*2440*15', '张', 85.00, 'active'),
  ('WD004', '胶合板', '1220*2440*18', '张', 98.00, 'active'),
  ('CON001', '商品混凝土', 'C15', '立方米', 380.00, 'active'),
  ('CON002', '商品混凝土', 'C20', '立方米', 400.00, 'active'),
  ('CON003', '商品混凝土', 'C25', '立方米', 420.00, 'active'),
  ('CON004', '商品混凝土', 'C30', '立方米', 450.00, 'active'),
  ('CON005', '商品混凝土', 'C35', '立方米', 480.00, 'active'),
  ('CON006', '商品混凝土', 'C40', '立方米', 520.00, 'active')
ON CONFLICT (code) DO NOTHING;
