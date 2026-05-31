#!/usr/bin/env bash
set -euo pipefail

if [ -z "${DB_PASSWORD:-}" ]; then
  echo "错误: 请设置环境变量 DB_PASSWORD 后运行此脚本"
  echo "用法: DB_PASSWORD=your_pass bash force-migrate.sh"
  exit 1
fi

export PGHOST="db.wlkrdylgojkhgfzvcagc.supabase.co"
export PGPORT="5432"
export PGUSER="postgres"
export PGPASSWORD="${DB_PASSWORD}"
export PGDATABASE="postgres"

SQL_FILE="migrations/20260517150000_invoice_association_fields.sql"

echo "正在执行迁移 SQL: $SQL_FILE"

# 尝试使用 supabase 内置的 pg_dump 环境中的某些工具（如果有的话）
# 或者尝试通过 nodejs 动态加载 pg 模块（如果能找到的话）
# 既然之前的 dry-run 成功了，说明 supabase CLI 内部有某种方式连接数据库

# 尝试一种 hack 方式：利用 supabase db dump 的 dry-run 脚本来执行我们自己的 SQL
# 但 pg_dump 不支持执行任意 SQL。

# 我们尝试在 /tmp 目录下安装一个极简的 pg 客户端
# 由于 /www/server/nodejs/v24.15.0/cache 是只读的，我们尝试指定其他 cache 目录
export npm_config_cache=/tmp/npm-cache
mkdir -p /tmp/npm-cache /tmp/pg-client
cd /tmp/pg-client
npm install pg --no-save

node -e "
const { Client } = require('pg');
const fs = require('fs');
const sql = fs.readFileSync('/www/wwwroot/ciond/migrations/20260517150000_invoice_association_fields.sql', 'utf8');

// 使用 IPv4 代理地址 (Supabase 推荐在 IPv6 受限环境使用)
const client = new Client({ 
  host: 'aws-0-ap-southeast-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.wlkrdylgojkhgfzvcagc',
  password: process.env.DB_PASSWORD,
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

client.connect()
  .then(() => {
    console.log('连接成功 (IPv4)...');
    return client.query(sql);
  })
  .then(() => { 
    console.log('迁移成功！'); 
    process.exit(0); 
  })
  .catch(err => { 
    console.error('失败:', err.message); 
    process.exit(1); 
  });
"
