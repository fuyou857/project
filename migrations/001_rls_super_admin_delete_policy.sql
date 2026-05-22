-- ============================================
-- 超级管理员删除权限 RLS 策略
-- ============================================

-- 注意：执行此脚本前需要确保已经启用了 RLS

-- ============================================
-- 第一步：创建验证用户角色的函数
-- ============================================

CREATE OR REPLACE FUNCTION public.is_current_user_super_admin()
RETURNS boolean AS $$
DECLARE
  user_role text;
  user_role_ids text[];
BEGIN
  -- 先检查 profiles 表
  SELECT role, role_ids INTO user_role, user_role_ids
  FROM public.profiles
  WHERE id = auth.uid();
  
  IF FOUND THEN
    IF user_role = 'super_admin' THEN
      RETURN true;
    END IF;
    
    IF user_role_ids IS NOT NULL AND 'super_admin' = ANY(user_role_ids) THEN
      RETURN true;
    END IF;
  END IF;
  
  -- 也可以检查 users 表（根据项目实际使用的表）
  SELECT role, role_ids INTO user_role, user_role_ids
  FROM public.users
  WHERE id = auth.uid();
  
  IF FOUND THEN
    IF user_role = 'super_admin' THEN
      RETURN true;
    END IF;
    
    IF user_role_ids IS NOT NULL AND 'super_admin' = ANY(user_role_ids) THEN
      RETURN true;
    END IF;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 第二步：为各个表创建 DELETE 策略
-- ============================================

-- 项目管理 - projects 表
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "只有超级管理员可以删除项目"
ON public.projects
FOR DELETE
USING (public.is_current_user_super_admin());

-- 合同管理 - income_contracts 表
ALTER TABLE public.income_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "只有超级管理员可以删除收入合同"
ON public.income_contracts
FOR DELETE
USING (public.is_current_user_super_admin());

-- 合同管理 - expense_contracts 表
ALTER TABLE public.expense_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "只有超级管理员可以删除支出合同"
ON public.expense_contracts
FOR DELETE
USING (public.is_current_user_super_admin());

-- 财务管理 - cost_invoices 表
ALTER TABLE public.cost_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "只有超级管理员可以删除成本发票"
ON public.cost_invoices
FOR DELETE
USING (public.is_current_user_super_admin());

-- 财务管理 - income_invoices 表
ALTER TABLE public.income_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "只有超级管理员可以删除收入发票"
ON public.income_invoices
FOR DELETE
USING (public.is_current_user_super_admin());

-- 财务管理 - payments 表
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "只有超级管理员可以删除付款记录"
ON public.payments
FOR DELETE
USING (public.is_current_user_super_admin());

-- 财务管理 - other_incomes 表
ALTER TABLE public.other_incomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "只有超级管理员可以删除其他收入"
ON public.other_incomes
FOR DELETE
USING (public.is_current_user_super_admin());

-- 印章管理 - seal_usage_records 表
ALTER TABLE public.seal_usage_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "只有超级管理员可以删除印章记录"
ON public.seal_usage_records
FOR DELETE
USING (public.is_current_user_super_admin());

-- 基础数据 - party_a 表
ALTER TABLE public.party_a ENABLE ROW LEVEL SECURITY;

CREATE POLICY "只有超级管理员可以删除甲方单位"
ON public.party_a
FOR DELETE
USING (public.is_current_user_super_admin());

-- 基础数据 - party_b 表
ALTER TABLE public.party_b ENABLE ROW LEVEL SECURITY;

CREATE POLICY "只有超级管理员可以删除乙方单位"
ON public.party_b
FOR DELETE
USING (public.is_current_user_super_admin());

-- 基础数据 - signatory_units 表
ALTER TABLE public.signatory_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "只有超级管理员可以删除签约单位"
ON public.signatory_units
FOR DELETE
USING (public.is_current_user_super_admin());

-- 基础数据 - suppliers 表
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "只有超级管理员可以删除供应商"
ON public.suppliers
FOR DELETE
USING (public.is_current_user_super_admin());

-- 物资管理 - materials 表
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "只有超级管理员可以删除物资"
ON public.materials
FOR DELETE
USING (public.is_current_user_super_admin());

-- 物资管理 - material_inbounds 表（根据实际表名调整）
ALTER TABLE public.material_inbounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "只有超级管理员可以删除入库记录"
ON public.material_inbounds
FOR DELETE
USING (public.is_current_user_super_admin());

-- 系统管理 - users 表
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "只有超级管理员可以删除用户"
ON public.users
FOR DELETE
USING (public.is_current_user_super_admin());

-- 系统管理 - roles 表
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "只有超级管理员可以删除角色"
ON public.roles
FOR DELETE
USING (public.is_current_user_super_admin());

-- 系统管理 - companies 表
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "只有超级管理员可以删除公司"
ON public.companies
FOR DELETE
USING (public.is_current_user_super_admin());

-- ============================================
-- 执行完成！
-- ============================================
