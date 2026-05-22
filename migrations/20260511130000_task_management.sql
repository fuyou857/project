-- 任务管理：主表、执行人、抄送、进度汇报、验收、操作日志
-- 状态：in_progress | pending_acceptance | completed（逾期由前端按验收日 + 未完成判定）

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_name varchar(200) NOT NULL,
  description text,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  publisher_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  acceptor_deadline date NOT NULL,
  status text NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'pending_acceptance', 'completed')),
  current_progress numeric(5,2) NOT NULL DEFAULT 0
    CHECK (current_progress >= 0 AND current_progress <= 100),
  total_progress numeric(5,2) NOT NULL DEFAULT 0
    CHECK (total_progress >= 0 AND total_progress <= 100),
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  publish_time timestamptz NOT NULL DEFAULT now(),
  complete_time timestamptz,
  last_report_time timestamptz,
  last_reject_opinion text,
  last_reject_at timestamptz,
  reject_count int NOT NULL DEFAULT 0,
  del_flag smallint NOT NULL DEFAULT 0 CHECK (del_flag IN (0, 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_publisher ON tasks(publisher_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(acceptor_deadline);
CREATE INDEX IF NOT EXISTS idx_tasks_del ON tasks(del_flag);

COMMENT ON TABLE tasks IS '项目任务：发布、进度、验收闭环';

CREATE TABLE IF NOT EXISTS task_executors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  progress numeric(5,2) NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_task_executors_task ON task_executors(task_id);
CREATE INDEX IF NOT EXISTS idx_task_executors_user ON task_executors(user_id);

CREATE TABLE IF NOT EXISTS task_cc (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_task_cc_task ON task_cc(task_id);

CREATE TABLE IF NOT EXISTS task_progress_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  executor_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  progress_before numeric(5,2),
  progress_after numeric(5,2) NOT NULL CHECK (progress_after >= 0 AND progress_after <= 100),
  report_content text NOT NULL,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  report_time timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_progress_task ON task_progress_reports(task_id);
CREATE INDEX IF NOT EXISTS idx_task_progress_executor ON task_progress_reports(executor_id);

CREATE TABLE IF NOT EXISTS task_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  acceptor_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  result text NOT NULL CHECK (result IN ('pass', 'reject')),
  opinion text NOT NULL,
  reject_reason_category varchar(50),
  accept_time timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_acceptances_task ON task_acceptances(task_id);

CREATE TABLE IF NOT EXISTS task_operation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_op_logs_task ON task_operation_logs(task_id);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_executors ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_cc ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_progress_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_operation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tasks_all ON tasks;
CREATE POLICY tasks_all ON tasks FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS task_executors_all ON task_executors;
CREATE POLICY task_executors_all ON task_executors FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS task_cc_all ON task_cc;
CREATE POLICY task_cc_all ON task_cc FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS task_progress_reports_all ON task_progress_reports;
CREATE POLICY task_progress_reports_all ON task_progress_reports FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS task_acceptances_all ON task_acceptances;
CREATE POLICY task_acceptances_all ON task_acceptances FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS task_operation_logs_all ON task_operation_logs;
CREATE POLICY task_operation_logs_all ON task_operation_logs FOR ALL USING (true) WITH CHECK (true);
