-- 站内信、截止提醒偏好、任务评论、Webhook 配置（开放集成占位）

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title varchar(500) NOT NULL,
  body text,
  category varchar(64) NOT NULL DEFAULT 'system',
  read_at timestamptz,
  dedupe_key varchar(500),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedupe_key_unique
  ON notifications (dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id) WHERE read_at IS NULL;

COMMENT ON TABLE notifications IS '站内消息：截止提醒、系统通知等';
COMMENT ON COLUMN notifications.dedupe_key IS '去重键，如 task_deadline|userId|taskId|before|sendDate';

CREATE TABLE IF NOT EXISTS user_reminder_prefs (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  days_before jsonb NOT NULL DEFAULT '[1, 3, 7]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE user_reminder_prefs IS '任务截止提前提醒天数（可扩展为自定义数组，如 [1,2,5,7]）';

CREATE TABLE IF NOT EXISTS task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  body text NOT NULL,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task_active ON task_comments(task_id, created_at DESC)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE task_comments IS '任务评论（首版只读列表；富文本/@ 后续扩展）';

CREATE TABLE IF NOT EXISTS integration_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(200),
  target_url text NOT NULL,
  events text[] NOT NULL DEFAULT '{}',
  secret varchar(500),
  enabled boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE integration_webhooks IS '出站 Webhook 配置（由后端/Edge Function 实际投递）';

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_reminder_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_webhooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_all ON notifications;
CREATE POLICY notifications_all ON notifications FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS user_reminder_prefs_all ON user_reminder_prefs;
CREATE POLICY user_reminder_prefs_all ON user_reminder_prefs FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS task_comments_all ON task_comments;
CREATE POLICY task_comments_all ON task_comments FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS integration_webhooks_all ON integration_webhooks;
CREATE POLICY integration_webhooks_all ON integration_webhooks FOR ALL USING (true) WITH CHECK (true);
