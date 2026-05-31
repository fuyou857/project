# PR #9: feat(ops): 轻量用户操作审计

**状态**: 📝 待实现

**估算**: 4h

## 目标

在关键用户操作后记录审计日志（POST /api/audit），并提供一个只读的审计日志浏览页面，支持按用户/操作类型筛选。

## 变更文件

| 文件 | 变更 |
|------|------|
| `src/hooks/useActionAudit.ts` | **新增** — 审计日志记录 hook |
| `src/pages/admin/ActivityLog.tsx` | **新增** — 审计日志查看页面 |
| `src/pages/Admin.tsx` | 在 `/admin` 下注册 ActivityLog 子视图 |
| `src/services/logService.ts` | 复用已有的 `OperationLog` 类型 |

## useActionAudit API

```tsx
const { log } = useActionAudit();

// 在关键操作后调用
await log('contract.generate', { contractId: 'xxx', templateId: 'yyy' });
// → POST /api/audit { action, target, meta, userId, timestamp }
```

### 实现

```tsx
// src/hooks/useActionAudit.ts
import { useCallback } from 'react';
import { supabase } from '../supabase/client';
import { useUser } from '../hooks/useUser';

type AuditAction =
  | 'contract.generate'
  | 'contract.delete'
  | 'contract.restore'
  | 'contract.export'
  | 'contract.template.edit'
  | 'approval.submit'
  | 'approval.reject'
  | 'approval.approve'
  | 'upload.file'
  | 'upload.cancel'
  | 'seal.apply'
  | 'seal.borrow'
  | 'payment.register'
  | 'invoice.issue'
  | 'user.login'
  | 'user.role.change';

export function useActionAudit() {
  const { user } = useUser();

  const log = useCallback(
    async (action: AuditAction, meta?: Record<string, unknown>) => {
      if (!user?.id) return;
      try {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          user_name: user.user_metadata?.full_name || user.email,
          action,
          target: meta?.target || null,
          meta: meta ? JSON.stringify(meta) : null,
          ip_address: '', // 由后端解析
          created_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error('[Audit] log failed', err);
      }
    },
    [user],
  );

  return { log };
}
```

## ActivityLog 页面

- 只读表格，显示：时间、用户、操作、目标、详情
- 筛选：日期范围、用户、操作类型
- 分页加载，默认最近 100 条

## 向后兼容

纯新增功能，无接口变更。

## 测试步骤

1. 执行关键操作（合同生成、审批、删除等）→ 检查 `audit_logs` 表有新记录
2. 访问 `/admin/logs` → 显示审计日志列表
3. 按用户/日期/操作类型筛选 → 结果正确
4. 页面只读，不可编辑/删除

## 回退方法

```bash
git revert <merge-commit>
```