-- 物资管理模块：审批步骤和用户角色配置
-- 执行顺序：4

-- 1. 扩展 expense_contracts 表（如果尚未扩展）
ALTER TABLE public.expense_contracts ADD COLUMN IF NOT EXISTS contract_type VARCHAR(20);
ALTER TABLE public.expense_contracts ADD COLUMN IF NOT EXISTS total_budget_amount DECIMAL(12,2);
ALTER TABLE public.expense_contracts ADD COLUMN IF NOT EXISTS used_amount DECIMAL(12,2) DEFAULT 0;
ALTER TABLE public.expense_contracts ADD COLUMN IF NOT EXISTS received_amount DECIMAL(12,2) DEFAULT 0;
ALTER TABLE public.expense_contracts ADD COLUMN IF NOT EXISTS settled_amount DECIMAL(12,2) DEFAULT 0;
ALTER TABLE public.expense_contracts ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(12,2) DEFAULT 0;

COMMENT ON COLUMN public.expense_contracts.contract_type IS '合同类型：material_purchase-材料采购, machine_rental-机械租赁, other-其他';
COMMENT ON COLUMN public.expense_contracts.total_budget_amount IS '合同总金额';
COMMENT ON COLUMN public.expense_contracts.used_amount IS '已采购订单金额';
COMMENT ON COLUMN public.expense_contracts.received_amount IS '已入库金额';
COMMENT ON COLUMN public.expense_contracts.settled_amount IS '已结算金额';
COMMENT ON COLUMN public.expense_contracts.paid_amount IS '已付款金额';

-- 2. 扩展 users 表，增加物资相关角色（如果尚未扩展）
-- 注意：实际的权限控制可能需要通过 roles 或 permissions 表实现

-- 3. 插入物资管理审批步骤
-- 采购申请审批流程（可选）
INSERT INTO public.approval_steps (source_type, step_order, step_name, approver_role) VALUES 
  ('purchase_request', 1, '项目经理审核', 'manager'),
  ('purchase_request', 2, '商务审核', 'business'),
  ('purchase_request', 3, '公司领导审批', 'admin')
ON CONFLICT DO NOTHING;

-- 采购订单审批（可选）
INSERT INTO public.approval_steps (source_type, step_order, step_name, approver_role) VALUES 
  ('purchase_order', 1, '项目经理审核', 'manager'),
  ('purchase_order', 2, '商务审核', 'business'),
  ('purchase_order', 3, '财务复核', 'finance')
ON CONFLICT DO NOTHING;

-- 领料单审批（可选，根据金额或物资类型）
INSERT INTO public.approval_steps (source_type, step_order, step_name, approver_role) VALUES 
  ('material_issue', 1, '项目经理审核', 'manager')
ON CONFLICT DO NOTHING;

-- 资产报废审批
INSERT INTO public.approval_steps (source_type, step_order, step_name, approver_role) VALUES 
  ('asset_scrap', 1, '项目经理审核', 'manager'),
  ('asset_scrap', 2, '财务审核', 'finance'),
  ('asset_scrap', 3, '公司领导审批', 'admin')
ON CONFLICT DO NOTHING;

-- 资产调拨审批
INSERT INTO public.approval_steps (source_type, step_order, step_name, approver_role) VALUES 
  ('asset_transfer', 1, '调出方项目经理审核', 'manager'),
  ('asset_transfer', 2, '调入方项目经理确认', 'manager')
ON CONFLICT DO NOTHING;

-- 4. 创建物资管理相关菜单权限（如果使用菜单权限系统）
-- 这个需要根据实际的权限系统来定，可能是 permissions 表或 roles 表

-- 5. 创建示例仓库数据
INSERT INTO public.warehouses (code, name, location, status) VALUES
  ('WH001', '公司总部仓库', '北京市朝阳区', 'active'),
  ('WH002', '项目临时仓库A', '项目现场A', 'active'),
  ('WH003', '项目临时仓库B', '项目现场B', 'active')
ON CONFLICT DO NOTHING;
