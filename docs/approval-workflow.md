# 审批系统实施说明

## 部署顺序（Supabase SQL Editor）

1. `migrations/20260521120000_approval_workflow_construction.sql`
2. `migrations/20260520180000_approval_phase3.sql`
3. `migrations/20260521140000_approval_phase4.sql`
4. `migrations/20260521150000_approval_phase5_sign_conditions.sql`
5. `migrations/20260521160000_approval_phase6_email_admin.sql`（可选：邮件队列表）
6. `migrations/20260522100000_approval_instance_approvers.sql`（**发起审批弹窗、自定义审批人**）

## 第二阶段补充：发起审批弹窗

- 新建业务记录后通过 `tryCreateApproval()` 弹出「发起审批」对话框（全局挂载于 `Layout`）。
- 服务：`approvalApproverService.ts`（默认审批人、按角色候选人、`resolveProjectIdForApprovalSource`）。
- 提交：`createApprovalWithApprovers()` 写入 `approval_instance_approvers` 与 `approvals.submit_remark`。
- 流转：`resolveApproverUserIds(step, approvalId)` 优先读实例审批人；发起人与某步审批人相同时自动跳过。
- 项目经理默认：匹配项目 `project_manager` 姓名；商务/会计等取对应 `roles.code` 用户池首人。
- 已接入：收入/支出主合同新建；变更/结算/扣款等子页经 `tryCreateApproval` 同样走弹窗。

## 已完成能力摘要

| 阶段 | 能力 |
|------|------|
| 一～二 | 12 类流程、待办/发起、撤回、通知、业务回写、**发起审批弹窗与审批人调整** |
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
