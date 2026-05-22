/**
 * 生产构建前断言：DISABLE_FRONTEND_AUTH 必须为 false，防止关闭路由守卫的 bundle 上线。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const filePath = path.join(root, 'src/config/accessControl.ts');

const src = fs.readFileSync(filePath, 'utf8');
const ok =
  /export\s+const\s+DISABLE_FRONTEND_AUTH\s*=\s*false\s*;/.test(src) &&
  !/export\s+const\s+DISABLE_FRONTEND_AUTH\s*=\s*true\s*;/.test(src);

if (!ok) {
  console.error(
    '[assert-prod-auth] 生产构建拒绝：`src/config/accessControl.ts` 中 DISABLE_FRONTEND_AUTH 必须为 `false`。',
  );
  process.exit(1);
}

console.log('[assert-prod-auth] OK：DISABLE_FRONTEND_AUTH === false');

