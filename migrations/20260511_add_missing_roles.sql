-- 添加缺失的角色
-- 一级角色：公司管理员、普通员工
-- 二级角色：项目老板、项目技术负责人、商务主管、采购主管、预算主管、项目会计、项目出纳、施工员、安全员

INSERT INTO roles (name, description, is_system) VALUES 
('company_admin', '公司管理员，管理公司级数据', true),
('regular_employee', '普通员工，基础业务操作权限', true),
('project_owner', '项目老板，项目最高负责人', true),
('tech_lead', '项目技术负责人，负责技术管理', true),
('business_manager', '商务主管，负责商务洽谈', true),
('procurement_manager', '采购主管，负责物资采购', true),
('budget_manager', '预算主管，负责预算管理', true),
('project_accountant', '项目会计，负责项目财务', true),
('project_cashier', '项目出纳，负责资金收付', true),
('construction_worker', '施工员，负责现场施工', true),
('safety_officer', '安全员，负责安全管理', true)
ON CONFLICT (name) DO NOTHING;
