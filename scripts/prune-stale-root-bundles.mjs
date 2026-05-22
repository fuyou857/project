/**
 * 删除项目根目录下与当前 dist/ 不一致的 Webpack 产物副本（旧 contenthash），
 * 避免「根目录 + dist」双份部署时根目录堆积旧 main.*.js / vendors.*.js 等。
 *
 * 不删除 dist/ 内文件；不删除 webpack/babel/postcss 等配置文件；不删除 bundle.js 等非标准产物（需人工处理）。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const distDir = path.join(root, 'dist');

const BUNDLE_LIKE =
  /^(main|vendors|runtime|common)\.[a-fA-F0-9]+\.(js|css)(\.(gz|br))?$/;
/** Webpack 数字 id chunk：如 128.9dda9a202eb14185.chunk.js */
const NUMBERED_CHUNK =
  /^\d+\.[a-fA-F0-9]+\.chunk\.(js|css)(\.(gz|br))?$/;
/** 历史构建遗留的纯哈希 chunk 文件名（无 main/runtime 前缀） */
const ORPHAN_HEX_CHUNK = /^[a-fA-F0-9]{16,24}\.js(\.(gz|br))?$/;

function readDistKeepSet() {
  if (!fs.existsSync(distDir)) {
    console.error('[prune-stale-root-bundles] 缺少 dist/，请先执行 npm run build');
    process.exit(1);
  }
  return new Set(fs.readdirSync(distDir));
}

function shouldSkipRootFile(name) {
  if (name === 'package.json' || name === 'package-lock.json') return true;
  if (name.endsWith('.config.js') || name === 'webpack.config.js') return true;
  return false;
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const keep = readDistKeepSet();
  const removed = [];

  for (const name of fs.readdirSync(root)) {
    if (shouldSkipRootFile(name)) continue;
    if (!BUNDLE_LIKE.test(name) && !NUMBERED_CHUNK.test(name) && !ORPHAN_HEX_CHUNK.test(name)) continue;
    if (keep.has(name)) continue;

    const full = path.join(root, name);
    if (!fs.statSync(full).isFile()) continue;

    if (dryRun) {
      removed.push(name + ' (dry-run)');
    } else {
      fs.unlinkSync(full);
      removed.push(name);
    }
  }

  if (removed.length) {
    console.log(
      `[prune-stale-root-bundles] 已${dryRun ? '将（dry-run）' : ''}移除 ${removed.length} 个根目录过期产物：`,
    );
    removed.forEach((n) => console.log('  -', n));
  } else {
    console.log('[prune-stale-root-bundles] 根目录无匹配的旧 Webpack 哈希文件。');
  }
}

main();
