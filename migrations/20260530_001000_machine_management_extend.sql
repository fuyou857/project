-- 机械管理模块数据库扩展
-- 执行时间：2026-05-30

-- 1. 扩展 machines 表（机械档案）
ALTER TABLE machines ADD COLUMN IF NOT EXISTS default_shift_price DECIMAL(10,2);
ALTER TABLE machines ADD COLUMN IF NOT EXISTS unit VARCHAR(20) DEFAULT '台班';

-- 2. 扩展 expense_contracts 表（支出合同）用于机械租赁
ALTER TABLE expense_contracts ADD COLUMN IF NOT EXISTS contract_type VARCHAR(20);
ALTER TABLE expense_contracts ADD COLUMN IF NOT EXISTS shift_price DECIMAL(10,2);
ALTER TABLE expense_contracts ADD COLUMN IF NOT EXISTS total_budget_shifts DECIMAL(10,2);
ALTER TABLE expense_contracts ADD COLUMN IF NOT EXISTS used_shifts DECIMAL(10,2) DEFAULT 0;
ALTER TABLE expense_contracts ADD COLUMN IF NOT EXISTS used_amount DECIMAL(10,2) DEFAULT 0;

-- 3. 创建 machine_shift_records 表（机械台班记录）
CREATE TABLE IF NOT EXISTS machine_shift_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  rental_contract_id UUID REFERENCES expense_contracts(id) ON DELETE SET NULL,
  record_date DATE NOT NULL,
  shift_count DECIMAL(10,2) NOT NULL DEFAULT 1,
  start_time TIME,
  end_time TIME,
  cost_per_shift DECIMAL(10,2),
  total_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  operator VARCHAR(100),
  remark TEXT,
  images JSONB DEFAULT '[]',
  status VARCHAR(20) DEFAULT 'draft',
  approval_id UUID,
  is_settled BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. 创建索引
CREATE INDEX IF NOT EXISTS idx_shift_records_project ON machine_shift_records(project_id);
CREATE INDEX IF NOT EXISTS idx_shift_records_machine ON machine_shift_records(machine_id);
CREATE INDEX IF NOT EXISTS idx_shift_records_contract ON machine_shift_records(rental_contract_id);
CREATE INDEX IF NOT EXISTS idx_shift_records_date ON machine_shift_records(record_date);
CREATE INDEX IF NOT EXISTS idx_shift_records_status ON machine_shift_records(status);

-- 5. 创建触发器自动更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_machine_shift_records_updated_at ON machine_shift_records;
CREATE TRIGGER update_machine_shift_records_updated_at
  BEFORE UPDATE ON machine_shift_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 6. 创建自动计算 total_cost 的触发器
CREATE OR REPLACE FUNCTION calculate_total_cost()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.shift_count IS NOT NULL AND NEW.cost_per_shift IS NOT NULL THEN
    NEW.total_cost = NEW.shift_count * NEW.cost_per_shift;
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS calculate_machine_shift_total_cost ON machine_shift_records;
CREATE TRIGGER calculate_machine_shift_total_cost
  BEFORE INSERT OR UPDATE ON machine_shift_records
  FOR EACH ROW
  EXECUTE FUNCTION calculate_total_cost();

-- 7. 创建机器分类表
CREATE TABLE IF NOT EXISTS machine_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50),
  parent_id UUID REFERENCES machine_categories(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  remark TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. 为 machines 表添加 category_id
ALTER TABLE machines ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES machine_categories(id) ON DELETE SET NULL;

-- 9. 创建机器使用记录视图（用于统计）
CREATE OR REPLACE VIEW machine_usage_stats AS
SELECT 
  msr.project_id,
  p.name as project_name,
  msr.machine_id,
  m.name as machine_name,
  m.code as machine_code,
  DATE_TRUNC('month', msr.record_date) as month,
  SUM(msr.shift_count) as total_shifts,
  SUM(msr.total_cost) as total_cost,
  COUNT(*) as record_count
FROM machine_shift_records msr
LEFT JOIN projects p ON msr.project_id = p.id
LEFT JOIN machines m ON msr.machine_id = m.id
WHERE msr.status = 'confirmed'
GROUP BY msr.project_id, p.name, msr.machine_id, m.name, m.code, DATE_TRUNC('month', msr.record_date);

-- 10. 插入示例分类数据
INSERT INTO machine_categories (name, code, sort_order) VALUES
  ('挖掘机械', 'EXCAVATOR', 1),
  ('起重机械', 'CRANE', 2),
  ('运输机械', 'TRANSPORT', 3),
  ('混凝土机械', 'CONCRETE', 4),
  ('压实机械', 'COMPACTOR', 5)
ON CONFLICT DO NOTHING;
