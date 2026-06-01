-- ============================================================
-- 数据库优化脚本（按阶段组织）
-- 在 Supabase Dashboard → SQL Editor 中逐段执行
-- 注意：Supabase SQL Editor 运行在事务块中，不能使用 CONCURRENTLY
-- 如需在线创建索引（不锁表），请在 psql 中逐条执行：
--   psql -U postgres -d postgres -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS ... ON ...;"
-- ============================================================

-- 第一阶段：索引优化
-- ============================================================
-- 机械台班表索引
CREATE INDEX IF NOT EXISTS idx_machine_shift_project_date
  ON machine_shift_records(project_id, record_date);

-- 成本发票表索引
CREATE INDEX IF NOT EXISTS idx_cost_invoice_project
  ON cost_invoices(project_id, created_at);

-- 收入合同表索引
CREATE INDEX IF NOT EXISTS idx_income_contracts_project
  ON income_contracts(project_id, status);

-- 支出合同表索引
CREATE INDEX IF NOT EXISTS idx_expense_contracts_project
  ON expense_contracts(project_id, status);

-- 审批待办索引（approval_tasks 表不存在，改为 approvals 表常用查询索引）
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
CREATE INDEX IF NOT EXISTS idx_approvals_created_by ON approvals(created_by);
CREATE INDEX IF NOT EXISTS idx_approvals_source ON approvals(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_approval_instance_approvers_approval
  ON approval_instance_approvers(approval_id, step_order);

-- ============================================================
-- 第二阶段：成本汇总视图（只读）
-- ============================================================
CREATE OR REPLACE VIEW project_cost_summary AS
SELECT
  p.id AS project_id,
  p.name AS project_name,
  COALESCE(SUM(CASE WHEN s.supply_category = '材料' THEN ci.invoice_amount ELSE 0 END), 0) AS material_cost,
  COALESCE(SUM(CASE WHEN s.supply_category = '机械' THEN ci.invoice_amount ELSE 0 END), 0) AS machine_cost,
  COALESCE(SUM(CASE WHEN s.supply_category = '人工' THEN ci.invoice_amount ELSE 0 END), 0) AS labor_cost,
  COALESCE(SUM(ci.invoice_amount), 0) AS total_cost
FROM projects p
LEFT JOIN cost_invoices ci ON ci.project_id = p.id
LEFT JOIN suppliers s ON s.id = ci.supplier_id
GROUP BY p.id, p.name;

-- ============================================================
-- 第三阶段：成本归集表
-- ============================================================
CREATE TABLE IF NOT EXISTS project_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  cost_type VARCHAR(50) NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  source_id UUID,
  source_type VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 项目成本归集索引
CREATE INDEX IF NOT EXISTS idx_project_costs_project
  ON project_costs(project_id, cost_type);

-- ============================================================
-- 第四阶段：预警规则表 + 预警记录表
-- ============================================================
CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type VARCHAR(50) NOT NULL,
  threshold DECIMAL(10,2),
  is_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL,
  title VARCHAR(200),
  content TEXT,
  severity VARCHAR(20) DEFAULT 'warning',
  status VARCHAR(20) DEFAULT 'active',
  source_id UUID,
  source_type VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  resolved_by UUID
);

-- 预警索引
CREATE INDEX IF NOT EXISTS idx_alerts_status
  ON alerts(project_id, status);

-- ============================================================
-- 模块一：成本归集触发函数
-- ============================================================

-- 1.1 创建触发器函数（发票状态变更时自动归集成本）
CREATE OR REPLACE FUNCTION auto_record_project_cost()
RETURNS TRIGGER AS $$
DECLARE
  v_cost_type VARCHAR(50);
  v_supply_category VARCHAR(50);
BEGIN
  -- 获取供应商类型（材料/机械/人工）
  SELECT supply_category INTO v_supply_category
  FROM suppliers
  WHERE id = NEW.supplier_id;
  
  -- 映射成本类型
  IF v_supply_category = '材料' THEN
    v_cost_type := 'material';
  ELSIF v_supply_category = '机械' THEN
    v_cost_type := 'machine';
  ELSIF v_supply_category = '人工' THEN
    v_cost_type := 'labor';
  ELSE
    v_cost_type := 'other';
  END IF;
  
  -- 插入成本归集记录（注意：由于 cost_invoices 没有独立的状态字段，这里改为 always on update，防止重复）
  -- 先删除旧记录
  DELETE FROM project_costs
  WHERE source_id = NEW.id AND source_type = 'cost_invoice';
  
  -- 插入新记录
  INSERT INTO project_costs (
    project_id,
    cost_type,
    amount,
    source_id,
    source_type,
    created_at
  ) VALUES (
    NEW.project_id,
    v_cost_type,
    NEW.invoice_amount,
    NEW.id,
    'cost_invoice',
    NOW()
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器（绑定到 cost_invoices 表的所有变更）
DROP TRIGGER IF EXISTS trigger_record_project_cost ON cost_invoices;
CREATE TRIGGER trigger_record_project_cost
  AFTER INSERT OR UPDATE ON cost_invoices
  FOR EACH ROW
  EXECUTE FUNCTION auto_record_project_cost();

-- 1.2 手动归集函数（补录历史数据）
INSERT INTO project_costs (project_id, cost_type, amount, source_id, source_type, created_at)
SELECT
  ci.project_id,
  CASE
    WHEN s.supply_category = '材料' THEN 'material'
    WHEN s.supply_category = '机械' THEN 'machine'
    WHEN s.supply_category = '人工' THEN 'labor'
    ELSE 'other'
  END AS cost_type,
  ci.invoice_amount,
  ci.id,
  'cost_invoice',
  ci.created_at
FROM cost_invoices ci
LEFT JOIN suppliers s ON s.id = ci.supplier_id
WHERE NOT EXISTS (
  SELECT 1 FROM project_costs pc
  WHERE pc.source_id = ci.id AND pc.source_type = 'cost_invoice'
)
ON CONFLICT DO NOTHING;

-- 同时更新 project_cost_summary 视图，让它直接从 project_costs 表读取，提高性能
CREATE OR REPLACE VIEW project_cost_summary AS
SELECT
  p.id AS project_id,
  p.name AS project_name,
  COALESCE(SUM(CASE WHEN pc.cost_type = 'material' THEN pc.amount ELSE 0 END), 0) AS material_cost,
  COALESCE(SUM(CASE WHEN pc.cost_type = 'machine' THEN pc.amount ELSE 0 END), 0) AS machine_cost,
  COALESCE(SUM(CASE WHEN pc.cost_type = 'labor' THEN pc.amount ELSE 0 END), 0) AS labor_cost,
  COALESCE(SUM(pc.amount), 0) AS total_cost
FROM projects p
LEFT JOIN project_costs pc ON pc.project_id = p.id
GROUP BY p.id, p.name;