-- 催办记录、督办记录、协办审计；执行人表增加 member_role（负责人 / 协办）

ALTER TABLE task_executors ADD COLUMN IF NOT EXISTS member_role varchar(32) NOT NULL DEFAULT 'executor';
ALTER TABLE task_executors DROP CONSTRAINT IF EXISTS task_executors_member_role_check;
ALTER TABLE task_executors ADD CONSTRAINT task_executors_member_role_check
  CHECK (member_role IN ('executor', 'co_assistant'));

COMMENT ON COLUMN task_executors.member_role IS 'executor=负责人执行人；co_assistant=协办（可汇报进度，不可单独申请验收）';

CREATE TABLE IF NOT EXISTS task_urge_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_urge_task_created ON task_urge_records(task_id, created_at DESC);

COMMENT ON TABLE task_urge_records IS '任务催办：发布者对执行侧的书面催办记录';

CREATE TABLE IF NOT EXISTS task_supervision_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  publisher_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content text NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  remind_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_supervision_task ON task_supervision_records(task_id, created_at DESC);

COMMENT ON TABLE task_supervision_records IS '任务督办：发布者督办事项及跟进状态';

CREATE TABLE IF NOT EXISTS task_co_assistant_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action varchar(16) NOT NULL CHECK (action IN ('add', 'remove')),
  actor_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_co_evt_task ON task_co_assistant_events(task_id, created_at DESC);

COMMENT ON TABLE task_co_assistant_events IS '协办人员添加/移除审计记录';

ALTER TABLE task_urge_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_supervision_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_co_assistant_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS task_urge_records_all ON task_urge_records;
CREATE POLICY task_urge_records_all ON task_urge_records FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS task_supervision_records_all ON task_supervision_records;
CREATE POLICY task_supervision_records_all ON task_supervision_records FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS task_co_assistant_events_all ON task_co_assistant_events;
CREATE POLICY task_co_assistant_events_all ON task_co_assistant_events FOR ALL USING (true) WITH CHECK (true);
