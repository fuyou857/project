-- 项目部管理人员（基础数据 / 乙方单位相关）
-- 工资发放记录与人员信息分离，便于按时间、项目统计及拖欠分析

CREATE TABLE IF NOT EXISTS public.project_mgmt_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  party_b_id UUID NOT NULL REFERENCES public.party_b(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  gender TEXT,
  id_card TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  position_title TEXT,
  hire_date DATE,
  resume_files JSONB NOT NULL DEFAULT '[]'::jsonb,
  remark TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_mgmt_staff_party_b ON public.project_mgmt_staff(party_b_id);
CREATE INDEX IF NOT EXISTS idx_project_mgmt_staff_project ON public.project_mgmt_staff(project_id);
CREATE INDEX IF NOT EXISTS idx_project_mgmt_staff_company ON public.project_mgmt_staff(company_id);
CREATE INDEX IF NOT EXISTS idx_project_mgmt_staff_name ON public.project_mgmt_staff(full_name);

CREATE TABLE IF NOT EXISTS public.project_mgmt_staff_salary_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.project_mgmt_staff(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  salary_month DATE NOT NULL,
  amount_payable NUMERIC(14,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid_date DATE,
  remark TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pm_salary_staff ON public.project_mgmt_staff_salary_records(staff_id);
CREATE INDEX IF NOT EXISTS idx_pm_salary_project ON public.project_mgmt_staff_salary_records(project_id);
CREATE INDEX IF NOT EXISTS idx_pm_salary_month ON public.project_mgmt_staff_salary_records(salary_month);

ALTER TABLE public.project_mgmt_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_mgmt_staff_salary_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "所有人可查看项目部管理人员" ON public.project_mgmt_staff;
DROP POLICY IF EXISTS "所有人可创建项目部管理人员" ON public.project_mgmt_staff;
DROP POLICY IF EXISTS "所有人可更新项目部管理人员" ON public.project_mgmt_staff;
DROP POLICY IF EXISTS "管理员可删除项目部管理人员" ON public.project_mgmt_staff;

CREATE POLICY "所有人可查看项目部管理人员" ON public.project_mgmt_staff FOR SELECT USING (true);
CREATE POLICY "所有人可创建项目部管理人员" ON public.project_mgmt_staff FOR INSERT WITH CHECK (true);
CREATE POLICY "所有人可更新项目部管理人员" ON public.project_mgmt_staff FOR UPDATE USING (true);
CREATE POLICY "管理员可删除项目部管理人员" ON public.project_mgmt_staff FOR DELETE USING (true);

DROP POLICY IF EXISTS "所有人可查看项目部管理人员工资记录" ON public.project_mgmt_staff_salary_records;
DROP POLICY IF EXISTS "所有人可创建项目部管理人员工资记录" ON public.project_mgmt_staff_salary_records;
DROP POLICY IF EXISTS "所有人可更新项目部管理人员工资记录" ON public.project_mgmt_staff_salary_records;
DROP POLICY IF EXISTS "管理员可删除项目部管理人员工资记录" ON public.project_mgmt_staff_salary_records;

CREATE POLICY "所有人可查看项目部管理人员工资记录" ON public.project_mgmt_staff_salary_records FOR SELECT USING (true);
CREATE POLICY "所有人可创建项目部管理人员工资记录" ON public.project_mgmt_staff_salary_records FOR INSERT WITH CHECK (true);
CREATE POLICY "所有人可更新项目部管理人员工资记录" ON public.project_mgmt_staff_salary_records FOR UPDATE USING (true);
CREATE POLICY "管理员可删除项目部管理人员工资记录" ON public.project_mgmt_staff_salary_records FOR DELETE USING (true);
