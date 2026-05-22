-- ============================================
-- 补充脚本：添加 users 表和 roles 表
-- ============================================

-- 角色表
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 用户表
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(100) NOT NULL UNIQUE,
  password TEXT NOT NULL,
  real_name VARCHAR(100),
  phone VARCHAR(20),
  email VARCHAR(100),
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  role_ids UUID[] DEFAULT '{}',
  project_ids UUID[] DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 启用 RLS
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- RLS 策略
DO $$ 
BEGIN
    -- roles 表策略
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'roles' AND policyname = '公开读取') THEN
        CREATE POLICY "公开读取" ON public.roles FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'roles' AND policyname = '公开插入') THEN
        CREATE POLICY "公开插入" ON public.roles FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'roles' AND policyname = '公开更新') THEN
        CREATE POLICY "公开更新" ON public.roles FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'roles' AND policyname = '管理员删除') THEN
        CREATE POLICY "管理员删除" ON public.roles FOR DELETE USING (true);
    END IF;
    
    -- users 表策略
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = '公开读取') THEN
        CREATE POLICY "公开读取" ON public.users FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = '公开插入') THEN
        CREATE POLICY "公开插入" ON public.users FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = '公开更新') THEN
        CREATE POLICY "公开更新" ON public.users FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = '管理员删除') THEN
        CREATE POLICY "管理员删除" ON public.users FOR DELETE USING (true);
    END IF;
END $$;

-- 插入默认角色 (如果不存在)
INSERT INTO public.roles (name, code, description)
SELECT '超级管理员', 'super_admin', '拥有所有权限'
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE code = 'super_admin');

INSERT INTO public.roles (name, code, description)
SELECT '公司管理员', 'company_admin', '管理公司相关功能'
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE code = 'company_admin');

INSERT INTO public.roles (name, code, description)
SELECT '项目经理', 'project_manager', '管理项目相关功能'
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE code = 'project_manager');

INSERT INTO public.roles (name, code, description)
SELECT '普通员工', 'staff', '普通员工权限'
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE code = 'staff');

-- 插入默认管理员用户 (如果不存在)
-- 用户名: admin, 密码: admin123 (base64 编码)
INSERT INTO public.users (username, password, real_name, status)
SELECT 'admin', 'YWRtaW4xMjM=', '系统管理员', 'active'
WHERE NOT EXISTS (SELECT 1 FROM public.users WHERE username = 'admin');

-- ============================================
-- 完成！
-- ============================================
