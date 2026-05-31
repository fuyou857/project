#!/usr/bin/env node
/**
 * 在 Supabase 远程库执行 users 企微绑定字段迁移。
 * 需要：DATABASE_URL 或 SUPABASE_DB_URL
 *
 * 用法：DATABASE_URL='postgresql://...' node scripts/apply-users-wechat-work-migration.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const sqlPath = path.join(root, 'migrations/20260522120000_users_wechat_work_bind.sql');

const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error('[migrate] 请设置 DATABASE_URL 或 SUPABASE_DB_URL');
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, 'utf8');

async function main() {
  let pg;
  try {
    pg = await import('pg');
  } catch {
    console.error('[migrate] 需要 pg 包：npm install pg --save-dev');
    process.exit(1);
  }

  const client = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
    const { rows } = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema='public' AND table_name='users'
         AND column_name IN ('wechat_work_userid','wechat_work_name')`,
    );
    console.log('[migrate] 执行成功，列:', rows.map((r) => r.column_name).join(', '));
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('[migrate] 失败:', e.message);
  process.exit(1);
});
