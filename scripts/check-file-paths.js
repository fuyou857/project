/**
 * 代码检查脚本：验证系统中所有涉及模板文件引用、路径处理的代码
 * 
 * 功能：
 * 1. 扫描所有 TypeScript/JavaScript 文件
 * 2. 识别涉及文件路径处理的代码
 * 3. 检查是否存在潜在的路径错误风险
 * 4. 生成详细的检查报告
 * 
 * 使用方法：
 *   node scripts/check-file-paths.js
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = './src';

// 需要检查的路径相关模式
const pathPatterns = [
  { name: '模板存储路径', pattern: /template_file_versions|storage_path|original_filename/g },
  { name: '生成合同路径', pattern: /generated_contracts|generated_docx_storage_path|merged_pdf_storage_path|sealed_pdf_storage_path/g },
  { name: '文件上传', pattern: /uploadFileToStorage|uploadBytesToStorage|storage\.upload/g },
  { name: '文件下载', pattern: /storage\.download|downloadFileFromStorage/g },
  { name: 'URL生成', pattern: /publicUrlForStoragePath|signedUrlForContractStoragePath|preferSignedStorageUrl/g },
  { name: '路径验证', pattern: /startsWith.*contract-templates|startsWith.*contract-generated/g },
];

// 需要检查的文件名相关模式
const filenamePatterns = [
  { name: '文件名处理', pattern: /file\.name/g },
  { name: '路径拼接', pattern: /`.*\/.*`/g },
  { name: '路径连接', pattern: /path\.join|\/{1,2}/g },
];

/**
 * 读取文件内容
 */
function readFileContent(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.error(`读取文件失败: ${filePath}`, error.message);
    return null;
  }
}

/**
 * 扫描目录获取所有 TypeScript/JavaScript 文件
 */
function scanDirectory(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git') {
        scanDirectory(filePath, fileList);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

/**
 * 检查单个文件
 */
function checkFile(filePath, content) {
  const findings = [];
  
  // 检查路径相关模式
  pathPatterns.forEach(({ name, pattern }) => {
    if (pattern.test(content)) {
      const matches = content.match(pattern);
      findings.push({
        type: '路径处理',
        category: name,
        matches: matches ? [...new Set(matches)].slice(0, 5) : [],
        count: matches ? matches.length : 0
      });
    }
  });
  
  // 检查文件名相关模式
  filenamePatterns.forEach(({ name, pattern }) => {
    if (pattern.test(content)) {
      const matches = content.match(pattern);
      findings.push({
        type: '文件名处理',
        category: name,
        matches: matches ? [...new Set(matches)].slice(0, 5) : [],
        count: matches ? matches.length : 0
      });
    }
  });
  
  // 检查是否使用了原始文件名作为存储路径（潜在风险）
  const directFilenameUsage = /storage.*file\.name|file\.name.*storage|\/\$\{file\.name\}/g;
  if (directFilenameUsage.test(content)) {
    findings.push({
      type: '风险警告',
      category: '直接使用原始文件名',
      matches: ['可能直接使用了原始文件名作为存储路径'],
      count: 1,
      risk: 'high'
    });
  }
  
  // 检查是否包含中文文件名（遗留问题检查）
  const chinesePattern = /[\u4e00-\u9fa5]/g;
  if (chinesePattern.test(content)) {
    // 排除注释和字符串字面量之外的内容
    // 简单检查：如果包含中文，可能是字符串
    findings.push({
      type: '潜在问题',
      category: '代码中包含中文字符',
      matches: ['文件中包含中文字符'],
      count: (content.match(chinesePattern) || []).length,
      risk: 'medium'
    });
  }
  
  return findings;
}

/**
 * 生成检查报告
 */
function generateReport(results) {
  console.log('='.repeat(80));
  console.log('代码路径处理检查报告');
  console.log('='.repeat(80));
  console.log(`\n检查时间: ${new Date().toISOString()}`);
  console.log(`检查文件数: ${results.length}\n`);
  
  // 统计各类发现
  const summary = {
    pathProcessing: 0,
    filenameProcessing: 0,
    risks: 0,
    potentialIssues: 0
  };
  
  results.forEach(result => {
    result.findings.forEach(finding => {
      if (finding.type === '路径处理') summary.pathProcessing++;
      if (finding.type === '文件名处理') summary.filenameProcessing++;
      if (finding.type === '风险警告') summary.risks++;
      if (finding.type === '潜在问题') summary.potentialIssues++;
    });
  });
  
  console.log('📊 统计摘要:');
  console.log('────────────────────────────────────────────────────────────────');
  console.log(`   路径处理代码: ${summary.pathProcessing}`);
  console.log(`   文件名处理代码: ${summary.filenameProcessing}`);
  console.log(`   高风险代码: ${summary.risks}`);
  console.log(`   潜在问题: ${summary.potentialIssues}`);
  console.log('');
  
  // 列出高风险文件
  const highRiskFiles = results.filter(r => r.findings.some(f => f.risk === 'high'));
  
  if (highRiskFiles.length > 0) {
    console.log('⚠️  高风险文件列表:');
    console.log('────────────────────────────────────────────────────────────────');
    highRiskFiles.forEach(result => {
      console.log(`\n📄 ${result.relativePath}`);
      result.findings.forEach(finding => {
        if (finding.risk === 'high') {
          console.log(`   • ${finding.category}: ${finding.matches.join(', ')}`);
        }
      });
    });
    console.log('');
  }
  
  // 详细列出所有发现
  console.log('📋 详细发现列表:');
  console.log('────────────────────────────────────────────────────────────────');
  
  results.forEach(result => {
    if (result.findings.length === 0) return;
    
    console.log(`\n📄 ${result.relativePath}`);
    result.findings.forEach(finding => {
      const riskTag = finding.risk ? ` [${finding.risk.toUpperCase()}]` : '';
      console.log(`   ${finding.type}: ${finding.category}${riskTag}`);
      if (finding.matches.length > 0) {
        console.log(`      匹配项: ${finding.matches.join(', ')}`);
      }
    });
  });
  
  console.log('\n' + '='.repeat(80));
  console.log('检查完成');
  console.log('='.repeat(80));
  console.log('\n建议：');
  console.log('1. 对于高风险文件，建议手动检查是否直接使用了原始文件名');
  console.log('2. 确保所有文件上传都使用了 sanitizeFileName 函数');
  console.log('3. 迁移完成后，建议进行全面测试验证路径正确性');
}

/**
 * 主函数
 */
function main() {
  console.log('🔍 开始检查系统中涉及文件路径处理的代码...\n');
  
  const files = scanDirectory(SRC_DIR);
  console.log(`找到 ${files.length} 个源代码文件`);
  
  const results = [];
  
  files.forEach(filePath => {
    const content = readFileContent(filePath);
    if (!content) return;
    
    const findings = checkFile(filePath, content);
    
    if (findings.length > 0) {
      results.push({
        filePath,
        relativePath: path.relative(SRC_DIR, filePath),
        findings
      });
    }
  });
  
  generateReport(results);
}

// 执行主函数
main();
