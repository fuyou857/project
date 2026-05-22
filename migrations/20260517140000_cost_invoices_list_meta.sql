-- 成本发票列表：录入人、关联支出合同
ALTER TABLE public.cost_invoices ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.cost_invoices ADD COLUMN IF NOT EXISTS expense_contract_id UUID REFERENCES public.expense_contracts(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.cost_invoices.created_by IS '录入人用户 ID';
COMMENT ON COLUMN public.cost_invoices.expense_contract_id IS '关联支出合同';
