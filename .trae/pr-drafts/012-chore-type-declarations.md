# PR #12: chore: 添加缺失类型声明 & 小修

**状态**: ✅ 已完成（代码已合并）

## 目标

修复 `tsc --noEmit` 报告的找不到模块与类型推断为 `never` 的错误。纯类型补全，无运行逻辑改动。

## 变更文件

| 文件 | 变更 |
|------|------|
| `src/pages/contract/draftEditorLocationState.ts` | **新增** — 导出 `DraftEditorLocationState` 接口，供编辑器路由页面使用 |
| `src/pages/contract/GeneratedContractDraftEditorPage.tsx` | 导入类型并使用 `navState` 强类型 |
| `src/pages/contract/ContractTemplateLibraryPage.tsx` | 导入类型用于 `createDraftFromTemplateAndEdit` 跳转 |
| `src/services/approvalStepResolve.ts` | 使用 `(data as unknown) as Record<string, unknown>` 消除 TS2352 |
| `src/services/invoiceOcrService.ts` | 避免 `null` 赋给 `never` 类型，先转 `Record<string, unknown>` 再转目标类型 |
| `src/services/logService.ts` | 使用类型断言修复 `parse` 签名不匹配 |
| `src/utils/apiErrorMonitor.ts` | 为 `XMLHttpRequest` 添加 `monitor` 类型声明；修复 `apply` 参数 |
| `src/hooks/useInvoiceOcrForm.ts` | `ocrFormSnapshot` 使用类型断言 `as CostInvoiceForm` |
| `src/pages/Projects/index.tsx` | `partyA` 使用 `(item.party_a as unknown as PartyA).id` 消除断言错误 |
| `src/pages/contract/ExpenseContractList.tsx` | `PartyB` 属性改为 `unit_name` 匹配实际接口 |
| `src/pages/finance/UninvoicedPayments.tsx` | 使用 `recordForm.invoice_amount ?? 0` 处理 null |
| `src/pages/finance/costInvoice/list/CostInvoiceFilters.tsx` | 使用 `contract_code: c.contract_code ?? undefined` 排除 null |
| `src/services/approvalService.ts` | 提取 `body` 变量并正确传递给 `notifyApprover` |
| `src/components/approval/SubmitApprovalModal.tsx` | 从 `candidates` 查找 `isDefault` |

## 向后兼容

纯类型补全，无运行逻辑变更。所有页面行为不受影响。

## 回归步骤

1. `npm run typecheck` — 应通过（0 errors）
2. 编译：`npm run build` — 应通过
3. 关键路径回归：合同模板库 → 生成草稿 → 跳转编辑器（验证路由 state 类型无误）
4. 审批流程：发起审批 → 选择审批人（验证 `isDefault` 正常）

## 回退方法

```bash
git revert <merge-commit> && npm run typecheck
```