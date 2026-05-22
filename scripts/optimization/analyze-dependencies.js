#!/usr/bin/env node

/**
 * 代码依赖分析工具
 * 用于分析 contractDocxStorageFetch.ts 和 contractTemplateLibraryService.ts 之间的依赖关系
 */

const fs = require('fs');
const path = require('path');

// 项目根目录
const ROOT_DIR = path.join(__dirname, '..', '..');

// 目标文件
const CONTRACTDOCXSTORAGEFETCH_PATH = path.join(ROOT_DIR, 'src', 'utils', 'contractDocxStorageFetch.ts');
const CONTRACTTEMPLATE_LIBRARY_SERVICE_PATH = path.join(ROOT_DIR, 'src', 'services', 'contractTemplateLibraryService.ts');

// 分析文件内容
function analyzeFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // 提取导入语句
        const imports = [];
        const importRegex = /import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            imports.push({
                what: match[1].trim(),
                from: match[2].trim()
            });
        }
        
        // 提取导出函数
        const exports = [];
        const exportRegex = /export\s+(async\s+)?function\s+([\w]+)\s*\(/g;
        while ((match = exportRegex.exec(content)) !== null) {
            exports.push({
                name: match[2].trim(),
                isAsync: !!match[1]
            });
        }
        
        // 提取本地函数
        const locals = [];
        const localRegex = /(async\s+)?function\s+([\w]+)\s*\(/g;
        while ((match = localRegex.exec(content)) !== null) {
            // 排除已经识别为导出的函数
            if (!exports.find(e => e.name === match[2].trim())) {
                locals.push({
                    name: match[2].trim(),
                    isAsync: !!match[1]
                });
            }
        }
        
        return {
            imports,
            exports,
            locals,
            content
        };
    } catch (error) {
        console.error(`Error analyzing file ${filePath}:`, error.message);
        return null;
    }
}

// 分析函数调用关系
function analyzeFunctionCalls(content, functions) {
    const calls = [];
    
    functions.forEach(func => {
        const callRegex = new RegExp(`\\b${func.name}\\s*\\(`, 'g');
        let match;
        let count = 0;
        
        while ((match = callRegex.exec(content)) !== null) {
            count++;
        }
        
        if (count > 0) {
            calls.push({
                function: func.name,
                count
            });
        }
    });
    
    return calls;
}

// 生成分析报告
function generateReport() {
    console.log('=== 代码依赖分析报告 ===\n');
    
    // 分析 contractDocxStorageFetch.ts
    console.log('1. 分析 contractDocxStorageFetch.ts:');
    const docxFetchAnalysis = analyzeFile(CONTRACTDOCXSTORAGEFETCH_PATH);
    if (docxFetchAnalysis) {
        console.log(`   导入语句: ${docxFetchAnalysis.imports.length}`);
        docxFetchAnalysis.imports.forEach(imp => {
            console.log(`      - ${imp.what} from '${imp.from}'`);
        });
        
        console.log(`   导出函数: ${docxFetchAnalysis.exports.length}`);
        docxFetchAnalysis.exports.forEach(exp => {
            console.log(`      - ${exp.isAsync ? 'async ' : ''}function ${exp.name}`);
        });
        
        console.log(`   本地函数: ${docxFetchAnalysis.locals.length}`);
        docxFetchAnalysis.locals.forEach(local => {
            console.log(`      - ${local.isAsync ? 'async ' : ''}function ${local.name}`);
        });
        
        // 分析函数调用
        const allFunctions = [...docxFetchAnalysis.exports, ...docxFetchAnalysis.locals];
        const calls = analyzeFunctionCalls(docxFetchAnalysis.content, allFunctions);
        console.log(`   函数调用: ${calls.length}`);
        calls.forEach(call => {
            console.log(`      - ${call.function}() 被调用 ${call.count} 次`);
        });
    }
    
    console.log('\n2. 分析 contractTemplateLibraryService.ts:');
    const templateServiceAnalysis = analyzeFile(CONTRACTTEMPLATE_LIBRARY_SERVICE_PATH);
    if (templateServiceAnalysis) {
        console.log(`   导入语句: ${templateServiceAnalysis.imports.length}`);
        // 只显示与文档加载相关的导入
        const relevantImports = templateServiceAnalysis.imports.filter(imp => 
            imp.from.includes('contractDocxStorageFetch') || 
            imp.from.includes('supabase/client') ||
            imp.what.includes('CONTRACT_FILES_STORAGE_BUCKET')
        );
        relevantImports.forEach(imp => {
            console.log(`      - ${imp.what} from '${imp.from}'`);
        });
        
        // 只显示与文档加载相关的函数
        console.log('   与文档加载相关的导出函数:');
        const relevantExports = templateServiceAnalysis.exports.filter(exp => 
            exp.name.includes('Url') || 
            exp.name.includes('download') ||
            exp.name.includes('storage')
        );
        relevantExports.forEach(exp => {
            console.log(`      - ${exp.isAsync ? 'async ' : ''}function ${exp.name}`);
        });
        
        console.log('   与文档加载相关的本地函数:');
        const relevantLocals = templateServiceAnalysis.locals.filter(local => 
            local.name.includes('Url') || 
            local.name.includes('download') ||
            local.name.includes('storage')
        );
        relevantLocals.forEach(local => {
            console.log(`      - ${local.isAsync ? 'async ' : ''}function ${local.name}`);
        });
    }
    
    // 检查两个文件之间的依赖关系
    console.log('\n3. 跨文件依赖关系:');
    if (docxFetchAnalysis && templateServiceAnalysis) {
        // 检查 contractTemplateLibraryService 是否导入了 contractDocxStorageFetch
        const importsDocxFetch = templateServiceAnalysis.imports.some(imp => 
            imp.from.includes('contractDocxStorageFetch')
        );
        console.log(`   contractTemplateLibraryService 导入了 contractDocxStorageFetch: ${importsDocxFetch}`);
        
        // 检查 contractDocxStorageFetch 是否导入了 contractTemplateLibraryService
        const importsTemplateService = docxFetchAnalysis.imports.some(imp => 
            imp.from.includes('contractTemplateLibraryService')
        );
        console.log(`   contractDocxStorageFetch 导入了 contractTemplateLibraryService: ${importsTemplateService}`);
        
        // 识别重复功能
        const docxFetchFunctionNames = docxFetchAnalysis.exports.map(exp => exp.name);
        const templateServiceFunctionNames = [...templateServiceAnalysis.exports, ...templateServiceAnalysis.locals].map(f => f.name);
        
        const potentialDuplicates = [];
        docxFetchFunctionNames.forEach(name => {
            if (name.includes('Url') || name.includes('download') || name.includes('storage')) {
                potentialDuplicates.push(name);
            }
        });
        
        templateServiceFunctionNames.forEach(name => {
            if ((name.includes('Url') || name.includes('download') || name.includes('storage')) && 
                !potentialDuplicates.includes(name)) {
                potentialDuplicates.push(name);
            }
        });
        
        console.log('   潜在的重复功能函数:');
        potentialDuplicates.forEach(name => {
            console.log(`      - ${name}`);
        });
    }
    
    console.log('\n=== 分析完成 ===\n');
}

// 执行分析
generateReport();
