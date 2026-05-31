-- 机械台班审批流程步骤配置
-- 来源类型：machine_shift

INSERT INTO approval_steps (source_type, step_order, step_name, approver_role, approver_id, sign_type, is_active, created_at)
VALUES
  ('machine_shift', 1, '项目经理审核', 'manager', NULL, NULL, true, NOW()),
  ('machine_shift', 2, '财务确认', 'finance', NULL, NULL, true, NOW())
ON CONFLICT (source_type, step_order) DO NOTHING;
