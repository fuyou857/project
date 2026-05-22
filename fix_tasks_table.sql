-- ============================================
-- 数据库修复脚本：确保 tasks 表和相关表存在
-- ============================================

-- 首先确保 users 表存在（如果还没有）
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

-- 确保 tasks 表存在
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_name VARCHAR(200) NOT NULL,
  description TEXT,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  publisher_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  acceptor_deadline DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'pending_acceptance', 'completed')),
  current_progress NUMERIC(5,2) NOT NULL DEFAULT 0
    CHECK (current_progress >= 0 AND current_progress <= 100),
  total_progress NUMERIC(5,2) NOT NULL DEFAULT 0
    CHECK (total_progress >= 0 AND total_progress <= 100),
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  publish_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  complete_time TIMESTAMPTZ,
  last_report_time TIMESTAMPTZ,
  last_reject_opinion TEXT,
  last_reject_at TIMESTAMPTZ,
  reject_count INT NOT NULL DEFAULT 0,
  del_flag SMALLINT NOT NULL DEFAULT 0 CHECK (del_flag IN (0, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 为 tasks 表创建索引
CREATE INDEX IF NOT EXISTS idx_tasks_project ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_publisher ON public.tasks(publisher_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON public.tasks(acceptor_deadline);
CREATE INDEX IF NOT EXISTS idx_tasks_del ON public.tasks(del_flag);

-- 添加表注释
COMMENT ON TABLE public.tasks IS '项目任务：发布、进度、验收闭环';

-- 确保 task_executors 表存在
CREATE TABLE IF NOT EXISTS public.task_executors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  progress NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_task_executors_task ON public.task_executors(task_id);
CREATE INDEX IF NOT EXISTS idx_task_executors_user ON public.task_executors(user_id);

-- 确保 task_cc 表存在
CREATE TABLE IF NOT EXISTS public.task_cc (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_task_cc_task ON public.task_cc(task_id);

-- 确保 task_progress_reports 表存在
CREATE TABLE IF NOT EXISTS public.task_progress_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  executor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  progress_before NUMERIC(5,2),
  progress_after NUMERIC(5,2) NOT NULL CHECK (progress_after >= 0 AND progress_after <= 100),
  report_content TEXT NOT NULL,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  report_time TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_progress_task ON public.task_progress_reports(task_id);
CREATE INDEX IF NOT EXISTS idx_task_progress_executor ON public.task_progress_reports(executor_id);

-- 确保 task_acceptances 表存在
CREATE TABLE IF NOT EXISTS public.task_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  acceptor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  result TEXT NOT NULL CHECK (result IN ('pass', 'reject')),
  opinion TEXT NOT NULL,
  reject_reason_category VARCHAR(50),
  accept_time TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_acceptances_task ON public.task_acceptances(task_id);

-- 确保 task_operation_logs 表存在
CREATE TABLE IF NOT EXISTS public.task_operation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  detail JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_op_logs_task ON public.task_operation_logs(task_id);

-- 启用 RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_executors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_cc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_progress_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_operation_logs ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略
DO $$ 
BEGIN
  DROP POLICY IF EXISTS tasks_all ON public.tasks;
  CREATE POLICY tasks_all ON public.tasks FOR ALL USING (true) WITH CHECK (true);
  
  DROP POLICY IF EXISTS task_executors_all ON public.task_executors;
  CREATE POLICY task_executors_all ON public.task_executors FOR ALL USING (true) WITH CHECK (true);
  
  DROP POLICY IF EXISTS task_cc_all ON public.task_cc;
  CREATE POLICY task_cc_all ON public.task_cc FOR ALL USING (true) WITH CHECK (true);
  
  DROP POLICY IF EXISTS task_progress_reports_all ON public.task_progress_reports;
  CREATE POLICY task_progress_reports_all ON public.task_progress_reports FOR ALL USING (true) WITH CHECK (true);
  
  DROP POLICY IF EXISTS task_acceptances_all ON public.task_acceptances;
  CREATE POLICY task_acceptances_all ON public.task_acceptances FOR ALL USING (true) WITH CHECK (true);
  
  DROP POLICY IF EXISTS task_operation_logs_all ON public.task_operation_logs;
  CREATE POLICY task_operation_logs_all ON public.task_operation_logs FOR ALL USING (true) WITH CHECK (true);
  
  -- 确保 users 表的 RLS
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = '公开读取') THEN
    CREATE POLICY "公开读取" ON public.users FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = '公开插入') THEN
    CREATE POLICY "公开插入" ON public.users FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = '公开更新') THEN
    CREATE POLICY "公开更新" ON public.users FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = '管理员可删除') THEN
    CREATE POLICY "管理员可删除" ON public.users FOR DELETE USING (true);
  END IF;
END $$;

-- 插入默认用户（如果不存在）
INSERT INTO public.users (username, password, real_name, status)
SELECT 'admin', 'YWRtaW4xMjM=', '系统管理员', 'active'
WHERE NOT EXISTS (SELECT 1 FROM public.users WHERE username = 'admin');

-- ============================================
-- 完成！
-- ============================================
