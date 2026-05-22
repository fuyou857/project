#!/usr/bin/env node
/**
 * 在 Supabase 远程库执行 system_api_keys 迁移 SQL。
 * 需要环境变量之一：
 *   - DATABASE_URL（Postgres 连接串，推荐 service_role 对应的数据库直连）
 *   - SUPABASE_DB_URL（同上别名）
 *
 * 用法（项目根）：
 *   DATABASE_URL='postgresql://...' node scripts/apply-system-api-keys-migration.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const sqlPath = path.join(root, 'migrations/20260516120000_system_api_keys.sql');

const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error('[migrate] 请设置 DATABASE_URL 或 SUPABASE_DB_URL（Supabase Dashboard → Project Settings → Database）');
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
      `SELECT to_regclass('public.system_api_keys') AS t, to_regclass('public.system_api_key_logs') AS l`,
    );
    console.log('[migrate] 执行成功', rows[0]);
  } finally {
    await client.end();
  }
}

main().catch(e => {
  console.error('[migrate] 失败:', e.message);
  process.exit(1);
});
