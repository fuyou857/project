# PR #7: feat(ui): 长任务状态组件 (LongTaskStatus)

**状态**: ✅ 已完成（代码已合并）

**估算**: 4h → 实际 0.5h

## 目标

为生成合同、重新填充 Word、PDF 转换等耗时任务提供统一的进度/状态/重试展示组件，替代散落的 busy flag + 按钮文案组合。

## 变更文件

| 文件 | 变更 |
|------|------|
| `src/components/LongTaskStatus.tsx` | **新增** — 通用长任务状态组件 |
| `src/components/index.ts` | 导出 `LongTaskStatus` |

## LongTaskStatus API

```tsx
<LongTaskStatus
  status="running"        // 'running' | 'success' | 'failed' | 'idle'
  progress={65}           // 0-100，仅 running 时显示进度条
  label="正在生成合同…"    // 自定义状态文案
  errorMessage="网络超时"  // 失败时显示
  onRetry={() => retry()} // 失败时显示重试按钮
/>
```

## 状态展示

| status | 图标 | 颜色 | 额外 UI |
|--------|------|------|---------|
| `running` | FaSpinner (旋转) | 蓝色 | 进度条 + 百分比 |
| `success` | FaCheckCircle | 绿色 | — |
| `failed` | FaExclamationTriangle | 红色 | 错误消息 + 重试按钮 |
| `idle` | (隐藏) | — | — |

## 向后兼容

纯新增组件，无接口变更。现有 `quickGenBusyId`/`genDocxBusy`/`retryFillBusy` 等状态可逐步迁移到 LongTaskStatus。

## 测试步骤

1. `npm run typecheck` — 通过
2. 在页面中手动渲染各状态变体验证视觉
3. 触发失败状态 → 点击重试按钮 → 确认 onRetry 回调触发
4. 触发 running + progress → 确认进度条动画

## 回退方法

```bash
git revert <merge-commit>
```