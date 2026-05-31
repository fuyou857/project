# PR #11: chore: 修复 file input & ref 类型问题

**状态**: ✅ 已完成（代码已合并）

## 目标

解决 `onchange`/`ref` 的 TypeScript 类型错误并提高文件上传组件的稳定性。纯类型与架构优化，无运行时逻辑改动。

## 变更文件

| 文件 | 变更 |
|------|------|
| `src/components/contract/ContractAttachmentManager.tsx` | 用 `useRef<HTMLInputElement>` 创建 file input ref，改用 React `<input onChange={}>` 替代 `document.createElement` + `onchange` 直接赋值 |
| `src/components/contract/ContractListToolbar.tsx` | 统一 `RefObject<HTMLInputElement>` 类型签名 |
| `src/pages/contract/ExpenseContractList.tsx` | file input 改用 React `onChange` 事件处理 |
| `src/pages/contract/IncomeContractList.tsx` | file input 改用 React `onChange` 事件处理 |

## 改动要点

1. **ContractAttachmentManager**
   - 移除 `document.createElement('input')` + `fileInput.onchange = handler` 模式
   - 改为 `<input type="file" ref={localFileInputRef} onChange={handleLocalFileSelect} />`
   - 添加 `aria-label` 提升可访问性

2. **ContractListToolbar**
   - `fileInputRef` 属性类型固定为 `RefObject<HTMLInputElement>`
   - 触发点击使用 `fileInputRef.current?.click()`

3. **ExpenseContractList / IncomeContractList**
   - 同步上述 file input 模式，统一事件签名 `React.ChangeEvent<HTMLInputElement>`

## 向后兼容

- `ContractListToolbar` 的 `fileInputRef` 属性签名从宽松类型收窄为 `RefObject<HTMLInputElement>`；调用方若传递不兼容的 ref 需同步修改
- 所有 `onImport` 回调签名不变

## 测试步骤

1. `npm run typecheck` — 应通过（0 errors）
2. 合同列表 → 点「导入 Excel」→ 选择文件 → 确认上传触发
3. ContractAttachmentManager → 「本地上传」→ 选文件 → 确认文件出现在附件列表
4. 键盘导航：Tab 到上传按钮 → Enter/Space 触发文件选择

## 回退方法

```bash
git revert <merge-commit>
```