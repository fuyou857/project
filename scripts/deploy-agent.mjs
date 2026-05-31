#!/usr/bin/env node
/**
 * deploy-agent.mjs — 部署 Webhook 监听服务
 *
 * 这是一个轻量级 HTTP 服务器，用于通过 Webhook 触发自动部署，
 * 替代手工 SSH 登录执行部署命令。
 *
 * 用法:
 *   node scripts/deploy-agent.mjs                    # 启动（默认端口 18900）
 *   DEPLOY_AGENT_PORT=18901 node scripts/deploy-agent.mjs
 *   DEPLOY_AGENT_SECRET=mysecret node scripts/deploy-agent.mjs
 *
 * 触发部署:
 *   curl -X POST http://localhost:18900/deploy \
 *     -H "Authorization: Bearer <SECRET>" \
 *     -H "Content-Type: application/json" \
 *     -d '{"ref":"refs/heads/master"}'
 *
 * 查看状态:
 *   curl http://localhost:18900/status \
 *     -H "Authorization: Bearer <SECRET>"
 *
 * 查看版本列表:
 *   curl http://localhost:18900/versions \
 *     -H "Authorization: Bearer <SECRET>"
 *
 * 回滚:
 *   curl -X POST http://localhost:18900/rollback \
 *     -H "Authorization: Bearer <SECRET>" \
 *     -H "Content-Type: application/json" \
 *     -d '{"version":"prev"}'
 *
 * 健康检查（无需认证）:
 *   curl http://localhost:18900/health
 *
 * 作为 systemd 服务运行:
 *   见 scripts/ciond-deploy-agent.service
 */

import { createServer } from 'node:http';
import { execSync } from 'node:child_process';
import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHmac, timingSafeEqual } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── 配置 ──────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.DEPLOY_AGENT_PORT || '18900', 10);
const SECRET = process.env.DEPLOY_AGENT_SECRET || '';
const LOG_FILE = resolve(ROOT, 'logs', 'deploy-agent.log');

// 如果没有设置密钥，生成一个并提示
const AUTO_SECRET_FILE = resolve(ROOT, '.deploy-agent.secret');
if (!SECRET) {
  if (existsSync(AUTO_SECRET_FILE)) {
    process.env.DEPLOY_AGENT_SECRET = readFileSync(AUTO_SECRET_FILE, 'utf-8').trim();
  } else {
    const { randomBytes } = await import('node:crypto');
    const autoSecret = randomBytes(24).toString('hex');
    process.env.DEPLOY_AGENT_SECRET = autoSecret;
    console.log(`\n  ⚠  未设置 DEPLOY_AGENT_SECRET，自动生成了一个临时密钥（仅本次会话有效）`);
    console.log(`  🔑  密钥: ${autoSecret}\n`);
  }
}

const EFFECTIVE_SECRET = process.env.DEPLOY_AGENT_SECRET;

// ── 日志 ──────────────────────────────────────────────────────────────────
function log(msg, level = 'INFO') {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level}] ${msg}`;
  console.log(line);
  try { appendFileSync(LOG_FILE, line + '\n'); } catch { /* 忽略 */ }
}

function run(cmd) {
  log(`执行: ${cmd}`);
  const output = execSync(cmd, { cwd: ROOT, timeout: 600_000, maxBuffer: 10 * 1024 * 1024 });
  const out = output.toString().trim();
  if (out) log(out);
  return out;
}

// ── 部署状态 ──────────────────────────────────────────────────────────────
const state = {
  running: false,
  lastDeploy: null,
  lastResult: null,
  lastError: null,
};

function parseJSON(body) {
  try { return JSON.parse(body); } catch { return {}; }
}

function auth(req, body) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (token === EFFECTIVE_SECRET) return true;

  const sig256 = req.headers['x-hub-signature-256'];
  if (sig256) {
    const expected = 'sha256=' + createHmac('sha256', EFFECTIVE_SECRET).update(body || '').digest('hex');
    try {
      return timingSafeEqual(Buffer.from(sig256), Buffer.from(expected));
    } catch { return false; }
  }

  return false;
}

function forbidden(res) {
  res.writeHead(403, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: '未授权。请在请求头中添加 Authorization: Bearer <SECRET>' }));
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// ── 收集请求 body ─────────────────────────────────────────────────────────
function collectBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => resolve(body));
  });
}

// ── 异步部署执行 ──────────────────────────────────────────────────────────
async function runDeploy() {
  try {
    try {
      const remotes = execSync('git remote', { cwd: ROOT, encoding: 'utf-8' }).trim();
      if (remotes) {
        log('检测到远程仓库，执行 git pull …');
        run('git pull --ff-only');
      }
    } catch {
      log('未配置远程仓库或 git pull 失败，跳过', 'WARN');
    }

    log('安装依赖 …');
    run('npm ci 2>/dev/null || npm install');

    log('执行部署脚本 …');
    run('bash scripts/deploy-site.sh');

    state.lastResult = 'success';
    state.lastError = null;
    log('部署成功完成');
  } catch (err) {
    state.lastResult = 'failed';
    state.lastError = err.message;
    log(`部署失败: ${err.message}`, 'ERROR');
  } finally {
    state.running = false;
  }
}

async function runRollback(version) {
  try {
    run(`bash scripts/deploy-site.sh --rollback ${version}`);
    state.lastResult = 'rollback';
    state.lastError = null;
    log(`回滚到 ${version} 成功`);
  } catch (err) {
    state.lastResult = 'failed';
    state.lastError = err.message;
    log(`回滚失败: ${err.message}`, 'ERROR');
  } finally {
    state.running = false;
  }
}

// ── 请求路由 ──────────────────────────────────────────────────────────────
const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  // ── 健康检查（无需认证） ─────────────────────────────────────────────
  if (path === '/health' && req.method === 'GET') {
    json(res, 200, {
      status: 'ok',
      time: new Date().toISOString(),
      pid: process.pid,
      state: state.running ? 'deploying' : 'idle',
      lastDeploy: state.lastDeploy,
      lastResult: state.lastResult,
    });
    return;
  }

  // ── 收集请求 body（POST 可能需要用于 HMAC 验证） ─────────────────
  let body = '';
  if (req.method === 'POST' || req.method === 'PUT') {
    body = await collectBody(req);
  }

  // ── 以下路由需要认证 ─────────────────────────────────────────────────
  if (!auth(req, body)) {
    log(`认证失败: ${req.socket.remoteAddress} -> ${req.method} ${path}`, 'WARN');
    forbidden(res);
    return;
  }

  // ── 触发部署 ──────────────────────────────────────────────────────────
  if (path === '/deploy' && req.method === 'POST') {
    if (state.running) {
      json(res, 409, { error: '部署正在进行中', state });
      return;
    }
    const payload = parseJSON(body);
    state.running = true;
    state.lastDeploy = new Date().toISOString();
    json(res, 202, { message: '部署已开始', ref: payload.ref || 'unknown' });
    log(`收到部署请求，ref: ${payload.ref || 'unknown'}`);
    runDeploy();
    return;
  }

  // ── 查看状态 ──────────────────────────────────────────────────────────
  if (path === '/status' && req.method === 'GET') {
    json(res, 200, state);
    return;
  }

  // ── 版本列表 ──────────────────────────────────────────────────────────
  if (path === '/versions' && req.method === 'GET') {
    try {
      const out = execSync('bash scripts/deploy-site.sh --list 2>&1', { cwd: ROOT, encoding: 'utf-8' });
      json(res, 200, { versions: out.trim().split('\n').filter(Boolean) });
    } catch (err) {
      json(res, 500, { error: err.message });
    }
    return;
  }

  // ── 回滚 ──────────────────────────────────────────────────────────────
  if (path === '/rollback' && req.method === 'POST') {
    if (state.running) {
      json(res, 409, { error: '部署正在进行中' });
      return;
    }
    const body = await collectBody(req);
    const payload = parseJSON(body);
    const version = payload.version || 'prev';
    state.running = true;
    json(res, 202, { message: `回滚到 ${version} 已开始` });
    log(`收到回滚请求，目标版本: ${version}`);
    runRollback(version);
    return;
  }

  // ── 404 ───────────────────────────────────────────────────────────────
  json(res, 404, { error: '未知路由', routes: ['/health', '/status', '/versions', '/deploy', '/rollback'] });
});

// ── 启动 ──────────────────────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  ✅ 部署代理已启动`);
  console.log(`  📡  监听: http://127.0.0.1:${PORT}`);
  console.log(`  🔑  密钥: ${EFFECTIVE_SECRET.slice(0, 8)}…${EFFECTIVE_SECRET.slice(-4)}`);
  console.log(`  📝  日志: ${LOG_FILE}`);
  console.log(`  🏠  项目: ${ROOT}`);
  console.log(`\n  触发部署: curl -X POST http://127.0.0.1:${PORT}/deploy \\`);
  console.log(`    -H "Authorization: Bearer ${EFFECTIVE_SECRET}" \\`);
  console.log(`    -H "Content-Type: application/json" -d '{}'`);
  console.log(`  健康检查: curl http://127.0.0.1:${PORT}/health\n`);
  log(`部署代理启动，端口 ${PORT}`);
});

// ── 优雅关闭 ──────────────────────────────────────────────────────────────
function shutdown() {
  log('正在关闭部署代理 …');
  server.close(() => {
    log('部署代理已关闭');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);