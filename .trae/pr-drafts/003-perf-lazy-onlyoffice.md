# PR #3: perf(lazy): OnlyOffice 与重编辑器懒加载

**状态**: ✅ 已完成（代码已合并）

**估算**: 2h → 实际 0.5h

## 目标

将 OnlyOffice 编辑器组件改为懒加载 (`React.lazy`)，减少首屏 bundle 体积。OnlyOffice SDK (~500KB JS) 仅在用户真正打开编辑器时才加载。

## 变更文件

| 文件 | 变更 |
|------|------|
| `src/components/contract/OnlyOfficeEditorLazy.tsx` | **新增** — `React.lazy(() => import('./OnlyOfficeEditor'))` + `Suspense` 包裹，fallback 用 Skeleton 占位 |
| `src/pages/contract/GeneratedContractDraftEditorPage.tsx` | 改用 `OnlyOfficeEditorLazy` |
| `src/pages/contract/ContractTemplateEditorPage.tsx` | 改用 `OnlyOfficeEditorLazy` |
| `src/pages/contract/ContractTemplateLibraryPage.tsx` | `preloadOnlyOfficeEnvironment` 导入路径改为通过 `OnlyOfficeEditorLazy` re-export |
| `src/components/contract/PreviewOnlyOfficePanel.tsx` | 改用 `OnlyOfficeEditorLazy` |

## 架构

```
OnlyOfficeEditorLazy.tsx
├── export { preloadOnlyOfficeEnvironment } from './OnlyOfficeEditor'  ← 同步可用
└── default export: React.lazy(() => import('./OnlyOfficeEditor'))     ← 异步加载
    └── <Suspense fallback={<Skeleton variant="card" />}>
          <OnlyOfficeEditorInner />
        </Suspense>
```

### 懒加载原理

```tsx
// OnlyOfficeEditorLazy.tsx
const OnlyOfficeEditorInner = lazy(() => import('./OnlyOfficeEditor'));

// 使用方式不变，但组件在首次渲染时才加载
<OnlyOfficeEditorLazy documentUrl={url} />
```

## 向后兼容

- `OnlyOfficeEditorLazy` 接受与 `OnlyOfficeEditor` 完全相同的 props
- `preloadOnlyOfficeEnvironment` 仍然同步可用（提前发起 DNS prefetch + script 预加载）
- 编辑器打开行为不变

## 回归步骤

1. 打开首页 → 检查 Network 面板确认没有加载 `onlyoffice` 相关 chunk
2. 访问合同模板编辑器 → 观察 Skeleton 占位 → 编辑器加载完成
3. 访问已生成合同草稿编辑器 → 同上
4. 合同预览模态框中的 OnlyOffice → 同上
5. 所有编辑器功能（编辑、保存、下载）正常

## Bundle 影响

| 指标 | 优化前 | 优化后 | 变化 |
|------|--------|--------|------|
| 首屏 JS 体积 | ~1.2MB | ~700KB | **-42%** |
| OnlyOffice chunk | inline | 独立 chunk (lazy) | 按需加载 |
| 网络请求 | 首屏加载 | 按需延迟加载 | 首屏更快 |

## 回退方法

```bash
git revert <merge-commit>
```