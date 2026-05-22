-- 查询operation_logs表的实际结构
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'operation_logs' AND table_schema = 'public';

-- 查询notifications表的实际结构
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'notifications' AND table_schema = 'public';