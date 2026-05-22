# 数据库迁移约定

## 一、迁移文件命名规范

### 1.1 时间戳格式要求

**❌ 禁止使用**：
- 8位短时间戳：`20260513_fix_operation_logs.sql`
- 下划线分隔的时间戳：`20260513_061614_rbac_permissions.sql`

**✅ 统一使用**：
- **14位完整时间戳** + 描述：`20260513000000_fix_operation_logs.sql`

### 1.2 命名格式

```
YYYYMMDDHHMMSS_description.sql
```

- **YYYY**：4位年份
- **MM**：2位月份
- **DD**：2位日期
- **HH**：2位小时（24小时制）
- **MM**：2位分钟
- **SS**：2位秒
- **description**：迁移的简短描述（用下划线分隔单词）

### 1.3 示例

```
20260513000000_fix_operation_logs.sql
20260515000000_contract_template_library.sql
20260516120000_contract_template_search_rpc.sql
```

## 二、为什么需要这个约定？

### 2.1 避免版本号冲突
- 8位短时间戳（如 `20260513`）在同一天内只能创建一个迁移文件
- 如果有人创建了 `20260513.sql`，其他人再创建会导致冲突
- 14位时间戳精确到秒，可以避免绝大多数冲突

### 2.2 Supabase CLI 兼容性
- Supabase CLI 内部使用 14位时间戳格式
- 遵循官方规范可以避免历史对齐问题

### 2.3 清晰的时间顺序
- 按时间戳排序能清晰看到迁移的先后关系
- 便于追溯数据库变更历史

## 三、迁移文件内容最佳实践

### 3.1 幂等性原则
迁移文件应该是幂等的，即多次执行不会产生错误或重复数据：

```sql
-- ✅ 推荐：使用 IF NOT EXISTS / IF EXISTS
ALTER TABLE operation_logs 
  ADD COLUMN IF NOT EXISTS user_name VARCHAR(255);

DROP POLICY IF EXISTS "operation_logs_all" ON operation_logs;
CREATE POLICY "operation_logs_all" ON operation_logs 
  FOR ALL USING (true) WITH CHECK (true);
```

### 3.2 数据变更要谨慎
- 涉及数据变更的迁移要特别小心
- 考虑添加数据备份逻辑
- 破坏性变更建议分多次迁移完成

## 四、冲突修复指南

如果不幸遇到迁移版本号冲突，按以下步骤修复：

### 4.1 场景：远程有短时间戳迁移，本地没有

1. **把远程的短时间戳迁移标记为 reverted**：
```bash
npx supabase migration repair --status reverted 20260513
```

2. **重命名本地文件为14位时间戳**：
```bash
mv supabase/migrations/20260513_fix_operation_logs.sql \
   supabase/migrations/20260513000000_fix_operation_logs.sql
```

3. **推送迁移**：
```bash
npx supabase db push --include-all
```

### 4.2 场景：SQL已执行但历史不对

如果 SQL 已经安全执行（因为是幂等的），可以只修复历史不重跑 SQL：

```bash
npx supabase migration repair --status applied 20260513
```

## 五、开发流程建议

### 5.1 创建新迁移

1. 使用 Supabase CLI 创建迁移（会自动生成14位时间戳）：
```bash
npx supabase migration new your_migration_name
```

2. 或者手动创建时，确保使用14位时间戳：
```bash
# 获取当前时间戳（Linux/macOS）
date +"%Y%m%d%H%M%S"
```

### 5.2 测试迁移
- 先在本地开发环境测试
- 验证迁移可以正常回滚（如果需要）
- 确认数据变更符合预期

## 六、相关文档

- [部署检查清单](./DEPLOYMENT_CHECKLIST.md)
- [权限控制修改总结](./权限控制修改总结.md)
- [批量修改指南](./批量修改指南.md)
