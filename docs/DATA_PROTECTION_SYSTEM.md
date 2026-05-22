# 全面数据保护机制设计规范

## 概述

本文档定义了系统在执行更新、迁移和配置变更时的数据保护机制。本机制确保所有原始数据（用户信息、业务记录、配置文件、历史数据等）得到完整保留，杜绝任何形式的数据丢失、损坏或不可访问。

## 1. 强制备份策略

### 1.1 备份类型

| 备份类型 | 触发时机 | 保留期限 | 说明 |
|---------|---------|---------|------|
| 完整备份 | 手动触发、系统更新前 | 90天 | 完整数据库备份 |
| 更新前备份 | 每次迁移/更新前自动 | 90天 | 更新前的状态快照 |
| 更新后备份 | 每次迁移/更新后自动 | 90天 | 更新后的状态快照 |

### 1.2 备份执行流程

```
┌─────────────────────────────────────────────────────────────┐
│                    安全迁移流程                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │ 1. 更新前备份 │───▶│ 2. 创建回滚点 │───▶│ 3. 执行迁移  │  │
│  └──────────────┘    └──────────────┘    └──────┬───────┘  │
│                                                  │          │
│        ┌─────────────────────────────────────────┘          │
│        │                                                    │
│        ▼                                                    │
│  ┌──────────────┐    ┌──────────────┐                      │
│  │ 5. 完整性校验 │◀───│ 4. 更新后备份 │                      │
│  └──────────────┘    └──────────────┘                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 使用方法

```bash
# 手动完整备份
./scripts/backup-manager.sh full

# 使用安全迁移流程（推荐）
./scripts/safe-migrate.sh

# 列出所有备份
./scripts/backup-manager.sh list

# 验证备份完整性
./scripts/backup-manager.sh verify <backup-file>

# 恢复备份
./scripts/backup-manager.sh restore <backup-file>
```

### 1.4 备份完整性校验

- **SHA256 校验和**：每个备份文件生成唯一的 SHA256 校验和
- **元数据文件**：每个备份伴随同名的 `.meta.json` 文件，包含：
  - 备份名称和类型
  - 文件大小
  - 校验和
  - 创建时间
  - 执行时长
  - 触发方式

## 2. 数据变更审计日志

### 2.1 审计表结构

#### data_audit_logs（数据变更审计）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGSERIAL | 主键 |
| operation_type | VARCHAR | 操作类型：INSERT/UPDATE/DELETE/SOFT_DELETE/RESTORE |
| table_name | VARCHAR | 表名 |
| record_id | TEXT | 记录 ID |
| old_data | JSONB | 变更前数据 |
| new_data | JSONB | 变更后数据 |
| changed_fields | JSONB | 变更字段列表 |
| operation_by | UUID | 操作用户 ID |
| operation_by_name | VARCHAR | 操作用户姓名 |
| operation_by_email | VARCHAR | 操作用户邮箱 |
| operation_timestamp | TIMESTAMPTZ | 操作时间 |
| is_rollback | BOOLEAN | 是否为回滚操作 |
| metadata | JSONB | 附加元数据 |

#### system_operation_logs（系统操作审计）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGSERIAL | 主键 |
| operation_type | VARCHAR | 操作类型 |
| description | TEXT | 操作描述 |
| operator_id | UUID | 操作员 ID |
| status | VARCHAR | 状态：SUCCESS/FAILURE/WARNING/PARTIAL |
| created_at | TIMESTAMPTZ | 创建时间 |

### 2.2 审计查询示例

```sql
-- 查询某条记录的完整变更历史
SELECT * FROM get_record_history('task_comments', 'record-id-here');

-- 查询某用户的所有操作
SELECT * FROM data_audit_logs 
WHERE operation_by = 'user-uuid' 
ORDER BY operation_timestamp DESC;

-- 查询某表的所有变更
SELECT * FROM data_audit_logs 
WHERE table_name = 'table_name' 
ORDER BY operation_timestamp DESC;
```

## 3. 回滚机制

### 3.1 回滚点管理

回滚点记录在 `rollback_points` 表中，包含：
- 回滚点名称
- 创建时间
- 关联的备份 ID
- 过期时间（默认 7 天）

### 3.2 回滚操作流程

当更新失败或数据异常时，按以下步骤回滚：

1. **停止应用**：停止所有服务访问数据库
2. **确认备份**：验证更新前备份的完整性
3. **执行恢复**：使用备份文件恢复数据库
4. **验证恢复**：执行完整性校验
5. **重启应用**：确认业务正常后重启服务

### 3.3 回滚 SQL 函数

```sql
-- 创建回滚点
SELECT create_rollback_point(
    'my-rollback-point',
    'Before critical change',
    'MANUAL',
    168  -- 过期时间（小时）
);

-- 恢复软删除的记录
SELECT restore_soft_deleted('table_name', 'record-uuid');
```

## 4. 数据完整性校验

### 4.1 完整性校验表

`data_integrity_checks` 表记录每次校验结果：
- 校验的表名
- 校验类型
- 校验结果
- 期望值和实际值
- 校验时间

### 4.2 校验函数

```sql
-- 校验单表
SELECT check_table_integrity('table_name');

-- 批量校验所有业务表
SELECT check_all_tables_integrity();
```

### 4.3 完整性检查项

- ✅ 行数统计检查
- ✅ 关键字段非空约束
- ✅ 外键引用完整性
- ✅ 索引一致性

## 5. 访问权限控制

### 5.1 最小权限原则

| 角色 | 权限 |
|------|------|
| 普通用户 | 只能操作自己的数据，通过 RLS 隔离 |
| 管理员 | 可查看审计日志，关键操作需审批 |
| 系统服务 | 仅允许 service_role 执行备份/恢复 |

### 5.2 RLS（行级安全）策略

所有审计表和关键系统表都启用严格的 RLS：
- `data_audit_logs`：只能读，不能直接写
- `backup_records`：只能读
- `rollback_points`：只能读
- `system_operation_logs`：只能读

### 5.3 关键操作审批

关键操作（如批量删除、数据恢复）需要：
1. 创建审批请求记录在 `critical_operation_approvals` 表
2. 管理员审批
3. 记录执行日志
4. 操作后验证

## 6. 软删除机制

### 6.1 软删除字段

所有业务表添加 `deleted_at TIMESTAMPTZ` 字段：
- NULL = 正常记录
- 有值 = 已软删除

### 6.2 软删除优势

1. **数据可恢复**：误删后可快速恢复
2. **审计完整**：保留完整删除记录
3. **关联安全**：避免级联删除风险

### 6.3 软删除查询

```sql
-- 查询正常记录（排除软删除）
SELECT * FROM table_name WHERE deleted_at IS NULL;

-- 查询已软删除的记录
SELECT * FROM table_name WHERE deleted_at IS NOT NULL;

-- 查询所有记录（包含软删除）
SELECT * FROM table_name;
```

## 7. 迁移文件清单

新增的数据库迁移文件：

| 文件 | 说明 |
|------|------|
| `20260513060000_data_protection_audit_system.sql` | 审计系统核心表和函数 |
| `20260513061000_soft_delete_and_security.sql` | 软删除和安全增强 |

## 8. 实施检查清单

### 开发阶段

- [ ] 所有新表必须包含 `deleted_at` 字段
- [ ] 关键业务表必须启用审计触发器
- [ ] 查询必须默认过滤软删除记录（`deleted_at IS NULL`）
- [ ] 删除操作必须使用软删除

### 测试阶段

- [ ] 验证备份/恢复流程完整可用
- [ ] 验证审计日志正确记录
- [ ] 验证回滚功能正常工作
- [ ] 验证 RLS 策略正确实施
- [ ] 执行压力测试验证性能影响

### 部署阶段

- [ ] 部署前执行完整备份
- [ ] 使用 `safe-migrate.sh` 进行迁移
- [ ] 迁移后执行完整性校验
- [ ] 确认审计日志正常工作

## 9. 应急响应流程

### 9.1 数据丢失应急

1. **立即停止写入**：暂停应用服务
2. **确认最后可用备份**：检查 `backup_records` 表
3. **验证备份完整性**：使用 `backup-manager.sh verify`
4. **执行恢复**：使用 `backup-manager.sh restore`
5. **验证恢复数据**：执行完整性校验
6. **分析原因**：查看审计日志确定根因
7. **文档记录**：完整记录事件和处理过程

### 9.2 联系人

- 数据库管理员：[待填写]
- 技术负责人：[待填写]

## 10. 附录

### 10.1 相关脚本

| 脚本 | 位置 | 说明 |
|------|------|------|
| backup-manager.sh | scripts/ | 备份管理工具 |
| safe-migrate.sh | scripts/ | 安全迁移工具 |

### 10.2 数据库函数参考

| 函数 | 说明 |
|------|------|
| `audit_change_trigger()` | 审计触发器函数 |
| `check_table_integrity()` | 单表完整性校验 |
| `check_all_tables_integrity()` | 批量完整性校验 |
| `create_rollback_point()` | 创建回滚点 |
| `restore_soft_deleted()` | 恢复软删除记录 |
| `get_record_history()` | 获取记录变更历史 |
| `log_system_operation()` | 记录系统操作 |

### 10.3 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0 | 2026-05-13 | 初始版本 |

---

**文档维护者**：开发团队  
**最后更新**：2026-05-13
