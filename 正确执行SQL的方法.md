# 正确执行SQL脚本的方法

## 错误原因

您收到的错误是因为直接在SQL客户端中执行了shell命令：
```sql
psql -d <your-database-url> -f 完善数据库表结构.sql
```

这是一个**shell命令**，应该在终端（命令行）中执行，而不是在SQL客户端中执行。

## 正确的执行方法

### 方法1：直接复制SQL语句到SQL客户端执行

这是最直接的方法，适合在Supabase控制台或其他SQL客户端中使用：

1. 打开SQL客户端（如Supabase控制台的SQL编辑器）
2. 复制以下SQL语句并粘贴到编辑器中：

```sql
-- 1. 为operation_logs表添加description列
ALTER TABLE public.operation_logs
ADD COLUMN description text;

-- 2. 为notifications表的dedupe_key列添加唯一约束
ALTER TABLE public.notifications
ADD CONSTRAINT unique_dedupe_key UNIQUE (dedupe_key);

-- 3. 为operation_logs表添加索引以提高查询性能
CREATE INDEX idx_operation_logs_user_id ON public.operation_logs(user_id);
CREATE INDEX idx_operation_logs_created_at ON public.operation_logs(created_at);
CREATE INDEX idx_operation_logs_module_action ON public.operation_logs(module, action);

-- 4. 为notifications表添加索引以提高查询性能
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at);
CREATE INDEX idx_notifications_category ON public.notifications(category);
```

3. 点击"执行"或"Run"按钮

### 方法2：在终端中使用psql命令

如果您在服务器上或本地安装了psql客户端，可以在终端中执行：

```bash
# 替换<your-database-url>为您的实际数据库URL
psql -d <your-database-url> -f 完善数据库表结构.sql
```

## 分步执行建议

为了确保每个操作都成功执行，您可以分步执行SQL语句：

1. **第一步**：添加description列
   ```sql
   ALTER TABLE public.operation_logs ADD COLUMN description text;
   ```

2. **第二步**：添加唯一约束
   ```sql
   ALTER TABLE public.notifications ADD CONSTRAINT unique_dedupe_key UNIQUE (dedupe_key);
   ```

3. **第三步**：添加索引（可选，可提高性能）
   ```sql
   -- 为operation_logs表添加索引
   CREATE INDEX idx_operation_logs_user_id ON public.operation_logs(user_id);
   CREATE INDEX idx_operation_logs_created_at ON public.operation_logs(created_at);
   CREATE INDEX idx_operation_logs_module_action ON public.operation_logs(module, action);
   
   -- 为notifications表添加索引
   CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
   CREATE INDEX idx_notifications_created_at ON public.notifications(created_at);
   CREATE INDEX idx_notifications_category ON public.notifications(category);
   ```

## 验证执行结果

执行完成后，您可以运行以下查询来验证结果：

1. **验证operation_logs表结构**
   ```sql
   SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'operation_logs';
   ```

2. **验证notifications表约束**
   ```sql
   SELECT constraint_name, constraint_type FROM information_schema.table_constraints WHERE table_name = 'notifications';
   ```

## 注意事项

- 执行前请确保已备份数据库
- 如果某些索引已经存在，可能会收到警告，可以忽略
- 如果dedupe_key列已经有重复值，添加唯一约束会失败，需要先清理重复数据

如果您在执行过程中遇到任何问题，请提供具体的错误信息，我会进一步帮助您解决。