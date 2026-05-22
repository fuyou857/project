#!/usr/bin/env node

/**
 * 文档加载功能整合测试脚本
 * 用于验证 contractDocxStorageFetch.ts 的功能是否正常
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 项目根目录
const ROOT_DIR = path.join(__dirname, '..', '..');

// 测试文件路径
const TEST_FILES = [
    'src/utils/contractDocxStorageFetch.ts',
    'src/services/contractTemplateLibraryService.ts',
    'src/components/contract/GeneratedContractRichWorkspace.tsx',
    'src/components/contract/TemplateVariableImageField.tsx',
    'src/components/ContractPreviewModal.tsx',
    'src/pages/contract/ContractTemplateLibraryPage.tsx'
];

// 检查文件是否存在
function checkFileExists(filePath) {
    try {
        fs.accessSync(filePath, fs.constants.F_OK);
        return true;
    } catch (error) {
        return false;
    }
}

// 检查文件内容
function checkFileContent(filePath, checks) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const results = {};
        
        checks.forEach(check => {
            if (typeof check === 'string') {
                results[check] = content.includes(check);
            } else if (typeof check === 'object' && check.regex) {
                results[check.description] = new RegExp(check.regex).test(content);
            }
        });
        
        return results;
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error.message);
        return null;
    }
}

// 运行测试
function runTests() {
    console.log('=== 文档加载功能整合测试 ===\n');
    
    let allTestsPassed = true;
    
    // 1. 检查文件是否存在
    console.log('1. 检查必要文件是否存在:');
    TEST_FILES.forEach(file => {
        const fullPath = path.join(ROOT_DIR, file);
        const exists = checkFileExists(fullPath);
        console.log(`   ${file}: ${exists ? '✓ 存在' : '✗ 不存在'}`);
        if (!exists) allTestsPassed = false;
    });
    
    // 2. 检查 contractDocxStorageFetch.ts 的内容
    console.log('\n2. 检查 contractDocxStorageFetch.ts 的内容:');
    const docxFetchPath = path.join(ROOT_DIR, 'src/utils/contractDocxStorageFetch.ts');
    const docxFetchChecks = [
        'export const CONTRACT_FILES_STORAGE_BUCKET = \'files\';',
        'export function publicUrlForStoragePath',
        'export async function signedUrlForContractStoragePath',
        'import { supabase } from \'../supabase/client\';'
    ];
    const docxFetchResults = checkFileContent(docxFetchPath, docxFetchChecks);
    if (docxFetchResults) {
        Object.entries(docxFetchResults).forEach(([check, passed]) => {
            console.log(`   ${check}: ${passed ? '✓ 存在' : '✗ 不存在'}`);
            if (!passed) allTestsPassed = false;
        });
    } else {
        allTestsPassed = false;
    }
    
    // 3. 检查 contractTemplateLibraryService.ts 的内容
    console.log('\n3. 检查 contractTemplateLibraryService.ts 的内容:');
    const templateServicePath = path.join(ROOT_DIR, 'src/services/contractTemplateLibraryService.ts');
    const templateServiceChecks = [
        { regex: 'import { CONTRACT_FILES_STORAGE_BUCKET, publicUrlForStoragePath, signedUrlForContractStoragePath } from \'../utils/contractDocxStorageFetch\';', description: '从 contractDocxStorageFetch 导入必要功能' },
        { regex: 'export const CONTRACT_FILES_STORAGE_BUCKET = \'files\';', description: '本地 CONTRACT_FILES_STORAGE_BUCKET 定义' },
        { regex: 'export function publicUrlForStoragePath', description: '本地 publicUrlForStoragePath 定义' },
        { regex: 'async function signedUrlForContractStoragePath', description: '本地 signedUrlForContractStoragePath 定义' }
    ];
    const templateServiceResults = checkFileContent(templateServicePath, templateServiceChecks);
    if (templateServiceResults) {
        console.log(`   ${templateServiceChecks[0].description}: ${templateServiceResults[templateServiceChecks[0].description] ? '✓ 正确' : '✗ 错误'}`);
        
        // 本地定义应该不存在
        for (let i = 1; i < templateServiceChecks.length; i++) {
            const check = templateServiceChecks[i];
            const passed = !templateServiceResults[check.description];
            console.log(`   ${check.description} (应不存在): ${passed ? '✓ 已删除' : '✗ 仍然存在'}`);
            if (!passed) allTestsPassed = false;
        }
    } else {
        allTestsPassed = false;
    }
    
    // 4. 检查组件是否正确导入
    console.log('\n4. 检查组件导入是否正确:');
    const componentsToCheck = [
        {
            path: 'src/components/contract/GeneratedContractRichWorkspace.tsx',
            checks: ['import { CONTRACT_FILES_STORAGE_BUCKET, publicUrlForStoragePath', '../utils/contractDocxStorageFetch']
        },
        {
            path: 'src/components/contract/TemplateVariableImageField.tsx',
            checks: ['import { CONTRACT_FILES_STORAGE_BUCKET, publicUrlForStoragePath', '../utils/contractDocxStorageFetch']
        },
        {
            path: 'src/components/ContractPreviewModal.tsx',
            checks: ['import { CONTRACT_FILES_STORAGE_BUCKET, publicUrlForStoragePath', '../utils/contractDocxStorageFetch']
        },
        {
            path: 'src/pages/contract/ContractTemplateLibraryPage.tsx',
            checks: ['import { publicUrlForStoragePath', '../utils/contractDocxStorageFetch']
        }
    ];
    
    componentsToCheck.forEach(component => {
        const fullPath = path.join(ROOT_DIR, component.path);
        console.log(`   ${component.path}:`);
        
        component.checks.forEach(check => {
            const results = checkFileContent(fullPath, [check]);
            if (results) {
                const passed = results[check];
                console.log(`      ${check}: ${passed ? '✓ 正确' : '✗ 错误'}`);
                if (!passed) allTestsPassed = false;
            } else {
                allTestsPassed = false;
            }
        });
    });
    
    // 5. 运行构建测试
    console.log('\n5. 运行构建测试:');
    try {
        execSync('npm run build:low-mem', { cwd: ROOT_DIR, stdio: 'ignore' });
        console.log('   ✓ 构建成功');
    } catch (error) {
        console.log('   ✗ 构建失败');
        allTestsPassed = false;
    }
    
    // 总结
    console.log('\n=== 测试总结 ===');
    if (allTestsPassed) {
        console.log('✓ 所有测试通过！文档加载功能整合成功。');
        console.log('\n整合效果：');
        console.log('- contractDocxStorageFetch.ts 现在包含所有文档加载相关功能');
        console.log('- contractTemplateLibraryService.ts 不再包含重复的文档加载功能');
        console.log('- 所有组件都已正确更新导入路径');
        console.log('- 项目可以成功构建');
    } else {
        console.log('✗ 部分测试失败，请检查上述错误并修复。');
    }
    
    return allTestsPassed;
}

// 执行测试
const success = runTests();
process.exit(success ? 0 : 1);
