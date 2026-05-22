#!/usr/bin/env node
/**
 * 合同管理模块 E2E 自动化测试
 * 
 * 流程：登录 → 打开合同管理 → 查看收入合同列表 → 验证功能正常
 * 
 * 环境变量：
 *   E2E_EMAIL / E2E_PASSWORD
 *   E2E_BASE_URL（默认 https://www.ciond.com）
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'logs', 'e2e-contract-management-report.json');

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

function appUrl(routePath) {
  const base = CONFIG.baseUrl;
  const path = routePath.startsWith('/') ? routePath : `/${routePath}`;
  return `${base}/#${path}`;
}

const CONFIG = {
  baseUrl: (process.env.E2E_BASE_URL || 'https://www.ciond.com').replace(/\/$/, ''),
  email: normalizeLoginEmail(process.env.E2E_EMAIL || localCreds.E2E_EMAIL || ''),
  password: process.env.E2E_PASSWORD || localCreds.E2E_PASSWORD || '',
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

async function run() {
  if (!CONFIG.email || !CONFIG.password) {
    step('credentials', 'fail', { message: '缺少 E2E_EMAIL / E2E_PASSWORD' });
    report.passed = false;
    return;
  }

  let playwright;
  try {
    playwright = await import('playwright');
  } catch {
    step('playwright-import', 'fail', { message: '未安装 playwright' });
    report.passed = false;
    return;
  }

  const { chromium } = playwright;
  let browser;
  let page;

  try {
    step('launch-browser', 'ok', { headless: CONFIG.headless });
    browser = await chromium.launch({
      headless: CONFIG.headless,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

    try {
      await page.goto(appUrl('/login'), { waitUntil: 'load', timeout: 60000 });
      await page.waitForSelector('input[type="password"]', { timeout: 30000 });
      
      await page.locator('input[type="text"]').first().fill(CONFIG.email.split('@')[0]);
      await page.locator('input[type="password"]').fill(CONFIG.password);
      await page.getByRole('button', { name: '登录', exact: true }).click();
      
      await page.waitForFunction(() => window.location.hash.includes('/dashboard'), { timeout: 60000 });
      step('login', 'ok', { method: 'ui-form' });
    } catch (err) {
      step('login', 'fail', { message: String(err) });
      report.passed = false;
      return;
    }

    await page.goto(appUrl('/contract/revenue'), { waitUntil: 'load', timeout: 60000 });
    await page.waitForSelector('h3', { timeout: 20000 });
    step('open-contract-module', 'ok');

    const contractList = page.locator('table tbody tr');
    const count = await contractList.count();
    step('view-revenue-contracts', 'ok', { message: `收入合同列表有 ${count} 条记录` });

    const tabs = page.locator('div[role="tablist"] button');
    const tabCount = await tabs.count();
    if (tabCount > 0) {
      step('contract-tabs-available', 'ok', { message: `发现 ${tabCount} 个合同类型标签` });
      
      const expenseTab = page.getByRole('tab', { name: '支出合同' });
      if (await expenseTab.count() > 0) {
        await expenseTab.click();
        await page.waitForTimeout(500);
        step('switch-to-expense-tab', 'ok');
        
        const expenseCount = await page.locator('table tbody tr').count();
        step('view-expense-contracts', 'ok', { message: `支出合同列表有 ${expenseCount} 条记录` });
      }
    }

    report.passed = !report.steps.some(s => s.status === 'fail');
  } catch (err) {
    step('unhandled-error', 'fail', { message: String(err) });
    report.passed = false;
  } finally {
    if (browser) await browser.close();
    report.finishedAt = new Date().toISOString();
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
    console.log(`\n报告已写入: ${REPORT_PATH}`);
    console.log(`总体结果: ${report.passed ? '通过' : '未通过'}`);
    process.exit(report.passed ? 0 : 1);
  }
}

run().catch(err => {
  step('run-crash', 'fail', { message: String(err) });
  process.exit(1);
});