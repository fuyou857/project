-- 完善数据库表结构的SQL命令
-- 执行前请确保已备份数据库

-- 1. 为operation_logs表添加description列
-- 此列用于存储操作日志的详细描述信息
ALTER TABLE public.operation_logs
ADD COLUMN description text;

-- 2. 为notifications表的dedupe_key列添加唯一约束
-- 此约束用于支持通知的去重功能
ALTER TABLE public.notifications
ADD CONSTRAINT unique_dedupe_key UNIQUE (dedupe_key);

-- 3. 可选：为operation_logs表添加索引以提高查询性能
CREATE INDEX idx_operation_logs_user_id ON public.operation_logs(user_id);
CREATE INDEX idx_operation_logs_created_at ON public.operation_logs(created_at);
CREATE INDEX idx_operation_logs_module_action ON public.operation_logs(module, action);

-- 4. 可选：为notifications表添加索引以提高查询性能
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at);
CREATE INDEX idx_notifications_category ON public.notifications(category);

-- 执行完成后的验证命令
-- 验证operation_logs表结构
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'operation_logs';

-- 验证notifications表约束
-- SELECT constraint_name, constraint_type FROM information_schema.table_constraints WHERE table_name = 'notifications';