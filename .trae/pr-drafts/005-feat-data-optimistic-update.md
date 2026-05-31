# PR #5: feat(data): 乐观更新 + 撤销

**状态**: 📝 待实现

**估算**: 4h

## 目标

在列表操作的删除/恢复等场景中提供即时 UI 反馈（不等待 API 响应），同时提供 5 秒可撤销的 Toast，提升操作流畅感和容错。

## 变更文件

| 文件 | 变更 |
|------|------|
| `src/utils/optimistic.ts` | **新增** — 乐观更新核心工具函数 |
| `src/pages/contract/ContractTemplateLibraryPage.tsx` | 在删除/恢复操作中集成乐观更新 |
| `src/pages/contract/ExpenseContractList.tsx` | 同上 |
| `src/pages/contract/IncomeContractList.tsx` | 同上 |
| `src/contexts/ToastContext.tsx` | 扩展支持「撤销」类型 toast（带 action 按钮） |

## optimisticUpdate 实现

```tsx
// src/utils/optimistic.ts
interface OptimisticOptions<T> {
  /** API 调用（返回真实结果） */
  apiCall: () => Promise<T>;
  /** 立即应用到 UI 的乐观状态 */
  optimisticState: T;
  /** API 失败时的回滚函数 */
  rollback: () => void;
  /** 可选：撤销回调（用户点击撤销时执行） */
  onUndo?: () => Promise<T>;
}

export async function optimisticUpdate<T>({
  apiCall,
  optimisticState,
  rollback,
  onUndo,
}: OptimisticOptions<T>): Promise<{ success: boolean; data?: T; error?: Error }> {
  // 1. 立即应用乐观状态
  applyOptimisticState(optimisticState);

  try {
    // 2. 发起真实 API 调用
    const result = await apiCall();
    return { success: true, data: result };
  } catch (error) {
    // 3. 失败回滚
    rollback();
    return { success: false, error: error as Error };
  }
}
```

## 撤销 Toast 集成

```tsx
// 在 ToastContext 中扩展支持撤销
interface UndoToast {
  message: string;
  onUndo: () => void;
  durationMs?: number; // 默认 5000ms
}

// 使用
const { showUndoToast } = useToast();

const handleDelete = async (id: string) => {
  const item = list.find(x => x.id === id);
  
  const result = await optimisticUpdate({
    optimisticState: list.filter(x => x.id !== id),
    apiCall: () => softDeleteContract(id),
    rollback: () => setList(prev => [...prev, item!]),
  });

  if (result.success) {
    showUndoToast({
      message: '已删除',
      onUndo: async () => {
        await optimisticUpdate({
          optimisticState: [...list],
          apiCall: () => restoreContract(id),
          rollback: () => {},
        });
      },
    });
  } else {
    showToast('error', '删除失败');
  }
};
```

## ToastContext 扩展

在 `ToastContext.tsx` 中增加 `showUndoToast` 方法：

```tsx
interface UndoToastData {
  message: string;
  onUndo: () => void;
  actionLabel?: string;
}

interface ToastContextValue {
  // 已有
  toast: ToastData;
  showToast: (type: string, message: string) => void;
  dismissToast: () => void;
  // 新增
  showUndoToast: (data: UndoToastData) => void;
}
```

撤销按钮使用 `LongTaskStatus` 组件的按钮样式。

## 向后兼容

- `showToast(type, msg)` 调用不受影响
- `showUndoToast` 是增量新增
- 未使用乐观更新的操作保持不变

## 测试步骤

1. 删除合同 → 列表立即消失，显示「已删除」撤销 Toast
2. 5 秒内点击「撤销」→ 列表恢复
3. 不点击撤销 → 5 秒后 Toast 自动消失，记录已删除
4. 模拟 API 失败 → 列表回滚到删除前状态
5. 快速连续删除/撤销多次 → 状态一致

## 回退方法

```bash
git revert <merge-commit>
```