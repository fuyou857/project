#!/usr/bin/env node
/**
 * 成本发票录入 — 鼠标交互 E2E 自动化
 *
 * 流程：登录 → 打开成本发票录入 → 点击「录入发票」→ 弹窗内点「取消」→
 * 校验弹窗关闭与 body 交互锁释放 → 点击页面其他区域验证可响应。
 *
 * 环境变量（任选其一）：
 *   E2E_EMAIL / E2E_PASSWORD
 *   或 scripts/.e2e-credentials.local（gitignore，格式 KEY=VALUE）
 *
 * 可选：
 *   E2E_BASE_URL（默认 https://www.ciond.com）
 *   E2E_HEADLESS（默认 true）
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'logs', 'e2e-cost-invoice-mouse-report.json');

// 使用项目内已下载的 Chromium（npm run test:e2e:cost-invoice-mouse 前需 install 一次）
if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(ROOT, '.playwright-browsers');
}

function loadDotEnv(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

function loadLocalCreds() {
  const p = path.join(__dirname, '.e2e-credentials.local');
  if (!fs.existsSync(p)) return {};
  return loadDotEnv(p);
}

const envFile = loadDotEnv(path.join(ROOT, '.env'));
const localCreds = loadLocalCreds();

function normalizeLoginEmail(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  if (!trimmed.includes('@')) return `${trimmed}@ciond.com`;
  return trimmed;
}

/** HashRouter：业务路由必须带 # */
function appUrl(routePath) {
  const base = CONFIG.baseUrl;
  const path = routePath.startsWith('/') ? routePath : `/${routePath}`;
  return `${base}/#${path}`;
}

const CONFIG = {
  baseUrl: (process.env.E2E_BASE_URL || 'https://www.ciond.com').replace(/\/$/, ''),
  email: normalizeLoginEmail(process.env.E2E_EMAIL || localCreds.E2E_EMAIL || ''),
  password: process.env.E2E_PASSWORD || localCreds.E2E_PASSWORD || '',
  supabaseUrl: process.env.SUPABASE_URL || envFile.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || envFile.SUPABASE_ANON_KEY || '',
  headless: process.env.E2E_HEADLESS !== 'false',
};

const report = {
  startedAt: new Date().toISOString(),
  baseUrl: CONFIG.baseUrl,
  steps: [],
  anomalies: [],
  passed: false,
  finishedAt: null,
};

function step(name, status, detail = {}) {
  const entry = { name, status, at: new Date().toISOString(), ...detail };
  report.steps.push(entry);
  const icon = status === 'ok' ? '✓' : status === 'warn' ? '!' : '✗';
  console.log(`[${icon}] ${name}${detail.message ? `: ${detail.message}` : ''}`);
  if (status === 'fail' || status === 'warn') {
    report.anomalies.push({ step: name, status, ...detail });
  }
  return entry;
}

async function supabaseSignIn(email, password) {
  const url = `${CONFIG.supabaseUrl}/auth/v1/token?grant_type=password`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: CONFIG.supabaseAnonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error_description || body.msg || body.message || `HTTP ${res.status}`);
  }
  return body;
}

function supabaseStorageKey() {
  try {
    const host = new URL(CONFIG.supabaseUrl).hostname;
    const ref = host.split('.')[0];
    return `sb-${ref}-auth-token`;
  } catch {
    return 'sb-auth-token';
  }
}

function maskEmail(email) {
  return email.replace(/(.{2}).+(@.+)/, '$1***$2');
}

function isLoggedInHash(hash) {
  return (
    hash.includes('/dashboard') ||
    hash.includes('/finance') ||
    hash.includes('/projects') ||
    hash.includes('/base-data')
  );
}

/** 等待 deferred bundle 执行并完成首屏渲染（domcontentloaded 过早） */
async function waitForSpaReady(page) {
  await page.waitForSelector('#root', { state: 'attached', timeout: 60000 });
  await page.waitForFunction(
    () => {
      const root = document.getElementById('root');
      return Boolean(root && root.childElementCount > 0);
    },
    { timeout: 90000 },
  );
}

async function isLoginScreen(page) {
  const hash = await page.evaluate(() => window.location.hash || '');
  if (isLoggedInHash(hash)) return false;
  return (await page.locator('input[type="password"]').count()) > 0;
}

async function loginViaUi(page) {
  page.on('dialog', (dialog) => dialog.accept());

  await page.goto(appUrl('/login'), { waitUntil: 'load', timeout: 90000 });
  await waitForSpaReady(page);

  const hashAfterLoad = await page.evaluate(() => window.location.hash || '');
  if (isLoggedInHash(hashAfterLoad)) return;

  const passwordInput = page.locator('input[type="password"]');
  await passwordInput.waitFor({ state: 'visible', timeout: 60000 });

  const loginInput = CONFIG.email.includes('@') ? CONFIG.email.split('@')[0] : CONFIG.email;
  const userInput = page.locator('input[type="text"]').first();
  await userInput.fill(loginInput);
  await passwordInput.fill(CONFIG.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();

  await page.waitForFunction(
    () => {
      const h = window.location.hash || '';
      return (
        h.includes('/dashboard') ||
        h.includes('/finance') ||
        h.includes('/projects') ||
        h.includes('/base-data')
      );
    },
    { timeout: 60000 },
  );

  if (await isLoginScreen(page)) {
    const errText = await page.locator('.text-red-400').first().textContent().catch(() => '');
    const title = await page.title().catch(() => '');
    throw new Error(
      errText?.trim() || `UI 登录未完成（hash=${await page.evaluate(() => window.location.hash)}, title=${title}）`,
    );
  }
}

async function loginViaSupabase(context, page) {
  const session = await supabaseSignIn(CONFIG.email, CONFIG.password);
  await injectSupabaseSession(context, session);
  await page.goto(appUrl('/finance/cost-invoice'), { waitUntil: 'load', timeout: 90000 });
  await waitForSpaReady(page);
  await page.waitForTimeout(2500);

  if (await isLoginScreen(page)) {
    throw new Error('Supabase 会话注入后仍停留在登录页');
  }
}

async function ensureLoggedIn(context, page) {
  await page.goto(appUrl('/finance/cost-invoice'), { waitUntil: 'load', timeout: 90000 });
  try {
    await waitForSpaReady(page);
  } catch {
    step('spa-boot', 'warn', { message: '首屏渲染等待超时，继续尝试登录' });
  }
  await page.waitForTimeout(1500);

  if (!(await isLoginScreen(page))) {
    step('login', 'ok', { method: 'existing-session', email: maskEmail(CONFIG.email) });
    return;
  }

  try {
    await loginViaSupabase(context, page);
    step('login', 'ok', { method: 'supabase-api', email: maskEmail(CONFIG.email) });
    return;
  } catch (err) {
    step('supabase-login', 'warn', { message: String(err.message || err), fallback: 'ui-login' });
  }

  await loginViaUi(page);
  step('login', 'ok', { method: 'ui-form', email: maskEmail(CONFIG.email) });
}

async function injectSupabaseSession(context, session) {
  const storageKey = supabaseStorageKey();
  const payload = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    expires_at: Math.floor(Date.now() / 1000) + (session.expires_in || 3600),
    token_type: session.token_type || 'bearer',
    user: session.user,
  });
  await context.addInitScript(
    ({ key, value }) => {
      localStorage.setItem(key, value);
    },
    { key: storageKey, value: payload },
  );
}

function findButton(page, labels) {
  return page.locator('button').filter({ hasText: new RegExp(labels.join('|')) }).first();
}

async function readBodyInteractionState(page) {
  return page.evaluate(() => ({
    overflow: document.body.style.overflow || '',
    pointerEvents: document.body.style.pointerEvents || '',
    overlayCount: document.querySelectorAll('[role="presentation"].fixed.inset-0, .fixed.inset-0.z-50').length,
    modalDialogs: document.querySelectorAll('[role="dialog"]').length,
    fileInputs: document.querySelectorAll('input[type="file"]').length,
    activeTag: document.activeElement?.tagName || null,
  }));
}

function finalizeAndExit(code) {
  report.finishedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n报告已写入: ${REPORT_PATH}`);
  console.log(`总体结果: ${report.passed ? '通过' : '未通过'}`);
  process.exit(code);
}

async function run() {
  if (!CONFIG.email || !CONFIG.password) {
    step('credentials', 'fail', {
      message:
        '缺少 E2E_EMAIL / E2E_PASSWORD。请设置环境变量或创建 scripts/.e2e-credentials.local',
    });
    report.passed = false;
    finalizeAndExit(1);
  }

  if (!CONFIG.supabaseUrl || !CONFIG.supabaseAnonKey) {
    step('supabase-config', 'fail', { message: '缺少 SUPABASE_URL / SUPABASE_ANON_KEY（.env）' });
    report.passed = false;
    finalizeAndExit(1);
  }

  let playwright;
  try {
    playwright = await import('playwright');
  } catch {
    step('playwright-import', 'fail', {
      message: '未安装 playwright，请执行: PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers npx playwright install chromium',
    });
    report.passed = false;
    finalizeAndExit(1);
  }

  const { chromium } = playwright;
  let browser;
  let context;
  let page;

  try {
    step('launch-browser', 'ok', { headless: CONFIG.headless });
    const launchOpts = {
      headless: CONFIG.headless,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process'],
    };
    if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
      launchOpts.executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
    }
    browser = await chromium.launch(launchOpts);
    context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      ignoreHTTPSErrors: true,
    });
    page = await context.newPage();

    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    page.on('dialog', (dialog) => dialog.accept());

    try {
      await ensureLoggedIn(context, page);
    } catch (err) {
      step('login', 'fail', { message: String(err.message || err) });
      report.passed = false;
      return;
    }

    if (await isLoginScreen(page)) {
      step('open-cost-invoice-module', 'fail', {
        message: '登录后仍无法进入成本发票录入',
        url: page.url(),
        hash: await page.evaluate(() => window.location.hash),
      });
      report.passed = false;
      return;
    }

    const gotoOpts = { waitUntil: 'load', timeout: 90000 };
    if (!(await page.evaluate(() => window.location.hash.includes('/finance/cost-invoice')))) {
      await page.goto(appUrl('/finance/cost-invoice'), gotoOpts);
      await waitForSpaReady(page).catch(() => null);
      await page.waitForTimeout(1500);
    }

    const title = await page.locator('h3, h1').filter({ hasText: '成本发票录入' }).first();
    await title.waitFor({ state: 'visible', timeout: 20000 });
    step('open-cost-invoice-module', 'ok', { url: page.url() });

    // 「录入发票」/「发票录入」
    const entryBtn = findButton(page, ['录入发票', '发票录入']);
    await entryBtn.waitFor({ state: 'visible', timeout: 10000 });
    const beforeOpen = await readBodyInteractionState(page);

    await entryBtn.click({ delay: 50 });
    // 等待弹窗打开动画 + interactionReady（MODAL_CLICK_THROUGH_GUARD_MS ≈ 480ms）
    await page.waitForTimeout(550);

    const dialog = page.locator('[role="dialog"]').first();
    const dialogVisible = await dialog.isVisible().catch(() => false);
    if (!dialogVisible) {
      step('open-entry-modal', 'fail', { message: '点击录入按钮后未出现 role=dialog 弹窗' });
      report.passed = false;
      return;
    }
    step('open-entry-modal', 'ok');

    // 检测是否误触发文件选择（无法直接读系统对话框，用 file input 焦点/session 间接判断）
    const fileInputFocused = await page.evaluate(() => {
      const el = document.activeElement;
      return el instanceof HTMLInputElement && el.type === 'file';
    });
    if (fileInputFocused) {
      step('file-picker-auto-open', 'warn', {
        message: '弹窗打开后焦点落在 file input 上，可能存在自动唤起文件框风险',
      });
    } else {
      step('file-picker-auto-open', 'ok', { message: '未检测到 file input 抢焦点' });
    }

    // 弹窗内「取消」（优先 aria-label 关闭，其次底部取消）
    page.on('dialog', (d) => d.accept());
    const closeHeader = dialog.getByRole('button', { name: '关闭' });
    const cancelInDialog = dialog.getByRole('button', { name: '取消', exact: true });
    const closeBtn = (await closeHeader.count()) > 0 ? closeHeader.first() : cancelInDialog.first();
    await closeBtn.waitFor({ state: 'visible', timeout: 8000 });
    await closeBtn.click({ delay: 50 });
    await page.locator('[role="dialog"]').first().waitFor({ state: 'hidden', timeout: 8000 }).catch(() => null);
    await page.waitForTimeout(300);

    let dialogAfter = await page.locator('[role="dialog"]').count();
    if (dialogAfter > 0) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      dialogAfter = await page.locator('[role="dialog"]').count();
    }
    const afterClose = await readBodyInteractionState(page);

    if (dialogAfter > 0) {
      step('close-entry-modal-cancel', 'fail', {
        message: `取消后仍有 ${dialogAfter} 个 dialog`,
        body: afterClose,
      });
    } else {
      step('close-entry-modal-cancel', 'ok', { body: afterClose });
    }

    if (afterClose.pointerEvents === 'none' || afterClose.overflow === 'hidden') {
      step('body-interaction-lock-released', 'fail', {
        message: '取消后 body 仍被锁定',
        before: beforeOpen,
        after: afterClose,
      });
    } else {
      step('body-interaction-lock-released', 'ok', { after: afterClose });
    }

    if (afterClose.overlayCount > 0) {
      step('overlay-removed', 'warn', {
        message: `页面仍有 ${afterClose.overlayCount} 个全屏遮罩节点`,
        after: afterClose,
      });
    } else {
      step('overlay-removed', 'ok');
    }

    // 点击页面其他区域：重置筛选按钮
    const resetBtn = page.getByRole('button', { name: '重置' }).first();
    const resetExists = (await resetBtn.count()) > 0;

    if (resetExists) {
      await resetBtn.click({ timeout: 8000 });
      step('click-reset-button', 'ok', { message: '重置按钮可点击' });
    } else {
      await page.locator('main').click({ position: { x: 120, y: 280 } });
      step('click-main-area', 'ok', { message: '主内容区可点击' });
    }

    await page.waitForTimeout(300);
    const afterClick = await readBodyInteractionState(page);

    // 再次点录入并立即取消，验证不会死锁
    await entryBtn.click({ delay: 50 });
    await page.waitForTimeout(350);
    const dialog2 = page.locator('[role="dialog"]').first();
    if (await dialog2.isVisible().catch(() => false)) {
      await dialog2.locator('button').filter({ hasText: /^取消$/ }).first().click();
      await page.waitForTimeout(500);
    }
    const afterSecond = await readBodyInteractionState(page);
    if (afterSecond.pointerEvents === 'none') {
      step('second-open-close-cycle', 'fail', { message: '第二轮开闭后 body 仍锁定', after: afterSecond });
    } else {
      step('second-open-close-cycle', 'ok');
    }

    if (consoleErrors.length) {
      step('browser-console', 'warn', {
        message: `${consoleErrors.length} 条 console.error`,
        samples: consoleErrors.slice(0, 5),
      });
    } else {
      step('browser-console', 'ok');
    }

    const failed = report.steps.some((s) => s.status === 'fail');
    report.passed = !failed;
    report.summary = {
      totalSteps: report.steps.length,
      failed: report.steps.filter((s) => s.status === 'fail').length,
      warnings: report.steps.filter((s) => s.status === 'warn').length,
      finalBody: afterClick,
    };
  } catch (err) {
    step('unhandled-error', 'fail', { message: String(err?.message || err), stack: err?.stack });
    report.passed = false;
  } finally {
    if (browser) await browser.close().catch(() => undefined);
    finalizeAndExit(report.passed ? 0 : 1);
  }
}

run().catch((err) => {
  step('run-crash', 'fail', { message: String(err?.message || err) });
  report.passed = false;
  finalizeAndExit(1);
});
