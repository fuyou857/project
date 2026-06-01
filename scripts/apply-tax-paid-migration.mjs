import { Client } from 'pg';
import fs from 'fs';

const dbPassword = process.env.DB_PASSWORD;
if (!dbPassword) {
  console.error('请设置环境变量 DB_PASSWORD');
  process.exit(1);
}

const sql = `
ALTER TABLE income_invoices 
ADD COLUMN IF NOT EXISTS tax_paid BOOLEAN DEFAULT false;

ALTER TABLE income_invoices 
ADD COLUMN IF NOT EXISTS tax_paid_at TIMESTAMP DEFAULT NULL;
`;

const client = new Client({ 
  host: 'aws-0-ap-southeast-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.wlkrdylgojkhgfzvcagc',
  password: dbPassword,
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

client.connect()
  .then(() => {
    console.log('连接成功...');
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
