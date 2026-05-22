-- ============================================
-- 审批流程相关表
-- ============================================

-- 审批主表
CREATE TABLE approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type VARCHAR(50) NOT NULL,
  source_id UUID NOT NULL,
  source_name VARCHAR(255),
  current_step INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending',
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 审批步骤配置表
CREATE TABLE approval_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type VARCHAR(50) NOT NULL,
  step_order INT NOT NULL,
  step_name VARCHAR(50) NOT NULL,
  approver_role VARCHAR(50),
  approver_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 审批记录/历史表
CREATE TABLE approval_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id UUID REFERENCES approvals(id) ON DELETE CASCADE,
  step_order INT NOT NULL,
  step_name VARCHAR(50) NOT NULL,
  approver_id UUID,
  approver_name VARCHAR(100),
  action VARCHAR(20) NOT NULL,
  comment TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_approvals_source ON approvals(source_type, source_id);
CREATE INDEX idx_approvals_status ON approvals(status);
CREATE INDEX idx_approval_steps_type ON approval_steps(source_type);

-- 启用 RLS
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_records ENABLE ROW LEVEL SECURITY;

-- 创建策略
CREATE POLICY "所有人可查看审批" ON approvals FOR SELECT USING (true);
CREATE POLICY "所有人可创建审批" ON approvals FOR INSERT WITH CHECK (true);
CREATE POLICY "所有人可更新审批" ON approvals FOR UPDATE USING (true);
CREATE POLICY "管理员可删除审批" ON approvals FOR DELETE USING (true);

CREATE POLICY "所有人可查看审批步骤" ON approval_steps FOR SELECT USING (true);
CREATE POLICY "所有人可创建审批步骤" ON approval_steps FOR INSERT WITH CHECK (true);
CREATE POLICY "所有人可更新审批步骤" ON approval_steps FOR UPDATE USING (true);
CREATE POLICY "管理员可删除审批步骤" ON approval_steps FOR DELETE USING (true);

CREATE POLICY "所有人可查看审批记录" ON approval_records FOR SELECT USING (true);
CREATE POLICY "所有人可创建审批记录" ON approval_records FOR INSERT WITH CHECK (true);
CREATE POLICY "所有人可更新审批记录" ON approval_records FOR UPDATE USING (true);
CREATE POLICY "管理员可删除审批记录" ON approval_records FOR DELETE USING (true);

-- 插入默认审批步骤配置
INSERT INTO approval_steps (source_type, step_order, step_name, approver_role) VALUES 
('income_contract', 1, '初审', 'manager'),
('income_contract', 2, '复审', 'finance'),
('income_contract', 3, '终审', 'admin'),
('expense_contract', 1, '初审', 'manager'),
('expense_contract', 2, '复审', 'finance'),
('expense_contract', 3, '终审', 'admin'),
('income_supplement', 1, '初审', 'manager'),
('income_supplement', 2, '终审', 'finance'),
('expense_supplement', 1, '初审', 'manager'),
('expense_supplement', 2, '终审', 'finance'),
('income_variation', 1, '审核', 'manager'),
('expense_variation', 1, '审核', 'manager'),
('income_deduction', 1, '审核', 'finance'),
('expense_deduction', 1, '审核', 'finance'),
('income_output', 1, '确认', 'manager'),
('expense_performance', 1, '确认', 'manager'),
('income_settlement', 1, '初审', 'finance'),
('income_settlement', 2, '终审', 'admin'),
('expense_settlement', 1, '初审', 'finance'),
('expense_settlement', 2, '终审', 'admin');