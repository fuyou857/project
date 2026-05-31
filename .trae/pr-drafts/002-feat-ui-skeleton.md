# PR #2: feat(ui): 添加 Skeleton 占位组件

**状态**: ✅ 已完成（代码已合并）

**估算**: 3h → 实际 0.5h（简洁实现 + 替换关键占位）

## 目标

统一加载占位以减少页面抖动（jank），替换散落的 "加载中…" 文本。

## 变更文件

| 文件 | 变更 |
|------|------|
| `src/components/ui/Skeleton.tsx` | **新增** — Skeleton 组件，支持 `variant`/`rows`/`width`/`height` |
| `src/components/ui/index.ts` | 导出 Skeleton |
| `src/pages/contract/ContractTemplateLibraryPage.tsx` | 替换分类加载文本为 `<Skeleton variant="text" rows={3} />` |
| `src/pages/contract/ExpenseContractList.tsx` | 替换表格行与卡片加载文本为 Skeleton |

## Skeleton API

```tsx
// 单行文本占位（最常用）
<Skeleton variant="text" />

// 卡片占位（如加载中列表卡片）
<Skeleton variant="card" />

// 表格行占位
<Skeleton variant="table-row" />

// 头像占位（圆形）
<Skeleton variant="avatar" />

// 按钮占位
<Skeleton variant="button" />

// 多行文本
<Skeleton variant="text" rows={4} />

// 自定义尺寸
<Skeleton variant="text" width="75%" height={20} />
```

## 设计决策

- 使用 Tailwind `animate-pulse` 实现脉冲动画（无需额外 CSS）
- `rows` 参数自动包裹 `<div className="space-y-2">` 保持间距
- 默认 `aria-hidden="true"` 避免屏幕阅读器干扰
- 后续 PR 可在更多页面扩展使用（OnlyOffice 加载占位、审批列表等）

## 向后兼容

纯新增组件，无接口变更。所有现有 "加载中…" 文本逐步替换，不影响功能。

## 测试步骤

1. `npm run typecheck` — 通过
2. 合同模板库 → 观察分类加载时段落脉冲动画
3. 支出合同列表 → 加载中时表格显示脉冲占位列
4. 移动端视口 → Skeleton 自适应无溢出
5. 切换暗色模式 → Skeleton 灰色调与背景协调

## Bundle 影响

+0.6 KB (gzip ~0.3 KB)，无外部依赖。

## 回退方法

```bash
git revert <merge-commit>
```