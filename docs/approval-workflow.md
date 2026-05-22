# 审批系统实施说明

## 部署顺序（Supabase SQL Editor）

1. `migrations/20260521120000_approval_workflow_construction.sql`
2. `migrations/20260520180000_approval_phase3.sql`
3. `migrations/20260521140000_approval_phase4.sql`
4. `migrations/20260521150000_approval_phase5_sign_conditions.sql`

## 已完成能力摘要

| 阶段 | 能力 |
|------|------|
| 一～二 | 12 类流程、待办/发起、撤回、通知、业务回写 |
| 三 | 催办、批量审批、意见模板、@、代理、看板、导出 |
| 四 | 抄送、SLA 预警、重新提交、看板时效 |
| 五 | **会签/或签**、**金额条件分支** |

## 第五阶段说明

### 会签 / 或签

- `approval_steps.sign_type`：`normal`（默认）、`orsign`（任一审批人通过即可）、`countersign`（全部通过）
- 迁移已将 **公司领导** 步骤设为 `orsign`
- 会签使用 `approval_step_votes` 记录每人投票；未齐时待办仍显示，已投票人不再出现在待办列表
- 批量审批**不支持**会签步骤

在库中调整示例：

```sql
UPDATE approval_steps SET sign_type = 'countersign'
WHERE source_type = 'income_contract' AND approver_role = 'admin';
```

### 条件分支（金额）

- 表 `approval_conditions`：变更签证金额 **&lt; 10 万** 时流程最多到第 3 步（跳过领导、出纳）
- 依据业务表 `variation_amount` / `change_amount` 动态裁剪步骤

新增规则示例：

```sql
INSERT INTO approval_conditions (source_type, field_name, operator, threshold_value, max_step_order, description)
VALUES ('income_output', 'variation_amount', 'lt', 50000, 2, '示例：小金额产值简化');
```

## 待开发

邮件通知、敏感字段脱敏、会签/或签管理界面、统计表持久化等。
