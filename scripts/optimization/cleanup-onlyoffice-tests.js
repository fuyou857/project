#!/usr/bin/env node

/**
 * OnlyOffice测试文件清理脚本
 * 用于删除重复的OnlyOffice测试文件，只保留一个综合测试文件
 */

const fs = require('fs');
const path = require('path');

// 项目根目录
const ROOT_DIR = path.join(__dirname, '..', '..');

// 定义要清理的测试文件
const TEST_FILES_TO_CLEAN = [
    'test-onlyoffice-debug.html',
    'test-onlyoffice-minimal.html',
    'test-onlyoffice-pdf.html',
    'test-onlyoffice-simple.html',
    'test-onlyoffice-word.html'
];

// 定义要保留的测试文件
const TEST_FILE_TO_KEEP = 'test-onlyoffice.html';

// 创建备份目录
const BACKUP_DIR = path.join(ROOT_DIR, 'tmp', 'backup-onlyoffice-tests');

// 检查文件是否存在
function checkFileExists(filePath) {
    try {
        fs.accessSync(filePath, fs.constants.F_OK);
        return true;
    } catch (error) {
        return false;
    }
}

// 创建目录
function createDirectory(dirPath) {
    try {
        fs.mkdirSync(dirPath, { recursive: true });
        return true;
    } catch (error) {
        console.error(`创建目录失败 ${dirPath}:`, error.message);
        return false;
    }
}

// 备份文件
function backupFile(sourcePath, backupDir) {
    try {
        const fileName = path.basename(sourcePath);
        const backupPath = path.join(backupDir, fileName);
        fs.copyFileSync(sourcePath, backupPath);
        return backupPath;
    } catch (error) {
        console.error(`备份文件失败 ${sourcePath}:`, error.message);
        return null;
    }
}

// 删除文件
function deleteFile(filePath) {
    try {
        fs.unlinkSync(filePath);
        return true;
    } catch (error) {
        console.error(`删除文件失败 ${filePath}:`, error.message);
        return false;
    }
}

// 检查保留的文件内容是否完整
function checkKeptFileContent(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // 检查是否包含基本的OnlyOffice测试功能（更宽松的检查条件）
        const checks = [
            'ONLYOFFICE',
            'office.ciond.com',
            'DocEditor',
            'callbackUrl'
        ];
        
        const results = checks.map(check => content.includes(check));
        return results.every(result => result);
    } catch (error) {
        console.error(`检查文件内容失败 ${filePath}:`, error.message);
        return false;
    }
}

// 运行清理
function runCleanup() {
    console.log('=== OnlyOffice测试文件清理 ===\n');
    
    let allOperationsSuccessful = true;
    
    // 1. 检查要保留的文件是否存在且完整
    console.log('1. 检查要保留的测试文件:');
    const keptFilePath = path.join(ROOT_DIR, TEST_FILE_TO_KEEP);
    if (checkFileExists(keptFilePath)) {
        const isContentValid = checkKeptFileContent(keptFilePath);
        console.log(`   ${TEST_FILE_TO_KEEP}: ${isContentValid ? '✓ 存在且内容完整' : '✗ 内容不完整'}`);
        if (!isContentValid) allOperationsSuccessful = false;
    } else {
        console.log(`   ${TEST_FILE_TO_KEEP}: ✗ 不存在`);
        allOperationsSuccessful = false;
    }
    
    if (!allOperationsSuccessful) {
        console.log('\n✗ 要保留的测试文件不存在或内容不完整，取消清理操作。');
        process.exit(1);
    }
    
    // 2. 创建备份目录
    console.log('\n2. 创建备份目录:');
    if (createDirectory(BACKUP_DIR)) {
        console.log(`   ✓ 已创建备份目录: ${BACKUP_DIR}`);
    } else {
        console.log('   ✗ 创建备份目录失败');
        allOperationsSuccessful = false;
    }
    
    // 3. 备份并删除重复文件
    console.log('\n3. 备份并删除重复测试文件:');
    
    TEST_FILES_TO_CLEAN.forEach(fileName => {
        const filePath = path.join(ROOT_DIR, fileName);
        if (checkFileExists(filePath)) {
            // 备份文件
            const backupPath = backupFile(filePath, BACKUP_DIR);
            if (backupPath) {
                console.log(`   ✓ 已备份: ${fileName} -> ${backupPath}`);
                
                // 删除原文件
                if (deleteFile(filePath)) {
                    console.log(`   ✓ 已删除: ${fileName}`);
                } else {
                    console.log(`   ✗ 删除失败: ${fileName}`);
                    allOperationsSuccessful = false;
                }
            } else {
                console.log(`   ✗ 备份失败: ${fileName}`);
                allOperationsSuccessful = false;
            }
        } else {
            console.log(`   ✓ ${fileName}: 不存在，跳过`);
        }
    });
    
    // 4. 总结
    console.log('\n=== 清理总结 ===');
    if (allOperationsSuccessful) {
        console.log('✓ 所有清理操作完成！');
        console.log('\n清理效果：');
        console.log(`- 保留了综合测试文件: ${TEST_FILE_TO_KEEP}`);
        console.log(`- 删除了 ${TEST_FILES_TO_CLEAN.length} 个重复测试文件`);
        console.log(`- 所有文件已备份到: ${BACKUP_DIR}`);
        console.log('\n如果需要恢复文件，可以从备份目录中复制。');
    } else {
        console.log('✗ 部分清理操作失败，请检查上述错误。');
    }
    
    return allOperationsSuccessful;
}

// 执行清理
const success = runCleanup();
process.exit(success ? 0 : 1);
