-- 检查所有多对多关联表是否有唯一约束
SELECT
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.constraint_type = 'UNIQUE'
  AND tc.table_name IN (
      'project_members',
      'contract_members',
      'approval_task_approvers',
      'material_category_relations'
  );

-- project_members 唯一约束（已添加）
ALTER TABLE project_members ADD CONSTRAINT IF NOT EXISTS unique_project_member UNIQUE (project_id, user_id);

-- contract_members
ALTER TABLE contract_members ADD CONSTRAINT IF NOT EXISTS unique_contract_member UNIQUE (contract_id, user_id);

-- approval_task_approvers
ALTER TABLE approval_task_approvers ADD CONSTRAINT IF NOT EXISTS unique_task_approver UNIQUE (task_id, approver_id);