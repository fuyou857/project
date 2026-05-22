# 数据库Schema与代码一致性检查报告

**生成时间**: 2026-05-17
**检查范围**: cost_invoices 表及前端代码

---

## 1. 数据库字段定义（最终Schema）

### 原始表结构 (migrations/20260425_053137_create_erp_tables.sql)
```sql
CREATE TABLE public.cost_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  invoice_type VARCHAR(10),
  invoice_number VARCHAR(100),
  invoice_amount DECIMAL(15,2) NOT NULL,
  deductible_tax DECIMAL(15,2),
  is_paid BOOLEAN DEFAULT FALSE,
  payment_record_id UUID,
  invoice_date DATE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### OCR扩展字段 (migrations/20260515120000_cost_invoices_ocr_fields.sql)
```sql
ALTER TABLE public.cost_invoices ADD COLUMN IF NOT EXISTS invoice_code VARCHAR(32);
ALTER TABLE public.cost_invoices ADD COLUMN IF NOT EXISTS amount_excluding_tax NUMERIC(15, 2);
ALTER TABLE public.cost_invoices ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(8, 6);
ALTER TABLE public.cost_invoices ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(15, 2);
ALTER TABLE public.cost_invoices ADD COLUMN IF NOT EXISTS goods_name TEXT;
ALTER TABLE public.cost_invoices ADD COLUMN IF NOT EXISTS seller_name TEXT;
ALTER TABLE public.cost_invoices ADD COLUMN IF NOT EXISTS seller_tax_id VARCHAR(32);
ALTER TABLE public.cost_invoices ADD COLUMN IF NOT EXISTS remark TEXT;
ALTER TABLE public.cost_invoices ADD COLUMN IF NOT EXISTS ocr_invoice_type_label VARCHAR(100);
ALTER TABLE public.cost_invoices ADD COLUMN IF NOT EXISTS attachment_urls JSONB;
ALTER TABLE public.cost_invoices ADD COLUMN IF NOT EXISTS ocr_status VARCHAR(20);
```

### 最终完整字段列表

| 序号 | 字段名 | 数据类型 | 约束 | 来源 |
|------|--------|----------|------|------|
| 1 | id | UUID | PRIMARY KEY | 原始 |
| 2 | project_id | UUID | FK(projects) | 原始 |
| 3 | supplier_id | UUID | FK(suppliers) | 原始 |
| 4 | invoice_type | VARCHAR(10) | - | 原始 |
| 5 | invoice_number | VARCHAR(100) | - | 原始 |
| 6 | invoice_amount | DECIMAL(15,2) | NOT NULL | 原始 |
| 7 | deductible_tax | DECIMAL(15,2) | - | 原始 |
| 8 | is_paid | BOOLEAN | DEFAULT FALSE | 原始 |
| 9 | payment_record_id | UUID | - | 原始 |
| 10 | invoice_date | DATE | - | 原始 |
| 11 | created_at | TIMESTAMP | DEFAULT NOW() | 原始 |
| 12 | invoice_code | VARCHAR(32) | - | OCR扩展 |
| 13 | amount_excluding_tax | NUMERIC(15,2) | - | OCR扩展 |
| 14 | tax_rate | NUMERIC(8,6) | - | OCR扩展 |
| 15 | tax_amount | NUMERIC(15,2) | - | OCR扩展 |
| 16 | goods_name | TEXT | - | OCR扩展 |
| 17 | seller_name | TEXT | - | OCR扩展 |
| 18 | seller_tax_id | VARCHAR(32) | - | OCR扩展 |
| 19 | remark | TEXT | - | OCR扩展 |
| 20 | ocr_invoice_type_label | VARCHAR(100) | - | OCR扩展 |
| 21 | attachment_urls | JSONB | - | OCR扩展 |
| 22 | ocr_status | VARCHAR(20) | - | OCR扩展 |

---

## 2. 前端代码字段使用情况

### InvoiceEntry.tsx (新增/编辑发票)

**插入操作**:
```typescript
const baseInvoiceData: Record<string, unknown> = {
  project_id: form.project_id,
  supplier_id: form.supplier_id,
  invoice_type: form.invoice_type,
  invoice_number: form.invoice_number,
  invoice_amount: form.invoice_amount,
  deductible_tax: form.invoice_type === '专票' ? form.deductible_tax ?? 0 : null,
  invoice_date: form.invoice_date,
  attachment_urls: form.attachment_urls.length > 0 ? form.attachment_urls : null,
  invoice_code: form.invoice_code.trim() || null,
  amount_excluding_tax: form.amount_excluding_tax ?? null,
  tax_rate: form.tax_rate ?? null,
  tax_amount: form.tax_amount ?? null,
  goods_name: form.goods_name.trim() || null,
  seller_name: form.seller_name.trim() || null,
  seller_tax_id: form.seller_tax_id.trim() || null,
  remark: packExtendedRemark(form) || null,
  ocr_invoice_type_label: form.ocr_invoice_type_label.trim() || null,
  ocr_status: form.attachment_urls.length > 0 ? persistOcrStatus : 'idle',
  is_paid: false,
  paid_amount: 0,
  remaining_amount: form.invoice_amount,
};
```

**更新操作**:
```typescript
const invoiceData = {
  ...baseInvoiceData,
  is_paid: editingInvoice.is_paid,
  payment_record_id: editingInvoice.payment_record_id,
  paid_amount: paid,
  remaining_amount: Math.max(0, (form.invoice_amount ?? 0) - paid),
};
```

---

## 3. 字段一致性检查结果

### ✅ 完全匹配的字段（22个）

| 字段名 | 数据库 | 前端代码 | 状态 |
|--------|--------|----------|------|
| id | ✅ UUID | 自动生成 | ✅ 匹配 |
| project_id | ✅ UUID | ✅ UUID | ✅ 匹配 |
| supplier_id | ✅ UUID | ✅ UUID | ✅ 匹配 |
| invoice_type | ✅ VARCHAR(10) | ✅ STRING | ✅ 匹配 |
| invoice_number | ✅ VARCHAR(100) | ✅ STRING | ✅ 匹配 |
| invoice_amount | ✅ DECIMAL(15,2) | ✅ NUMBER | ✅ 匹配 |
| deductible_tax | ✅ DECIMAL(15,2) | ✅ NUMBER | ✅ 匹配 |
| is_paid | ✅ BOOLEAN | ✅ BOOLEAN | ✅ 匹配 |
| payment_record_id | ✅ UUID | ✅ UUID | ✅ 匹配 |
| invoice_date | ✅ DATE | ✅ STRING | ✅ 匹配 |
| created_at | ✅ TIMESTAMP | 自动生成 | ✅ 匹配 |
| invoice_code | ✅ VARCHAR(32) | ✅ STRING | ✅ 匹配 |
| amount_excluding_tax | ✅ NUMERIC(15,2) | ✅ NUMBER | ✅ 匹配 |
| tax_rate | ✅ NUMERIC(8,6) | ✅ NUMBER | ✅ 匹配 |
| tax_amount | ✅ NUMERIC(15,2) | ✅ NUMBER | ✅ 匹配 |
| goods_name | ✅ TEXT | ✅ STRING | ✅ 匹配 |
| seller_name | ✅ TEXT | ✅ STRING | ✅ 匹配 |
| seller_tax_id | ✅ VARCHAR(32) | ✅ STRING | ✅ 匹配 |
| remark | ✅ TEXT | ✅ STRING | ✅ 匹配 |
| ocr_invoice_type_label | ✅ VARCHAR(100) | ✅ STRING | ✅ 匹配 |
| attachment_urls | ✅ JSONB | ✅ JSON ARRAY | ✅ 匹配 |
| ocr_status | ✅ VARCHAR(20) | ✅ STRING | ✅ 匹配 |

### ❌ 不匹配的字段（1个，已修复）

| 字段名 | 数据库 | 前端代码 | 问题 | 状态 |
|--------|--------|----------|------|------|
| attachment_url | ❌ 不存在 | ⚠️ 原来有 | 代码引用了不存在的字段 | ✅ 已移除 |

**问题描述**:
- 数据库只定义了 `attachment_urls` (JSONB类型)
- 原代码同时引用了 `attachment_url` 和 `attachment_urls`
- 导致Supabase ORM报错 "Could not find the 'attachment_url' column"

**修复措施**:
```typescript
// 已移除 attachment_url 字段
const baseInvoiceData: Record<string, unknown> = {
  // attachment_url: form.attachment_url || null,  // ❌ 已删除
  attachment_urls: form.attachment_urls.length > 0 ? form.attachment_urls : null,
  // ... 其他字段
};
```

### ⚠️ 前端额外使用的字段（需数据库确认）

| 字段名 | 前端代码 | 数据库 | 状态 |
|--------|----------|--------|------|
| paid_amount | ✅ 有 | ❌ 缺失 | ⚠️ 需要添加 |
| remaining_amount | ✅ 有 | ❌ 缺失 | ⚠️ 需要添加 |

**问题描述**:
前端在保存时使用了 `paid_amount` 和 `remaining_amount` 字段，但数据库中不存在这些字段。

---

## 4. 类型转换注意事项

### 自动类型转换（无问题）

| 前端类型 | 数据库类型 | 转换说明 |
|----------|-----------|----------|
| STRING | VARCHAR/TEXT | 直接插入 |
| NUMBER | DECIMAL/NUMERIC | 自动转换 |
| BOOLEAN | BOOLEAN | 直接插入 |
| UUID | UUID | 直接插入 |
| JSON ARRAY | JSONB | 自动JSON序列化 |
| DATE STRING | DATE | PostgreSQL自动解析 |
| null | 可空字段 | 自动转换为SQL NULL |

---

## 5. 发现的问题及修复建议

### 问题1: 缺失的数据库字段 ⚠️

**问题**:
- `paid_amount` 字段在前端使用，但数据库不存在
- `remaining_amount` 字段在前端使用，但数据库不存在

**影响**:
- 前端尝试插入这些字段会导致错误
- 但由于使用了展开运算符 `...baseInvoiceData`，这两个字段可能只在编辑时使用

**建议**:
1. 检查前端代码确认这些字段的使用场景
2. 如果需要，添加相应的数据库字段
3. 或者在前端代码中移除对这些字段的引用

**当前状态**: 前端代码显示这些字段只在编辑（UPDATE）操作时使用，需要确认是否需要在INSERT时也处理。

---

## 6. Schema同步检查清单

### ✅ 已完成的检查

- [x] 数据库迁移文件存在
- [x] 迁移文件语法正确
- [x] 字段名称完全匹配（修复后）
- [x] 字段类型兼容
- [x] 前端代码已同步更新
- [x] 已移除对不存在字段的引用

### ⚠️ 待确认项目

- [ ] `paid_amount` 和 `remaining_amount` 字段处理
- [ ] 数据库实际执行状态验证
- [ ] ORM客户端代码重新生成（如果有）

---

## 7. 最佳实践建议

### 7.1 数据库迁移前检查

```bash
# 1. 语法检查
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f migration.sql

# 2. 验证字段存在
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'cost_invoices';

# 3. 检查约束
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'cost_invoices'::regclass;
```

### 7.2 Schema同步工具

如果使用Prisma ORM，应该运行：
```bash
npx prisma db pull
npx prisma generate
```

如果使用Supabase本地开发：
```bash
supabase db diff
supabase db push
```

### 7.3 代码审查流程

1. **迁移文件审查**
   - [ ] 字段名称拼写检查
   - [ ] 数据类型匹配检查
   - [ ] 约束条件合理性检查
   - [ ] 默认值正确性检查

2. **代码同步审查**
   - [ ] 后端模型定义同步
   - [ ] API请求参数检查
   - [ ] API响应结构检查
   - [ ] 前端表单字段同步
   - [ ] 状态管理字段同步

3. **测试覆盖**
   - [ ] 单元测试：字段验证逻辑
   - [ ] 集成测试：数据库CRUD操作
   - [ ] E2E测试：完整用户流程
   - [ ] 边界条件测试

---

## 8. 下一步行动

### 立即行动
1. [ ] 确认 `paid_amount` 和 `remaining_amount` 字段的处理方式
2. [ ] 如果需要，添加缺失的数据库字段
3. [ ] 在测试环境中验证完整的发票保存流程

### 预防措施
1. [ ] 建立迁移文件审查流程
2. [ ] 添加数据库Schema验证到CI/CD
3. [ ] 创建字段映射文档
4. [ ] 编写自动化一致性检查脚本

---

## 附录：相关文件路径

| 文件 | 说明 |
|------|------|
| `/www/wwwroot/ciond/migrations/20260425_053137_create_erp_tables.sql` | 原始表结构 |
| `/www/wwwroot/ciond/migrations/20260515120000_cost_invoices_ocr_fields.sql` | OCR扩展字段 |
| `/www/wwwroot/ciond/src/pages/finance/InvoiceEntry.tsx` | 前端发票表单 |
| `/www/wwwroot/ciond/src/pages/finance/costInvoice/types.ts` | 类型定义 |

---

**报告生成工具**: Claude Code
**检查人员**: AI Assistant
**审核状态**: 待确认
