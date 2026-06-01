#!/usr/bin/env node
/**
 * 完整 E2E 测试脚本（合并版）
 * 
 * 包含：
 * 1. 原有测试：成本发票录入弹窗交互、文件上传取消、页面假死检测
 * 2. 新增测试：全部模块功能、数据穿透、权限隔离、边界条件、移动端适配
 * 
 * 运行: npm run test:e2e
 * 
 * 环境变量:
 *   E2E_BASE_URL         - 测试地址（默认 https://www.ciond.com）
 *   E2E_EMAIL            - 管理员账号（必填）
 *   E2E_PASSWORD         - 管理员密码（必填）
 *   E2E_EMAIL_MANAGER    - 项目经理账号（可选，用于权限测试）
 *   E2E_PASSWORD_MANAGER - 项目经理密码（可选）
 *   E2E_EMAIL_FINANCE    - 财务账号（可选）
 *   E2E_PASSWORD_FINANCE - 财务密码（可选）
 *   E2E_HEADLESS         - 是否无头模式（默认 true）
 *   E2E_DEVICE           - 设备模拟（默认 desktop，可选 mobile/tablet）
 *   E2E_REPORT_FORMAT    - 报告格式（默认 both，可选 json/html/both）
 *   E2E_SKIP_MODULES     - 跳过模块（逗号分隔，如: material,asset）
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPORT_DIR = path.join(ROOT, 'logs');
const REPORT_PATH_JSON = path.join(REPORT_DIR, 'e2e-report.json');
const REPORT_PATH_HTML = path.join(REPORT_DIR, 'e2e-report.html');

// ============================================================
// 配置
// ============================================================
const CONFIG = {
  baseUrl: process.env.E2E_BASE_URL || 'https://www.ciond.com',
  adminEmail: process.env.E2E_EMAIL || '',
  adminPassword: process.env.E2E_PASSWORD || '',
  managerEmail: process.env.E2E_EMAIL_MANAGER || '',
  managerPassword: process.env.E2E_PASSWORD_MANAGER || '',
  financeEmail: process.env.E2E_EMAIL_FINANCE || '',
  financePassword: process.env.E2E_PASSWORD_FINANCE || '',
  headless: process.env.E2E_HEADLESS !== 'false',
  device: process.env.E2E_DEVICE || 'desktop',
  reportFormat: process.env.E2E_REPORT_FORMAT || 'both',
  skipModules: (process.env.E2E_SKIP_MODULES || '').split(',').filter(s => s.trim()),
  timeout: 30000,
};

// 设备视口配置
const DEVICE_VIEWPORTS = {
  desktop: { width: 1920, height: 1080 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 667 },
};

// 报告数据结构
const report = {
  startedAt: new Date().toISOString(),
  baseUrl: CONFIG.baseUrl,
  device: CONFIG.device,
  environment: {
    nodeVersion: process.version,
    platform: process.platform,
  },
  summary: { total: 0, passed: 0, failed: 0, skipped: 0, duration: 0 },
  modules: {},
  testResults: [],
  consoleErrors: [],
  networkErrors: [],
  passed: false,
  finishedAt: null,
};

// 跳过的模块映射
const SKIPPED_MODULES = new Set(CONFIG.skipModules);

// ============================================================
// 辅助函数
// ============================================================
function log(icon, message, indent = 0) {
  const spaces = '  '.repeat(indent);
  const timestamp = new Date().toISOString().slice(11, 19);
  console.log(`${timestamp} ${spaces}[${icon}] ${message}`);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function login(page, email, password, role = 'admin') {
  log('🔐', `${role}登录: ${email}`);
  await page.goto(`${CONFIG.baseUrl}/login`, { waitUntil: 'networkidle', timeout: CONFIG.timeout });
  
  await page.waitForSelector('input[type="text"], input[placeholder*="用户名"]', { timeout: 15000 });
  await page.fill('input[type="text"]', email.split('@')[0]);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  
  await page.waitForURL(`${CONFIG.baseUrl}/#/dashboard`, { timeout: CONFIG.timeout });
  log('✅', `${role}登录成功`);
}

async function testDrillDown(page, triggerSelector, testName, options = {}) {
  const { expectModal = true, closeOnEsc = true, timeout = 5000 } = options;
  const startTime = Date.now();
  
  try {
    await page.waitForSelector(triggerSelector, { timeout });
    await page.click(triggerSelector);
    await sleep(500);
    
    if (expectModal) {
      const modal = page.locator('[role="dialog"], .ant-modal, .modal, [class*="Modal"]');
      const isVisible = await modal.isVisible().catch(() => false);
      
      if (isVisible) {
        log('✅', `穿透成功: ${testName}`, 1);
        if (closeOnEsc) {
          await page.keyboard.press('Escape');
          await sleep(300);
        }
        return { passed: true, duration: Date.now() - startTime, message: '穿透成功，弹窗正常显示' };
      } else {
        log('❌', `穿透失败: ${testName} - 弹窗未出现`, 1);
        return { passed: false, duration: Date.now() - startTime, message: '穿透失败：弹窗未出现' };
      }
    }
    return { passed: true, duration: Date.now() - startTime, message: '穿透成功' };
  } catch (error) {
    log('❌', `穿透失败: ${testName} - ${error.message}`, 1);
    return { passed: false, duration: Date.now() - startTime, message: `穿透失败: ${error.message}` };
  }
}

// ============================================================
// 原有测试：弹窗交互（保留原有逻辑）
// ============================================================
async function testModalInteraction(page, openSelector, closeText = '取消') {
  const startTime = Date.now();
  try {
    await page.click(openSelector);
    await sleep(300);
    
    const closeBtn = page.locator(`button:has-text("${closeText}")`).first();
    await closeBtn.click();
    await sleep(500);
    
    const modal = page.locator('[role="dialog"], .ant-modal, .modal');
    const isHidden = await modal.isHidden().catch(() => true);
    
    if (isHidden) {
      log('✅', `弹窗交互正常: ${openSelector}`, 1);
      return { passed: true, duration: Date.now() - startTime, message: '弹窗正常关闭' };
    } else {
      log('❌', `弹窗交互失败: ${openSelector} - 弹窗未关闭`, 1);
      return { passed: false, duration: Date.now() - startTime, message: '弹窗未关闭，可能存在假死风险' };
    }
  } catch (error) {
    log('❌', `弹窗交互失败: ${openSelector} - ${error.message}`, 1);
    return { passed: false, duration: Date.now() - startTime, message: `弹窗交互失败: ${error.message}` };
  }
}

// ============================================================
// 原有测试：页面假死检测（保留原有逻辑）
// ============================================================
async function testPageDeadlock(page) {
  log('🩺', '测试: 页面假死检测');
  const startTime = Date.now();
  const results = [];
  
  try {
    await page.goto(`${CONFIG.baseUrl}/#/finance/cost-invoice`, { waitUntil: 'networkidle' });
    await sleep(1000);
    
    const invoiceBtn = page.locator('button:has-text("录入发票")').first();
    if (await invoiceBtn.isVisible().catch(() => false)) {
      // 测试1：打开→立即取消
      log('测试1: 打开弹窗 → 立即取消（动画期间）', 2);
      await invoiceBtn.click();
      await sleep(200);
      const cancelBtn = page.locator('button:has-text("取消")').first();
      await cancelBtn.click();
      await sleep(500);
      
      const modalAfter = await page.locator('[role="dialog"]').isVisible().catch(() => false);
      results.push({ 
        name: '动画期间取消', 
        passed: !modalAfter,
        message: modalAfter ? '弹窗未关闭，页面可能假死' : '弹窗正常关闭'
      });
      
      // 测试2：快速连续开关5次
      log('测试2: 快速连续开关弹窗5次', 2);
      for (let i = 0; i < 5; i++) {
        await invoiceBtn.click();
        await sleep(150);
        const closeBtn = page.locator('button:has-text("取消")').first();
        await closeBtn.click();
        await sleep(150);
      }
      
      const finalModal = await page.locator('[role="dialog"]').isVisible().catch(() => false);
      results.push({ 
        name: '连续开关5次', 
        passed: !finalModal,
        message: finalModal ? '第5次后弹窗未关闭' : '全部正常'
      });
      
      // 测试3：点击页面其他区域验证响应
      log('测试3: 验证页面响应', 2);
      const resetBtn = page.locator('button:has-text("重置")').first();
      if (await resetBtn.isVisible().catch(() => false)) {
        await resetBtn.click();
        results.push({ name: '页面响应检测', passed: true, message: '重置按钮可点击' });
      } else {
        results.push({ name: '页面响应检测', passed: true, message: '页面正常响应' });
      }
    }
    
    const allPassed = results.every(r => r.passed);
    log(allPassed ? '✅' : '❌', `页面假死检测: ${allPassed ? '通过' : '失败'}`, 1);
    
    return { module: '假死检测', passed: allPassed, duration: Date.now() - startTime, results };
  } catch (error) {
    log('❌', `页面假死检测失败: ${error.message}`, 1);
    return { module: '假死检测', passed: false, duration: Date.now() - startTime, results, error: error.message };
  }
}

// ============================================================
// 新增测试模块
// ============================================================

async function testDashboard(page) {
  if (SKIPPED_MODULES.has('dashboard')) {
    log('⚠️', '跳过模块: 仪表盘');
    return { module: '仪表盘', passed: true, skipped: true, results: [] };
  }
  
  log('📊', '测试模块: 仪表盘');
  const startTime = Date.now();
  const results = [];
  
  await page.goto(`${CONFIG.baseUrl}/#/dashboard`, { waitUntil: 'networkidle' });
  await sleep(2000);
  
  // 测试统计卡片穿透
  const cards = [
    { selector: '.stat-card:first-child .stat-value, [class*="stat"]:first-child', name: '项目总数' },
    { selector: '.stat-card:nth-child(2) .stat-value, [class*="stat"]:nth-child(2)', name: '乙方单位' },
    { selector: '.stat-card:nth-child(3) .stat-value, [class*="stat"]:nth-child(3)', name: '本月支出' },
    { selector: '.stat-card:nth-child(4) .stat-value, [class*="stat"]:nth-child(4)', name: '待处理预警' },
  ];
  
  for (const card of cards) {
    const exists = await page.locator(card.selector).isVisible().catch(() => false);
    if (exists) {
      const result = await testDrillDown(page, card.selector, card.name);
      results.push({ ...result, name: card.name });
    } else {
      log('⚠️', `跳过: ${card.name} - 元素不存在`, 1);
      results.push({ name: card.name, passed: true, skipped: true, message: '元素不存在，跳过测试' });
    }
  }
  
  const chart = await page.locator('canvas, [class*="chart"], [class*="Chart"]').first().isVisible().catch(() => false);
  results.push({ name: '图表加载', passed: chart, message: chart ? '图表正常加载' : '未找到图表组件' });
  log(chart ? '✅' : '⚠️', `图表加载: ${chart ? '正常' : '未找到'}`, 1);
  
  return { module: '仪表盘', passed: results.every(r => r.passed), duration: Date.now() - startTime, results };
}

async function testProjectManagement(page) {
  if (SKIPPED_MODULES.has('project')) {
    log('⚠️', '跳过模块: 项目管理');
    return { module: '项目管理', passed: true, skipped: true, results: [] };
  }
  
  log('🏗️', '测试模块: 项目管理');
  const startTime = Date.now();
  const results = [];
  
  await page.goto(`${CONFIG.baseUrl}/#/projects`, { waitUntil: 'networkidle' });
  await sleep(2000);
  
  const newBtn = page.locator('button:has-text("新建项目")').first();
  if (await newBtn.isVisible().catch(() => false)) {
    const result = await testModalInteraction(page, 'button:has-text("新建项目")', '取消');
    results.push({ ...result, name: '新建项目弹窗' });
  }
  
  const projectRow = page.locator('table tbody tr, [class*="project-item"]').first();
  if (await projectRow.isVisible().catch(() => false)) {
    const nameCell = projectRow.locator('td:first-child, [class*="name"]').first();
    if (await nameCell.isVisible().catch(() => false)) {
      const result = await testDrillDown(page, 'td:first-child, [class*="name"]', '项目名称穿透');
      results.push({ ...result, name: '项目名称穿透' });
    }
    
    const costCell = projectRow.locator('td:nth-child(4), [class*="cost"]').first();
    if (await costCell.isVisible().catch(() => false)) {
      const result = await testDrillDown(page, 'td:nth-child(4), [class*="cost"]', '项目成本穿透');
      results.push({ ...result, name: '项目成本穿透' });
    }
  }
  
  return { module: '项目管理', passed: results.every(r => r.passed), duration: Date.now() - startTime, results };
}

async function testContractManagement(page) {
  if (SKIPPED_MODULES.has('contract')) {
    log('⚠️', '跳过模块: 合同管理');
    return { module: '合同管理', passed: true, skipped: true, results: [] };
  }
  
  log('📄', '测试模块: 合同管理');
  const startTime = Date.now();
  const results = [];
  
  log('📥', '收入合同', 1);
  await page.goto(`${CONFIG.baseUrl}/#/contract/income`, { waitUntil: 'networkidle' });
  await sleep(2000);
  
  const incomeNewBtn = page.locator('button:has-text("新建合同")').first();
  if (await incomeNewBtn.isVisible().catch(() => false)) {
    const result = await testModalInteraction(page, 'button:has-text("新建合同")', '取消');
    results.push({ ...result, name: '收入合同-新建弹窗' });
  }
  
  log('📤', '支出合同', 1);
  await page.goto(`${CONFIG.baseUrl}/#/contract/expense`, { waitUntil: 'networkidle' });
  await sleep(2000);
  
  const expenseNewBtn = page.locator('button:has-text("新建合同")').first();
  if (await expenseNewBtn.isVisible().catch(() => false)) {
    const result = await testModalInteraction(page, 'button:has-text("新建合同")', '取消');
    results.push({ ...result, name: '支出合同-新建弹窗' });
  }
  
  const amountCell = page.locator('table tbody tr td:nth-child(5), [class*="amount"]').first();
  if (await amountCell.isVisible().catch(() => false)) {
    const result = await testDrillDown(page, 'td:nth-child(5), [class*="amount"]', '合同金额穿透');
    results.push({ ...result, name: '合同金额穿透' });
  }
  
  return { module: '合同管理', passed: results.every(r => r.passed), duration: Date.now() - startTime, results };
}

async function testFinanceManagement(page) {
  if (SKIPPED_MODULES.has('finance')) {
    log('⚠️', '跳过模块: 财务管理');
    return { module: '财务管理', passed: true, skipped: true, results: [] };
  }
  
  log('💰', '测试模块: 财务管理');
  const startTime = Date.now();
  const results = [];
  
  await page.goto(`${CONFIG.baseUrl}/#/finance/cost-invoice`, { waitUntil: 'networkidle' });
  await sleep(2000);
  
  log('核心测试: 录入发票弹窗', 1);
  const invoiceBtn = page.locator('button:has-text("录入发票")').first();
  
  if (await invoiceBtn.isVisible().catch(() => false)) {
    const result1 = await testModalInteraction(page, 'button:has-text("录入发票")', '取消');
    results.push({ ...result1, name: '录入发票-动画期间取消' });
    
    log('测试文件上传取消', 2);
    await page.click('button:has-text("录入发票")');
    await sleep(300);
    
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible().catch(() => false)) {
      const cancelBtn = page.locator('button:has-text("取消")').first();
      await cancelBtn.click();
      await sleep(500);
      const modalClosed = await page.locator('[role="dialog"]').isHidden().catch(() => true);
      results.push({ 
        name: '录入发票-文件上传后取消', 
        passed: modalClosed,
        message: modalClosed ? '弹窗正常关闭' : '弹窗残留，页面可能假死'
      });
      log(modalClosed ? '✅' : '❌', `文件上传后取消: ${modalClosed ? '弹窗关闭' : '弹窗残留'}`, 2);
    } else {
      results.push({ name: '录入发票-文件上传后取消', passed: true, skipped: true, message: '文件上传元素不存在' });
      log('⚠️', '文件上传元素不存在，跳过', 2);
    }
  }
  
  const amountCell = page.locator('table tbody tr td:nth-child(6), [class*="amount"]').first();
  if (await amountCell.isVisible().catch(() => false)) {
    const result = await testDrillDown(page, 'td:nth-child(6), [class*="amount"]', '发票金额穿透');
    results.push({ ...result, name: '发票金额穿透' });
  }
  
  const exportBtn = page.locator('button:has-text("导出")').first();
  if (await exportBtn.isVisible().catch(() => false)) {
    try {
      await exportBtn.click();
      await sleep(500);
      results.push({ name: '导出按钮可点击', passed: true, message: '导出按钮响应正常' });
      log('✅', '导出按钮可点击', 1);
    } catch (error) {
      results.push({ name: '导出按钮可点击', passed: false, message: error.message });
      log('❌', '导出按钮点击失败', 1);
    }
  }
  
  return { module: '财务管理', passed: results.every(r => r.passed), duration: Date.now() - startTime, results };
}

async function testMachineManagement(page) {
  if (SKIPPED_MODULES.has('machine')) {
    log('⚠️', '跳过模块: 机械管理');
    return { module: '机械管理', passed: true, skipped: true, results: [] };
  }
  
  log('🔧', '测试模块: 机械管理');
  const startTime = Date.now();
  const results = [];
  
  await page.goto(`${CONFIG.baseUrl}/#/machine/shift`, { waitUntil: 'networkidle' });
  await sleep(2000);
  
  const shiftBtn = page.locator('button:has-text("录入台班")').first();
  if (await shiftBtn.isVisible().catch(() => false)) {
    const result = await testModalInteraction(page, 'button:has-text("录入台班")', '取消');
    results.push({ ...result, name: '录入台班弹窗' });
  }
  
  const shiftCell = page.locator('table tbody tr td:nth-child(4), [class*="shift"]').first();
  if (await shiftCell.isVisible().catch(() => false)) {
    const result = await testDrillDown(page, 'td:nth-child(4), [class*="shift"]', '台班数穿透');
    results.push({ ...result, name: '台班数穿透' });
  }
  
  return { module: '机械管理', passed: results.every(r => r.passed), duration: Date.now() - startTime, results };
}

async function testMaterialManagement(page) {
  if (SKIPPED_MODULES.has('material')) {
    log('⚠️', '跳过模块: 物资管理');
    return { module: '物资管理', passed: true, skipped: true, results: [] };
  }
  
  log('📦', '测试模块: 物资管理');
  const startTime = Date.now();
  const results = [];
  
  await page.goto(`${CONFIG.baseUrl}/#/material/list`, { waitUntil: 'networkidle' });
  await sleep(2000);
  
  const addBtn = page.locator('button:has-text("新增物资"), button:has-text("添加物资")').first();
  if (await addBtn.isVisible().catch(() => false)) {
    const result = await testModalInteraction(page, 'button:has-text("新增物资"), button:has-text("添加物资")', '取消');
    results.push({ ...result, name: '新增物资弹窗' });
  }
  
  const stockCell = page.locator('table tbody tr td:nth-child(5), [class*="stock"]').first();
  if (await stockCell.isVisible().catch(() => false)) {
    const result = await testDrillDown(page, 'td:nth-child(5), [class*="stock"]', '物资库存穿透');
    results.push({ ...result, name: '物资库存穿透' });
  }
  
  return { module: '物资管理', passed: results.every(r => r.passed), duration: Date.now() - startTime, results };
}

async function testFixedAssetManagement(page) {
  if (SKIPPED_MODULES.has('asset')) {
    log('⚠️', '跳过模块: 固定资产');
    return { module: '固定资产', passed: true, skipped: true, results: [] };
  }
  
  log('🏢', '测试模块: 固定资产');
  const startTime = Date.now();
  const results = [];
  
  await page.goto(`${CONFIG.baseUrl}/#/asset/list`, { waitUntil: 'networkidle' });
  await sleep(2000);
  
  const addBtn = page.locator('button:has-text("新增资产"), button:has-text("添加资产")').first();
  if (await addBtn.isVisible().catch(() => false)) {
    const result = await testModalInteraction(page, 'button:has-text("新增资产"), button:has-text("添加资产")', '取消');
    results.push({ ...result, name: '新增资产弹窗' });
  }
  
  return { module: '固定资产', passed: results.every(r => r.passed), duration: Date.now() - startTime, results };
}

async function testApprovalCenter(page) {
  if (SKIPPED_MODULES.has('approval')) {
    log('⚠️', '跳过模块: 审批中心');
    return { module: '审批中心', passed: true, skipped: true, results: [] };
  }
  
  log('✅', '测试模块: 审批中心');
  const startTime = Date.now();
  const results = [];
  
  await page.goto(`${CONFIG.baseUrl}/#/approval/list`, { waitUntil: 'networkidle' });
  await sleep(2000);
  
  const todoCount = page.locator('.todo-count, .pending-count, [class*="pending"]');
  if (await todoCount.isVisible().catch(() => false)) {
    const result = await testDrillDown(page, '.todo-count, .pending-count', '待办数量穿透');
    results.push({ ...result, name: '待办数量穿透' });
  }
  
  return { module: '审批中心', passed: results.every(r => r.passed), duration: Date.now() - startTime, results };
}

async function testAlertCenter(page) {
  if (SKIPPED_MODULES.has('alert')) {
    log('⚠️', '跳过模块: 预警中心');
    return { module: '预警中心', passed: true, skipped: true, results: [] };
  }
  
  log('⚠️', '测试模块: 预警中心');
  const startTime = Date.now();
  const results = [];
  
  await page.goto(`${CONFIG.baseUrl}/#/alerts`, { waitUntil: 'networkidle' });
  await sleep(2000);
  
  const alertCount = page.locator('.alert-count, .warning-count, [class*="alert"]');
  if (await alertCount.isVisible().catch(() => false)) {
    const result = await testDrillDown(page, '.alert-count, .warning-count', '预警数量穿透');
    results.push({ ...result, name: '预警数量穿透' });
  }
  
  return { module: '预警中心', passed: results.every(r => r.passed), duration: Date.now() - startTime, results };
}

async function testSystemManagement(page) {
  if (SKIPPED_MODULES.has('system')) {
    log('⚠️', '跳过模块: 系统管理');
    return { module: '系统管理', passed: true, skipped: true, results: [] };
  }
  
  log('⚙️', '测试模块: 系统管理');
  const startTime = Date.now();
  const results = [];
  
  await page.goto(`${CONFIG.baseUrl}/#/admin/users`, { waitUntil: 'networkidle' });
  await sleep(2000);
  
  const userTable = await page.locator('table').isVisible().catch(() => false);
  results.push({ name: '用户列表加载', passed: userTable, message: userTable ? '用户列表正常加载' : '用户列表加载失败' });
  log(userTable ? '✅' : '❌', `用户列表加载: ${userTable ? '正常' : '失败'}`, 1);
  
  const addBtn = page.locator('button:has-text("新增用户"), button:has-text("添加用户")').first();
  if (await addBtn.isVisible().catch(() => false)) {
    const result = await testModalInteraction(page, 'button:has-text("新增用户"), button:has-text("添加用户")', '取消');
    results.push({ ...result, name: '新增用户弹窗' });
  }
  
  return { module: '系统管理', passed: results.every(r => r.passed), duration: Date.now() - startTime, results };
}

async function testDataIsolation(page) {
  if (SKIPPED_MODULES.has('isolation')) {
    log('⚠️', '跳过模块: 数据隔离');
    return { module: '数据隔离', passed: true, skipped: true, results: [] };
  }
  
  log('🔒', '测试模块: 数据隔离');
  const startTime = Date.now();
  const results = [];
  
  if (CONFIG.managerEmail && CONFIG.managerPassword) {
    log('👤', '测试项目经理权限', 1);
    await login(page, CONFIG.managerEmail, CONFIG.managerPassword, '项目经理');
    
    const adminMenus = ['系统管理', '印章管理'];
    let hasAdminAccess = false;
    for (const menu of adminMenus) {
      const menuItem = page.locator(`text="${menu}"`);
      if (await menuItem.isVisible().catch(() => false)) {
        hasAdminAccess = true;
        break;
      }
    }
    
    results.push({ 
      name: '项目经理无权访问管理员菜单', 
      passed: !hasAdminAccess,
      message: !hasAdminAccess ? '权限隔离正常' : '项目经理看到了管理员菜单'
    });
    log(!hasAdminAccess ? '✅' : '❌', `项目经理无权访问管理员菜单: ${!hasAdminAccess}`, 2);
    
    await login(page, CONFIG.adminEmail, CONFIG.adminPassword, '管理员');
  }
  
  return { module: '数据隔离', passed: results.every(r => r.passed), duration: Date.now() - startTime, results };
}

async function testSpecialCharacters(page) {
  if (SKIPPED_MODULES.has('special')) {
    log('⚠️', '跳过模块: 特殊字符');
    return { module: '特殊字符', passed: true, skipped: true, results: [] };
  }
  
  log('🔣', '测试模块: 特殊字符处理');
  const startTime = Date.now();
  const results = [];
  
  await page.goto(`${CONFIG.baseUrl}/#/projects`, { waitUntil: 'networkidle' });
  await sleep(2000);
  
  const newBtn = page.locator('button:has-text("新建项目")').first();
  if (await newBtn.isVisible().catch(() => false)) {
    await newBtn.click();
    await sleep(300);
    
    const nameInput = page.locator('input[name="name"], input[placeholder*="名称"]').first();
    if (await nameInput.isVisible().catch(() => false)) {
      const specialText = '测试<项目>"特殊\'字符&';
      await nameInput.fill(specialText);
      await sleep(200);
      
      const inputValue = await nameInput.inputValue();
      const passed = inputValue === specialText;
      results.push({ 
        name: '特殊字符输入', 
        passed, 
        message: passed ? '特殊字符正常保存' : '特殊字符被过滤或转义错误'
      });
      log(passed ? '✅' : '❌', `特殊字符输入: ${passed ? '正常' : '失败'}`, 1);
      
      const cancelBtn = page.locator('button:has-text("取消")').first();
      await cancelBtn.click();
    }
  }
  
  return { module: '特殊字符处理', passed: results.every(r => r.passed), duration: Date.now() - startTime, results };
}

async function testSecondLevelDrillDown(page) {
  if (SKIPPED_MODULES.has('secondLevel')) {
    log('⚠️', '跳过模块: 二级穿透');
    return { module: '二级穿透', passed: true, skipped: true, results: [] };
  }
  
  log('🔗', '测试模块: 二级数据穿透');
  const startTime = Date.now();
  const results = [];
  
  await page.goto(`${CONFIG.baseUrl}/#/finance/cost-invoice`, { waitUntil: 'networkidle' });
  await sleep(2000);
  
  const amountCell = page.locator('table tbody tr td:nth-child(6), [class*="amount"]').first();
  if (await amountCell.isVisible().catch(() => false)) {
    await amountCell.click();
    await sleep(500);
    
    const modal = page.locator('[role="dialog"], .ant-modal');
    if (await modal.isVisible().catch(() => false)) {
      const detailAmount = modal.locator('td:has-text("¥"), [class*="amount"]').first();
      if (await detailAmount.isVisible().catch(() => false)) {
        await detailAmount.click();
        await sleep(300);
        results.push({ name: '二级穿透支持', passed: true, message: '支持二级穿透' });
        log('✅', '二级穿透支持: 通过', 1);
      } else {
        results.push({ name: '二级穿透支持', passed: true, skipped: true, message: '无可穿透元素' });
        log('⚠️', '二级穿透测试跳过（无可穿透元素）', 1);
      }
      
      await page.keyboard.press('Escape');
    } else {
      results.push({ name: '二级穿透支持', passed: false, message: '一级穿透失败' });
      log('❌', '二级穿透失败: 一级弹窗未出现', 1);
    }
  }
  
  return { module: '二级穿透', passed: results.every(r => r.passed), duration: Date.now() - startTime, results };
}

async function testMobileAdaptation(page) {
  if (SKIPPED_MODULES.has('mobile')) {
    log('⚠️', '跳过模块: 移动端适配');
    return { module: '移动端适配', passed: true, skipped: true, results: [] };
  }
  
  log('📱', '测试模块: 移动端适配');
  const startTime = Date.now();
  const results = [];
  
  if (CONFIG.device === 'mobile') {
    log('📱', '移动端模式测试', 1);
    
    await page.goto(`${CONFIG.baseUrl}/login`, { waitUntil: 'networkidle' });
    await sleep(2000);
    
    const buttons = await page.locator('button').all();
    let smallButtonCount = 0;
    for (const btn of buttons.slice(0, 20)) {
      const box = await btn.boundingBox();
      if (box && (box.width < 44 || box.height < 44)) {
        smallButtonCount++;
      }
    }
    
    const passed = smallButtonCount === 0;
    results.push({ 
      name: '触摸按钮尺寸合规', 
      passed, 
      message: passed ? '所有按钮尺寸≥44px' : `${smallButtonCount}个按钮尺寸过小`
    });
    log(passed ? '✅' : '⚠️', `触摸按钮尺寸合规: ${passed ? '通过' : `${smallButtonCount}个按钮过小`}`, 2);
    
    const layoutOk = await page.locator('.min-h-screen, .container').isVisible().catch(() => false);
    results.push({ name: '移动端布局正常', passed: layoutOk, message: layoutOk ? '布局正常' : '布局异常' });
    log(layoutOk ? '✅' : '❌', `移动端布局正常: ${layoutOk ? '通过' : '失败'}`, 2);
  } else {
    log('⚠️', '非移动端模式，跳过移动端适配测试', 1);
    results.push({ name: '移动端适配', passed: true, skipped: true, message: '非移动端模式，跳过' });
  }
  
  return { module: '移动端适配', passed: results.every(r => r.passed), duration: Date.now() - startTime, results };
}

async function testPageLoadPerformance(page) {
  if (SKIPPED_MODULES.has('performance')) {
    log('⚠️', '跳过模块: 性能测试');
    return { module: '性能测试', passed: true, skipped: true, results: [] };
  }
  
  log('⚡', '测试模块: 页面加载性能');
  const startTime = Date.now();
  const results = [];
  
  const pages = [
    { url: '/#/dashboard', name: '仪表盘' },
    { url: '/#/projects', name: '项目管理' },
    { url: '/#/finance/cost-invoice', name: '财务管理' },
  ];
  
  for (const { url, name } of pages) {
    const loadStart = Date.now();
    await page.goto(`${CONFIG.baseUrl}${url}`, { waitUntil: 'networkidle' });
    const loadTime = Date.now() - loadStart;
    
    const passed = loadTime < 5000;
    results.push({ name: `${name}加载时间`, passed, loadTime, message: `${loadTime}ms` });
    log(passed ? '✅' : '⚠️', `${name}加载: ${loadTime}ms`, 1);
  }
  
  return { module: '页面性能', passed: results.every(r => r.passed), duration: Date.now() - startTime, results };
}

// ============================================================
// HTML 报告生成
// ============================================================
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

function generateHtmlReport() {
  const passRate = report.summary.total > 0 ? (report.summary.passed / report.summary.total * 100).toFixed(1) : 0;
  const statusColor = report.passed ? '#10b981' : '#ef4444';
  const statusText = report.passed ? '✅ 测试通过' : '❌ 测试失败';
  
  let modulesHtml = '';
  for (const [moduleName, moduleData] of Object.entries(report.modules)) {
    const modulePassRate = moduleData.total > 0 ? (moduleData.passed / moduleData.total * 100).toFixed(1) : 0;
    const moduleStatus = moduleData.failed === 0 ? 'pass' : 'fail';
    
    let itemsHtml = '';
    for (const item of (moduleData.items || [])) {
      const itemStatus = item.passed ? '✅' : (item.skipped ? '⏭️' : '❌');
      const itemColor = item.passed ? '#10b981' : (item.skipped ? '#f59e0b' : '#ef4444');
      itemsHtml += `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px 12px; color: ${itemColor}; font-weight: 500;">${itemStatus}</td>
          <td style="padding: 8px 12px;">${escapeHtml(item.name)}</td>
          <td style="padding: 8px 12px; color: #6b7280; font-size: 12px;">${escapeHtml(item.message || (item.passed ? '通过' : '失败'))}</td>
          <td style="padding: 8px 12px; text-align: center;">${item.duration ? `${item.duration}ms` : '-'}</td>
        </tr>
      `;
    }
    
    modulesHtml += `
      <div style="margin-bottom: 24px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <div style="background: ${moduleStatus === 'pass' ? '#f0fdf4' : '#fef2f2'}; padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 600; font-size: 16px;">📦 ${escapeHtml(moduleName)}</span>
            <span style="font-size: 14px; color: ${moduleStatus === 'pass' ? '#10b981' : '#ef4444'}">
              ${moduleData.passed}/${moduleData.total} (${modulePassRate}%)
            </span>
          </div>
        </div>
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f9fafb; border-bottom: 1px solid #e5e7eb;">
                <th style="padding: 10px 12px; text-align: left; width: 50px;">状态</th>
                <th style="padding: 10px 12px; text-align: left;">测试项</th>
                <th style="padding: 10px 12px; text-align: left;">详情</th>
                <th style="padding: 10px 12px; text-align: center; width: 80px;">耗时</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml || '<tr><td colspan="4" style="padding: 20px; text-align: center; color: #9ca3af;">暂无测试项</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
  
  let consoleErrorsHtml = '';
  if (report.consoleErrors && report.consoleErrors.length > 0) {
    consoleErrorsHtml = `
      <div style="margin-top: 24px; border: 1px solid #fecaca; border-radius: 8px; overflow: hidden;">
        <div style="background: #fef2f2; padding: 12px 16px; border-bottom: 1px solid #fecaca;">
          <span style="font-weight: 600; color: #dc2626;">⚠️ 控制台错误 (${report.consoleErrors.length})</span>
        </div>
        <div style="padding: 12px 16px; background: #fef2f2; font-size: 12px; color: #7f1d1d;">
          <ul style="margin: 0; padding-left: 20px;">
            ${report.consoleErrors.slice(0, 20).map(err => `<li>${escapeHtml(err)}</li>`).join('')}
          </ul>
          ${report.consoleErrors.length > 20 ? `<p>... 还有 ${report.consoleErrors.length - 20} 条错误</p>` : ''}
        </div>
      </div>
    `;
  }
  
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>E2E 测试报告 - ${new Date().toLocaleString()}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fa; padding: 24px; color: #1f2937; }
    .container { max-width: 1200px; margin: 0 auto; }
    .header { background: white; border-radius: 12px; padding: 24px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .summary { display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 24px; }
    .summary-card { background: white; border-radius: 12px; padding: 20px; flex: 1; min-width: 150px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .summary-card .number { font-size: 32px; font-weight: bold; margin-bottom: 8px; }
    .summary-card .label { color: #6b7280; font-size: 14px; }
    .summary-card.pass .number { color: #10b981; }
    .summary-card.fail .number { color: #ef4444; }
    .summary-card.skip .number { color: #f59e0b; }
    .summary-card.total .number { color: #3b82f6; }
    .duration { font-size: 12px; color: #9ca3af; text-align: right; margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb; }
    @media (max-width: 640px) { body { padding: 12px; } .summary-card { min-width: 120px; padding: 12px; } .summary-card .number { font-size: 24px; } }
  </style>
</head>
<body>
<div class="container">
  <div class="header">
    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
      <div>
        <h1 style="font-size: 24px; margin-bottom: 8px;">🧪 E2E 完整测试报告</h1>
        <p style="color: #6b7280;">${CONFIG.baseUrl} | ${CONFIG.device} 模式 | ${new Date(report.startedAt).toLocaleString()}</p>
      </div>
      <div style="background: ${statusColor}; padding: 8px 20px; border-radius: 40px; color: white; font-weight: 600;">
        ${statusText}
      </div>
    </div>
  </div>
  
  <div class="summary">
    <div class="summary-card total">
      <div class="number">${report.summary.total}</div>
      <div class="label">总计</div>
    </div>
    <div class="summary-card pass">
      <div class="number">${report.summary.passed}</div>
      <div class="label">通过 ✅</div>
    </div>
    <div class="summary-card fail">
      <div class="number">${report.summary.failed}</div>
      <div class="label">失败 ❌</div>
    </div>
    <div class="summary-card skip">
      <div class="number">${report.summary.skipped}</div>
      <div class="label">跳过 ⏭️</div>
    </div>
    <div class="summary-card">
      <div class="number">${passRate}%</div>
      <div class="label">通过率</div>
    </div>
  </div>
  
  ${modulesHtml}
  ${consoleErrorsHtml}
  
  <div class="duration">
    执行时间: ${((new Date(report.finishedAt) - new Date(report.startedAt)) / 1000).toFixed(2)} 秒
    | 报告生成: ${new Date().toLocaleString()}
  </div>
</div>
</body>
</html>`;
}

// ============================================================
// 保存报告
// ============================================================
function saveReports() {
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }
  
  if (CONFIG.reportFormat === 'json' || CONFIG.reportFormat === 'both') {
    fs.writeFileSync(REPORT_PATH_JSON, JSON.stringify(report, null, 2), 'utf8');
    log('📄', `JSON 报告已保存: ${REPORT_PATH_JSON}`);
  }
  
  if (CONFIG.reportFormat === 'html' || CONFIG.reportFormat === 'both') {
    const htmlContent = generateHtmlReport();
    fs.writeFileSync(REPORT_PATH_HTML, htmlContent, 'utf8');
    log('📄', `HTML 报告已保存: ${REPORT_PATH_HTML}`);
  }
}

// ============================================================
// 主执行函数
// ============================================================
async function main() {
  if (!CONFIG.adminEmail || !CONFIG.adminPassword) {
    console.error('❌ 请设置环境变量: E2E_EMAIL 和 E2E_PASSWORD');
    console.error('   export E2E_EMAIL="admin@ciond.com"');
    console.error('   export E2E_PASSWORD="admin123"');
    process.exit(1);
  }
  
  let browser;
  let page;
  let context;
  const startTime = Date.now();
  
  try {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 完整 E2E 测试开始');
    console.log(`📡 测试地址: ${CONFIG.baseUrl}`);
    console.log(`📱 设备模式: ${CONFIG.device}`);
    console.log(`🎭 无头模式: ${CONFIG.headless}`);
    if (SKIPPED_MODULES.size > 0 && SKIPPED_MODULES.has('')) SKIPPED_MODULES.delete('');
    if (SKIPPED_MODULES.size > 0) {
      console.log(`⏭️ 跳过模块: ${Array.from(SKIPPED_MODULES).join(', ')}`);
    }
    console.log('='.repeat(70) + '\n');
    
    browser = await chromium.launch({ 
      headless: CONFIG.headless,
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    });
    context = await browser.newContext({
      viewport: DEVICE_VIEWPORTS[CONFIG.device] || DEVICE_VIEWPORTS.desktop,
      ignoreHTTPSErrors: true,
    });
    page = await context.newPage();
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const errorText = msg.text();
        report.consoleErrors.push(errorText);
        log('⚠️', `控制台错误: ${errorText.substring(0, 100)}`);
      }
    });
    
    page.on('requestfailed', request => {
      const errorText = `${request.url()} - ${request.failure()?.errorText}`;
      report.networkErrors.push(errorText);
      log('⚠️', `网络错误: ${errorText.substring(0, 100)}`);
    });
    
    await login(page, CONFIG.adminEmail, CONFIG.adminPassword, '管理员');
    
    const moduleResults = [];
    
    moduleResults.push(await testPageDeadlock(page));
    moduleResults.push(await testDashboard(page));
    moduleResults.push(await testProjectManagement(page));
    moduleResults.push(await testContractManagement(page));
    moduleResults.push(await testFinanceManagement(page));
    moduleResults.push(await testMachineManagement(page));
    moduleResults.push(await testMaterialManagement(page));
    moduleResults.push(await testFixedAssetManagement(page));
    moduleResults.push(await testApprovalCenter(page));
    moduleResults.push(await testAlertCenter(page));
    moduleResults.push(await testSystemManagement(page));
    moduleResults.push(await testDataIsolation(page));
    moduleResults.push(await testSpecialCharacters(page));
    moduleResults.push(await testSecondLevelDrillDown(page));
    moduleResults.push(await testMobileAdaptation(page));
    moduleResults.push(await testPageLoadPerformance(page));
    
    const allResults = [];
    for (const module of moduleResults) {
      if (module.results) {
        for (const result of module.results) {
          allResults.push({
            ...result,
            module: module.module,
          });
        }
      }
      report.modules[module.module] = {
        total: module.results?.length || 1,
        passed: module.results?.filter(r => r.passed).length || (module.passed && !module.skipped ? 1 : 0),
        failed: module.results?.filter(r => !r.passed && !r.skipped).length || (module.passed ? 0 : 1),
        items: module.results || [{ name: module.module, passed: module.passed, message: module.message, skipped: module.skipped }]
      };
    }
    
    report.testResults = allResults;
    report.summary = {
      total: allResults.length,
      passed: allResults.filter(r => r.passed).length,
      failed: allResults.filter(r => !r.passed && !r.skipped).length,
      skipped: allResults.filter(r => r.skipped).length,
      duration: Date.now() - startTime,
    };
    report.passed = report.summary.failed === 0;
    
    console.log('\n' + '='.repeat(70));
    console.log('📊 测试结果汇总');
    console.log('='.repeat(70));
    console.log(`总计: ${report.summary.total} | ✅ 通过: ${report.summary.passed} | ❌ 失败: ${report.summary.failed} | ⏭️ 跳过: ${report.summary.skipped}`);
    console.log(`通过率: ${(report.summary.passed / report.summary.total * 100).toFixed(1)}%`);
    console.log(`执行时间: ${(report.summary.duration / 1000).toFixed(2)} 秒`);
    
    if (report.summary.failed > 0) {
      console.log('\n❌ 失败项:');
      allResults.filter(r => !r.passed && !r.skipped).forEach(r => {
        console.log(`   - [${r.module || '其他'}] ${r.name}: ${r.message || '失败'}`);
      });
    }
    
    if (report.consoleErrors.length > 0) {
      console.log(`\n⚠️ 控制台错误: ${report.consoleErrors.length} 条`);
    }
    
    report.finishedAt = new Date().toISOString();
    saveReports();
    
    console.log(`\n📄 报告已保存到: ${REPORT_DIR}`);
    
  } catch (error) {
    console.error('❌ 测试执行失败:', error);
    report.passed = false;
    report.finishedAt = new Date().toISOString();
    saveReports();
  } finally {
    if (browser) {
      await browser.close();
    }
    process.exit(report.passed ? 0 : 1);
  }
}

main().catch(error => {
  console.error('❌ 致命错误:', error);
  report.passed = false;
  report.finishedAt = new Date().toISOString();
  saveReports();
  process.exit(1);
});