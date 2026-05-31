# PR #1: feat(ui): 抽取并统一 Toast 服务

**状态**: ✅ 已完成（代码已合并）

**估算**: 3h → 实际 1h

## 目标

集中通知 API（`showToast`），消除散落在各页面的独立 toast 状态管理，使 future PR 可叠加撤销 toast、全局错误通知等能力。

## 变更文件

| 文件 | 变更 |
|------|------|
| `src/contexts/ToastContext.tsx` | **新增** — `ToastProvider` + `useToast()` hook，全局管理 toast 状态与渲染 |
| `src/components/Layout.tsx` | 添加 `ToastProvider` 包裹；`WechatWorkOAuthHost` 改用 `useToast()`；移除 `useSingleToast`/`SingleToastBanner` 直接在 Layout 中的使用 |

## 架构

```
<UiPreferencesProvider>
  <ToastProvider>           ← 新增：全局 toast 状态 + <SingleToastBanner />
    <SubmitApprovalProvider>
      <WechatWorkOAuthHost> ← 用 useToast() 替代自己管理
        …页面…
      </WechatWorkOAuthHost>
    </SubmitApprovalProvider>
  </ToastProvider>
</UiPreferencesProvider>
```

### ToastContext API

```tsx
// 任意子组件调用
import { useToast } from '../contexts/ToastContext';

const { showToast } = useToast();
showToast('success', '操作成功');
showToast('error', '网络错误，请重试');
showToast('warning', '即将过期');
```

## 向后兼容

- `useSingleToast` hook **保持不变**，各页面仍可使用；不影响现有代码
- `SingleToastBanner` 组件 **保持不变**，独立页面可继续使用
- 新增的 `ToastProvider` 是可选增强，Layout 已默认包裹
- 逐步迁移策略：新代码优先用 `useToast()`，旧代码逐步迁移

## 测试步骤

1. `npm run typecheck` — 通过
2. 企业微信扫码登录成功/失败 → 观察 global toast 显示
3. 其他页面（合同列表、财务等）toast 行为不受影响
4. 快速连续触发 toast → 前一条被后一条替换（无重叠）

## 回退方法

```bash
git revert <merge-commit>
```