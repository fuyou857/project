import fs from 'fs';
import path from 'path';
import readline from 'readline';

const LOG_DIR = path.join(process.cwd(), 'logs');

/**
 * 简易日志筛选工具脚本
 * 使用方式: node scripts/filter_logs.js --type=ERROR --start=20240518 --keyword=finance
 */
async function filterLogs() {
  const args = process.argv.slice(2);
  const filters = {
    type: args.find(a => a.startsWith('--type='))?.split('=')[1],
    startDate: args.find(a => a.startsWith('--start='))?.split('=')[1],
    endDate: args.find(a => a.startsWith('--end='))?.split('=')[1],
    keyword: args.find(a => a.startsWith('--keyword='))?.split('=')[1],
  };

  if (!fs.existsSync(LOG_DIR)) {
    console.error('Logs directory not found');
    return;
  }

  const files = fs.readdirSync(LOG_DIR)
    .filter(f => f.startsWith('operation_log_') && f.endsWith('.log'))
    .sort();

  for (const file of files) {
    const fileDate = file.substring(14, 22);
    if (filters.startDate && fileDate < filters.startDate) continue;
    if (filters.endDate && fileDate > filters.endDate) continue;

    console.log(`--- Processing File: ${file} ---`);
    const fileStream = fs.createReadStream(path.join(LOG_DIR, file));
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      let content = line;
      let logType = '';
      
      if (line.startsWith('【ERROR】')) {
        logType = 'ERROR';
        content = line.substring(7);
      } else if (line.startsWith('【CLICK_OP】')) {
        logType = 'CLICK_OP';
        content = line.substring(10);
      }

      try {
        const logEntry = JSON.parse(content);
        
        // Apply filters
        if (filters.type && logType !== filters.type && logEntry.logType !== filters.type) continue;
        if (filters.keyword && !JSON.stringify(logEntry).toLowerCase().includes(filters.keyword.toLowerCase())) continue;

        console.log(`[${logEntry.operationTime}] [${logType || logEntry.logType}] ${logEntry.userName} -> ${logEntry.actionType} on ${logEntry.route}`);
        if (logEntry.errorStack) console.log(`   Stack: ${logEntry.errorStack.substring(0, 100)}...`);
      } catch (e) {
        // Skip malformed lines
      }
    }
  }
}

filterLogs();
