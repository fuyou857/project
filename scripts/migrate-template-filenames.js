/**
 * 自动化数据迁移脚本：修复模板文件名为中文的问题
 * 
 * 功能：
 * 1. 遍历数据库中所有模板记录
 * 2. 识别文件名包含中文字符的模板
 * 3. 将中文文件名转换为安全格式（字母、数字、下划线、连字符）
 * 4. 更新文件系统中的实际文件名称
 * 5. 同步更新数据库中对应模板的文件名记录
 * 
 * 使用方法：
 *   # 显示帮助
 *   node scripts/migrate-template-filenames.js --help
 *   
 *   # 模拟运行（不实际修改数据）
 *   node scripts/migrate-template-filenames.js --dry-run
 *   
 *   # 执行迁移
 *   node scripts/migrate-template-filenames.js --migrate
 *   
 *   # 生成迁移报告
 *   node scripts/migrate-template-filenames.js --report
 *   
 *   # 备份数据
 *   node scripts/migrate-template-filenames.js --backup
 * 
 * 注意：
 * - 请在执行前备份数据库和存储
 * - 建议先在测试环境验证
 * - 需要配置 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 从环境变量读取配置（支持多种命名方式）
function loadEnv() {
  // 尝试从 .env 文件加载
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const lines = envContent.split('\n');
    lines.forEach(line => {
      const parts = line.split('=');
      if (parts.length === 2) {
        const key = parts[0].trim();
        const value = parts[1].trim().replace(/['"]/g, '');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  }
}

// 加载环境变量
loadEnv();

// 获取 Supabase 配置（支持多种环境变量名称）
const getConfigValue = (keys) => {
  for (const key of keys) {
    if (process.env[key]) {
      return process.env[key];
    }
  }
  return null;
};

// 解析命令行参数
const args = process.argv.slice(2);
const getArgValue = (name) => {
  const index = args.indexOf(name);
  if (index !== -1 && index + 1 < args.length) {
    return args[index + 1];
  }
  return null;
};
const cliKey = getArgValue('--key');
const cliUrl = getArgValue('--url');

// 获取配置：命令行参数优先级高于环境变量
const supabaseUrl = cliUrl || getConfigValue(['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'DB_URL', 'APP_SUPABASE_URL']);
const supabaseKey = cliKey || getConfigValue([
  'SUPABASE_SERVICE_ROLE_KEY', 
  'SERVICE_ROLE_KEY', 
  'SUPABASE_KEY', 
  'DB_SERVICE_KEY',
  'SUPABASE_SECRET_KEY',
  'APP_SERVICE_ROLE_KEY'
]);

if (!supabaseUrl) {
  console.error('❌ 错误：未找到 Supabase URL');
  console.error('请通过以下方式之一设置：');
  console.error('  1. 设置环境变量：SUPABASE_URL');
  console.error('  2. 使用命令行参数：--url your-supabase-url');
  process.exit(1);
}

if (!supabaseKey) {
  console.error('❌ 错误：未找到服务角色密钥');
  console.error('请通过以下方式之一设置：');
  console.error('  1. 设置环境变量（以下任一）：');
  console.error('     - SUPABASE_SERVICE_ROLE_KEY');
  console.error('     - SERVICE_ROLE_KEY');
  console.error('     - SUPABASE_KEY');
  console.error('     - DB_SERVICE_KEY');
  console.error('     - SUPABASE_SECRET_KEY');
  console.error('  2. 使用命令行参数：--key your-service-role-key');
  process.exit(1);
}

// 初始化 Supabase 客户端
const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

const BUCKET = 'files';
const BACKUP_DIR = './backups';

// 命令行参数
const isDryRun = args.includes('--dry-run');
const isMigrate = args.includes('--migrate');
const isReport = args.includes('--report');
const isBackup = args.includes('--backup');
const showHelp = args.includes('--help');
const skipConfirm = args.includes('--yes') || args.includes('--confirm');

/**
 * 显示帮助信息
 */
function showHelpInfo() {
  console.log(`
自动化数据迁移脚本：修复模板文件名为中文的问题

使用方法：
  node scripts/migrate-template-filenames.js [选项]

选项：
  --help          显示此帮助信息
  --dry-run       模拟运行（不实际修改数据）
  --migrate       执行实际迁移
  --report        生成迁移报告（仅分析，不修改）
  --backup        创建数据库备份
  --key <value>   直接指定服务角色密钥（优先级最高）
  --url <value>   直接指定 Supabase URL（优先级最高）

示例：
  # 先运行报告查看需要迁移的记录
  node scripts/migrate-template-filenames.js --report
  
  # 使用命令行参数指定密钥
  node scripts/migrate-template-filenames.js --report --key your-service-role-key
  
  # 模拟运行验证迁移逻辑
  node scripts/migrate-template-filenames.js --dry-run --key your-service-role-key
  
  # 执行实际迁移
  node scripts/migrate-template-filenames.js --migrate --key your-service-role-key

注意：
  - 执行迁移前请确保已备份数据
  - 需要配置环境变量或使用命令行参数
  - 建议先在测试环境验证后再应用到生产环境
  - 命令行参数优先级高于环境变量
`);
}

/**
 * 检查字符串是否包含中文字符
 */
function containsChinese(str) {
  return /[\u4e00-\u9fa5]/.test(str);
}

/**
 * 检查字符串是否包含特殊字符（不允许在存储路径中使用）
 */
function containsSpecialChars(str) {
  // 只允许字母、数字、下划线、连字符、点和斜杠
  const allowedChars = /^[a-zA-Z0-9_\-.\/]+$/;
  return !allowedChars.test(str);
}

/**
 * 生成安全的文件名
 * - 移除中文和特殊字符
 * - 只保留字母、数字、下划线、连字符和点
 */
function sanitizeFileName(fileName) {
  // 获取扩展名
  const lastDotIndex = fileName.lastIndexOf('.');
  let baseName = fileName;
  let extension = '';
  
  if (lastDotIndex !== -1) {
    baseName = fileName.substring(0, lastDotIndex);
    extension = fileName.substring(lastDotIndex + 1);
  }
  
  // 清理基本文件名：只保留字母、数字、下划线、连字符
  // 将所有非ASCII字符替换为下划线
  let cleanBaseName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');
  
  // 防止连续的下划线
  cleanBaseName = cleanBaseName.replace(/_+/g, '_');
  
  // 移除开头和结尾的下划线
  cleanBaseName = cleanBaseName.replace(/^_+|_+$/g, '');
  
  // 如果清理后为空，使用默认名称
  if (!cleanBaseName) {
    cleanBaseName = 'file';
  }
  
  // 组合文件名
  if (extension) {
    // 清理扩展名
    const cleanExtension = extension.toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
    return `${cleanBaseName}.${cleanExtension}`;
  }
  return cleanBaseName;
}

/**
 * 重命名存储中的文件
 */
async function renameStorageFile(oldPath, newPath) {
  try {
    // 复制文件到新路径
    const { data: downloadData, error: downloadError } = await supabase.storage
      .from(BUCKET)
      .download(oldPath);
    
    if (downloadError) {
      console.error(`  ❌ 下载文件失败: ${oldPath}`);
      console.error(`    错误: ${downloadError.message}`);
      return { success: false, error: downloadError.message };
    }
    
    // 上传到新路径
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(newPath, downloadData, { upsert: false });
    
    if (uploadError) {
      console.error(`  ❌ 上传文件失败: ${newPath}`);
      console.error(`    错误: ${uploadError.message}`);
      return { success: false, error: uploadError.message };
    }
    
    // 删除旧文件
    const { error: deleteError } = await supabase.storage
      .from(BUCKET)
      .remove([oldPath]);
    
    if (deleteError) {
      console.error(`  ⚠️ 删除旧文件失败: ${oldPath}`);
      console.error(`    错误: ${deleteError.message}`);
      // 不认为是失败，文件已成功复制到新路径
    }
    
    return { success: true, error: null };
  } catch (error) {
    console.error(`  ❌ 重命名文件异常: ${oldPath} -> ${newPath}`);
    console.error(`    错误: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * 创建数据备份
 */
async function createBackup() {
  console.log('=== 创建数据备份 ===\n');
  
  try {
    // 创建备份目录
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    
    // 查询所有模板版本记录
    const { data: versions, error: queryError } = await supabase
      .from('contract_template_file_versions')
      .select('*');
    
    if (queryError) {
      console.error('❌ 查询模板版本失败:', queryError.message);
      return false;
    }
    
    // 查询所有生成的合同记录
    const { data: contracts, error: contractsError } = await supabase
      .from('generated_contracts')
      .select('id, generated_docx_storage_path, merged_pdf_storage_path, sealed_pdf_storage_path');
    
    if (contractsError) {
      console.error('❌ 查询生成合同失败:', contractsError.message);
      return false;
    }
    
    // 生成备份文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `backup-${timestamp}.json`;
    const backupPath = path.join(BACKUP_DIR, backupFileName);
    
    // 创建备份数据
    const backupData = {
      timestamp: new Date().toISOString(),
      contract_template_file_versions: versions,
      generated_contracts: contracts
    };
    
    // 写入备份文件
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
    
    console.log(`✅ 备份成功！`);
    console.log(`   备份文件: ${backupPath}`);
    console.log(`   模板版本记录数: ${versions.length}`);
    console.log(`   生成合同记录数: ${contracts.length}`);
    
    return true;
  } catch (error) {
    console.error('❌ 创建备份失败:', error.message);
    return false;
  }
}

/**
 * 生成迁移报告
 */
async function generateReport() {
  console.log('=== 生成迁移报告 ===\n');
  
  try {
    // 查询所有模板版本记录
    const { data: versions, error: queryError } = await supabase
      .from('contract_template_file_versions')
      .select('id, template_id, storage_path, original_filename');
    
    if (queryError) {
      console.error('❌ 查询模板版本失败:', queryError.message);
      return;
    }
    
    console.log(`共找到 ${versions.length} 个模板版本记录`);
    
    const needsMigration = [];
    const safeRecords = [];
    
    for (const version of versions) {
      const { id, template_id, storage_path, original_filename } = version;
      
      const pathNeedsMigration = containsChinese(storage_path) || containsSpecialChars(storage_path);
      const filenameNeedsMigration = containsChinese(original_filename) || containsSpecialChars(original_filename);
      
      if (pathNeedsMigration || filenameNeedsMigration) {
        // 生成新的文件名用于报告
        const pathParts = storage_path.split('/');
        const oldFileName = pathParts[pathParts.length - 1];
        const newFileName = sanitizeFileName(oldFileName);
        pathParts[pathParts.length - 1] = newFileName;
        const newStoragePath = pathParts.join('/');
        
        needsMigration.push({
          id,
          template_id,
          current_storage_path: storage_path,
          new_storage_path: newStoragePath,
          current_original_filename: original_filename,
          new_original_filename: sanitizeFileName(original_filename),
          issues: {
            chinese_in_path: containsChinese(storage_path),
            special_chars_in_path: containsSpecialChars(storage_path),
            chinese_in_filename: containsChinese(original_filename),
            special_chars_in_filename: containsSpecialChars(original_filename)
          }
        });
      } else {
        safeRecords.push(version);
      }
    }
    
    console.log(`\n📊 需要迁移的记录: ${needsMigration.length} 条`);
    console.log(`✅ 无需迁移的记录: ${safeRecords.length} 条`);
    
    if (needsMigration.length > 0) {
      console.log('\n📋 需要迁移的详细列表:');
      console.log('────────────────────────────────────────────────────────────────');
      
      needsMigration.forEach((record, index) => {
        console.log(`\n[${index + 1}] ID: ${record.id}`);
        console.log(`   模板ID: ${record.template_id}`);
        console.log(`   当前存储路径: ${record.current_storage_path}`);
        console.log(`   新存储路径: ${record.new_storage_path}`);
        console.log(`   当前原始文件名: ${record.current_original_filename}`);
        console.log(`   新原始文件名: ${record.new_original_filename}`);
        console.log(`   问题类型:`);
        if (record.issues.chinese_in_path) console.log(`     - 路径包含中文`);
        if (record.issues.special_chars_in_path) console.log(`     - 路径包含特殊字符`);
        if (record.issues.chinese_in_filename) console.log(`     - 原始文件名包含中文`);
        if (record.issues.special_chars_in_filename) console.log(`     - 原始文件名包含特殊字符`);
      });
      
      console.log('\n────────────────────────────────────────────────────────────────');
      console.log(`\n⚠️  建议：`);
      console.log(`   1. 执行迁移前请先备份数据`);
      console.log(`   2. 使用 --dry-run 参数进行模拟运行`);
      console.log(`   3. 确认无误后使用 --migrate 参数执行迁移`);
    } else {
      console.log('\n🎉 所有记录均已符合安全命名标准，无需迁移！');
    }
    
  } catch (error) {
    console.error('❌ 生成报告失败:', error.message);
  }
}

/**
 * 执行迁移
 */
async function executeMigration() {
  console.log('=== 执行模板文件名迁移 ===\n');
  
  try {
    // 查询所有模板版本记录
    const { data: versions, error: queryError } = await supabase
      .from('contract_template_file_versions')
      .select('id, template_id, storage_path, original_filename');
    
    if (queryError) {
      console.error('❌ 查询模板版本失败:', queryError.message);
      process.exit(1);
    }
    
    console.log(`共找到 ${versions.length} 个模板版本记录`);
    
    let migratedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const migrationResults = [];
    
    for (const version of versions) {
      const { id, template_id, storage_path, original_filename } = version;
      
      // 检查是否需要迁移
      const pathNeedsMigration = containsChinese(storage_path) || containsSpecialChars(storage_path);
      const filenameNeedsMigration = containsChinese(original_filename) || containsSpecialChars(original_filename);
      
      if (!pathNeedsMigration && !filenameNeedsMigration) {
        skippedCount++;
        continue;
      }
      
      console.log(`\n────────────────────────────────────────────────────────────────`);
      console.log(`处理记录 ID: ${id}`);
      console.log(`模板ID: ${template_id}`);
      console.log(`当前存储路径: ${storage_path}`);
      console.log(`当前原始文件名: ${original_filename}`);
      
      try {
        // 生成新的存储路径
        const pathParts = storage_path.split('/');
        const oldFileName = pathParts[pathParts.length - 1];
        const newFileName = sanitizeFileName(oldFileName);
        
        // 构建新路径（只修改文件名部分）
        pathParts[pathParts.length - 1] = newFileName;
        const newStoragePath = pathParts.join('/');
        
        // 生成新的原始文件名（用于数据库记录）
        const newOriginalFilename = sanitizeFileName(original_filename);
        
        console.log(`新存储路径: ${newStoragePath}`);
        console.log(`新原始文件名: ${newOriginalFilename}`);
        
        if (isDryRun) {
          console.log('⚠️  模拟运行模式，跳过实际文件操作');
          migratedCount++;
          migrationResults.push({
            id,
            success: true,
            dryRun: true,
            message: '模拟运行：记录需要迁移'
          });
          continue;
        }
        
        // 情况1：路径不含中文，但原始文件名含中文
        // 只需更新数据库中的 original_filename
        if (!pathNeedsMigration && filenameNeedsMigration) {
          console.log('📝 路径无需修改，仅更新原始文件名');
          
          const { error: updateError } = await supabase
            .from('contract_template_file_versions')
            .update({
              original_filename: newOriginalFilename
            })
            .eq('id', id);
          
          if (updateError) {
            console.error(`❌ 更新数据库失败: ${updateError.message}`);
            failedCount++;
            migrationResults.push({
              id,
              success: false,
              dryRun: false,
              message: `更新数据库失败: ${updateError.message}`
            });
            continue;
          }
          
          console.log('✅ 数据库更新成功');
          console.log('✅ 迁移完成');
          migratedCount++;
          migrationResults.push({
            id,
            success: true,
            dryRun: false,
            message: '仅更新原始文件名成功'
          });
          continue;
        }
        
        // 情况2：路径含中文 - 无法自动迁移，标记为需要手动处理
        if (containsChinese(storage_path)) {
          console.log('⚠️  存储路径包含中文字符，无法自动迁移');
          console.log('   建议：手动重新上传文件或修改存储路径');
          failedCount++;
          migrationResults.push({
            id,
            success: false,
            dryRun: false,
            message: '存储路径包含中文，需要手动处理',
            requiresManualAction: true,
            currentPath: storage_path,
            suggestedPath: newStoragePath
          });
          continue;
        }
        
        // 情况3：路径包含特殊字符但不含中文 - 尝试重命名
        const renameResult = await renameStorageFile(storage_path, newStoragePath);
        
        if (!renameResult.success) {
          // 如果文件已存在且路径相同（可能之前已处理），只更新数据库
          if (renameResult.error === 'The resource already exists' && storage_path === newStoragePath) {
            console.log('📝 文件已存在且路径相同，仅更新原始文件名');
            
            const { error: updateError } = await supabase
              .from('contract_template_file_versions')
              .update({
                original_filename: newOriginalFilename
              })
              .eq('id', id);
            
            if (updateError) {
              console.error(`❌ 更新数据库失败: ${updateError.message}`);
              failedCount++;
              migrationResults.push({
                id,
                success: false,
                dryRun: false,
                message: `更新数据库失败: ${updateError.message}`
              });
              continue;
            }
            
            console.log('✅ 数据库更新成功');
            console.log('✅ 迁移完成');
            migratedCount++;
            migrationResults.push({
              id,
              success: true,
              dryRun: false,
              message: '文件已存在，仅更新原始文件名成功'
            });
            continue;
          }
          
          console.log(`❌ 文件重命名失败: ${renameResult.error}`);
          failedCount++;
          migrationResults.push({
            id,
            success: false,
            dryRun: false,
            message: `文件重命名失败: ${renameResult.error}`
          });
          continue;
        }
        
        console.log('✅ 文件重命名成功');
        
        // 更新数据库记录
        const { error: updateError } = await supabase
          .from('contract_template_file_versions')
          .update({
            storage_path: newStoragePath,
            original_filename: newOriginalFilename
          })
          .eq('id', id);
        
        if (updateError) {
          console.error(`❌ 更新数据库失败: ${updateError.message}`);
          failedCount++;
          migrationResults.push({
            id,
            success: false,
            dryRun: false,
            message: `更新数据库失败: ${updateError.message}`
          });
          continue;
        }
        
        console.log('✅ 数据库更新成功');
        console.log('✅ 迁移完成');
        
        migratedCount++;
        migrationResults.push({
          id,
          success: true,
          dryRun: false,
          message: '迁移成功',
          oldPath: storage_path,
          newPath: newStoragePath,
          oldFilename: original_filename,
          newFilename: newOriginalFilename
        });
        
      } catch (error) {
        console.error(`❌ 处理记录 ${id} 时发生异常: ${error.message}`);
        failedCount++;
        migrationResults.push({
          id,
          success: false,
          dryRun: false,
          message: `处理异常: ${error.message}`
        });
      }
    }
    
    // 输出统计结果
    console.log('\n' + '='.repeat(60));
    console.log('=== 迁移完成 ===');
    console.log('='.repeat(60));
    console.log(`总计记录: ${versions.length}`);
    console.log(`已迁移: ${migratedCount}`);
    console.log(`跳过: ${skippedCount}`);
    console.log(`失败: ${failedCount}`);
    
    if (isDryRun) {
      console.log('\n⚠️  以上结果为模拟运行，未实际修改任何数据');
      console.log('使用 --migrate 参数执行实际迁移');
    } else {
      // 生成迁移结果文件
      if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const resultFileName = `migration-result-${timestamp}.json`;
      const resultPath = path.join(BACKUP_DIR, resultFileName);
      
      const resultData = {
        timestamp: new Date().toISOString(),
        isDryRun: isDryRun,
        total: versions.length,
        migrated: migratedCount,
        skipped: skippedCount,
        failed: failedCount,
        results: migrationResults
      };
      
      fs.writeFileSync(resultPath, JSON.stringify(resultData, null, 2));
      
      console.log(`\n📄 迁移结果已保存到: ${resultPath}`);
      
      if (failedCount > 0) {
        console.log('\n⚠️  部分记录迁移失败，请检查日志和迁移结果文件');
        console.log('建议手动处理失败的记录');
        process.exit(1);
      }
      
      console.log('\n🎉 所有需要迁移的记录均已成功处理！');
    }
    
  } catch (error) {
    console.error('❌ 迁移过程发生严重错误:', error.message);
    process.exit(1);
  }
}

/**
 * 主函数
 */
async function main() {
  // 检查配置（已在前面验证过）
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ 请配置环境变量 SUPABASE_URL 和服务角色密钥');
    process.exit(1);
  }
  
  // 显示帮助
  if (showHelp) {
    showHelpInfo();
    return;
  }
  
  // 创建备份
  if (isBackup) {
    await createBackup();
    return;
  }
  
  // 生成报告
  if (isReport) {
    await generateReport();
    return;
  }
  
  // 执行迁移（包括模拟运行）
  if (isDryRun || isMigrate) {
    if (isMigrate && !skipConfirm) {
      console.log('⚠️  您即将执行实际数据迁移！');
      console.log('请确保已备份数据，并且在测试环境验证通过。');
      console.log('按 Ctrl+C 取消，或按 Enter 继续...');
      
      // 等待用户确认
      await new Promise(resolve => {
        process.stdin.once('data', () => resolve(null));
      });
    }
    
    await executeMigration();
    return;
  }
  
  // 默认显示帮助
  console.log('❌ 请指定操作模式');
  showHelpInfo();
}

// 执行主函数
main().catch(error => {
  console.error('❌ 程序执行失败:', error.message);
  process.exit(1);
});