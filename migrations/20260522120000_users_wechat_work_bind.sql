-- 用户与企业微信账号绑定（扫码登录、消息推送）
-- 可重复执行

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS wechat_work_userid VARCHAR(128),
  ADD COLUMN IF NOT EXISTS wechat_work_name VARCHAR(200);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_wechat_work_userid
  ON public.users (wechat_work_userid)
  WHERE wechat_work_userid IS NOT NULL AND wechat_work_userid <> '';

COMMENT ON COLUMN public.users.wechat_work_userid IS '企业微信成员 userid，全局唯一';
COMMENT ON COLUMN public.users.wechat_work_name IS '企业微信显示名（绑定时写入）';

NOTIFY pgrst, 'reload schema';
