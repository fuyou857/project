-- 任务优先级：urgent / high / medium / low
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('urgent', 'high', 'medium', 'low'));

COMMENT ON COLUMN tasks.priority IS '任务优先级：紧急、高、中、低';

CREATE INDEX IF NOT EXISTS idx_tasks_pub_prio_deadline
  ON tasks (publisher_id, priority, acceptor_deadline)
  WHERE del_flag = 0;

CREATE INDEX IF NOT EXISTS idx_tasks_project_prio
  ON tasks (project_id, priority)
  WHERE del_flag = 0;
