-- ============================================
-- 添加 income_invoices 表缺失的列
-- 请在 Supabase Dashboard → SQL Editor 中运行
-- ============================================

ALTER TABLE income_invoices 
  ADD COLUMN IF NOT EXISTS buyer_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS buyer_tax_no VARCHAR(50),
  ADD COLUMN IF NOT EXISTS invoice_type VARCHAR(20) DEFAULT '普票',
  ADD COLUMN IF NOT EXISTS invoice_amount DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_paid BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_payment_method VARCHAR(50),
  ADD COLUMN IF NOT EXISTS tax_payment_voucher TEXT,
  ADD COLUMN IF NOT EXISTS invoice_photo TEXT,
  ADD COLUMN IF NOT EXISTS payment_description VARCHAR(500),
  ADD COLUMN IF NOT EXISTS tax_payment_description TEXT,
  ADD COLUMN IF NOT EXISTS tax_paid_at TIMESTAMP DEFAULT NULL;