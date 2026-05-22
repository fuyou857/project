#!/usr/bin/env node
/**
 * 在 Supabase 远程库添加 cost_invoices.paid_amount / remaining_amount。
 *
 * 用法（项目根）：
 *   DATABASE_URL='postgresql://...' node scripts/apply-cost-invoices-payment-columns.mjs
 *
 * 或在 Supabase Dashboard → SQL Editor 粘贴执行：
 *   migrations/20260517130000_cost_invoices_paid_remaining.sql
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const sqlPath = path.join(root, 'migrations/20260517130000_cost_invoices_paid_remaining.sql');

const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error('[migrate] 请设置 DATABASE_URL 或 SUPABASE_DB_URL');
  console.error('  或在 SQL Editor 执行:', sqlPath);
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, 'utf8');

async function main() {
  let pg;
  try {
    pg = await import('pg');
  } catch {
    console.error('[migrate] 需要 pg：npm install pg --no-save');
    process.exit(1);
  }

  const client = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
    const { rows } = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'cost_invoices'
        AND column_name IN ('paid_amount', 'remaining_amount')
      ORDER BY column_name
    `);
    console.log('[migrate] 完成，已确认列:', rows.map((r) => r.column_name).join(', '));
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('[migrate] 失败:', e.message);
  process.exit(1);
});
