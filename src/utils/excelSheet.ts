import { saveAs } from 'file-saver';

async function getXlsxModule() {
  return import('xlsx');
}

/** Excel 读取结果 */
export interface ExcelReadResult {
  success: boolean;
  data?: Record<string, unknown>[];
  error?: {
    type: 'empty_file' | 'empty_sheet' | 'no_data' | 'invalid_format' | 'read_error';
    message: string;
  };
}

/** 增强版 Excel 读取函数，包含完善的验证和错误处理 */
export async function readExcelWithValidation(file: File): Promise<ExcelReadResult> {
  // 1. 文件大小验证 - 拒绝 0 字节文件
  if (file.size === 0) {
    return {
      success: false,
      error: {
        type: 'empty_file',
        message: '文件为空（0字节），请选择有效的Excel文件'
      }
    };
  }

  // 2. 文件类型验证
  const validExtensions = ['.xlsx', '.xls', '.xlsm'];
  const fileName = file.name.toLowerCase();
  const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
  
  if (!hasValidExtension) {
    return {
      success: false,
      error: {
        type: 'invalid_format',
        message: `文件格式不支持，请上传 Excel 文件（${validExtensions.join('、')}）`
      }
    };
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = async (evt) => {
      try {
        const XLSX = await getXlsxModule();
        const arrayBuffer = evt.target?.result;
        
        // 3. 检查读取结果是否有效
        if (!arrayBuffer || (arrayBuffer as ArrayBuffer).byteLength === 0) {
          resolve({
            success: false,
            error: {
              type: 'empty_file',
              message: '文件内容为空，无法读取'
            }
          });
          return;
        }

        // 4. 解析 Excel
        let wb;
        try {
          wb = XLSX.read(arrayBuffer, { type: 'array' });
        } catch (parseError) {
          resolve({
            success: false,
            error: {
              type: 'invalid_format',
              message: '文件不是有效的 Excel 格式，可能已损坏或格式不正确'
            }
          });
          return;
        }

        // 5. 检查是否有工作表
        if (!wb.SheetNames || wb.SheetNames.length === 0) {
          resolve({
            success: false,
            error: {
              type: 'empty_sheet',
              message: 'Excel 文件中没有工作表'
            }
          });
          return;
        }

        // 6. 获取第一个工作表
        const firstSheetName = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheetName];
        
        if (!ws) {
          resolve({
            success: false,
            error: {
              type: 'empty_sheet',
              message: `工作表"${firstSheetName}"不存在或无法访问`
            }
          });
          return;
        }

        // 7. 检查工作表是否有数据（使用 range 检查实际数据范围）
        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
        const rowCount = range.e.r - range.s.r + 1;
        const colCount = range.e.c - range.s.c + 1;
        
        if (rowCount <= 0 || colCount <= 0) {
          resolve({
            success: false,
            error: {
              type: 'empty_sheet',
              message: '工作表为空白，没有任何数据'
            }
          });
          return;
        }

        // 8. 转换为 JSON
        const json = XLSX.utils.sheet_to_json(ws) as Record<string, unknown>[];
        
        // 9. 检查是否有数据行（可能只有表头）
        if (json.length === 0) {
          // 检查是否有表头（第一行有内容但没有数据行）
          if (rowCount === 1) {
            resolve({
              success: false,
              error: {
                type: 'no_data',
                message: 'Excel 文件只有表头，没有数据行。请确保文件包含要导入的数据'
              }
            });
          } else {
            resolve({
              success: false,
              error: {
                type: 'no_data',
                message: 'Excel 文件没有可导入的数据。请检查数据是否在正确的列中'
              }
            });
          }
          return;
        }

        // 成功返回数据
        resolve({
          success: true,
          data: json
        });
        
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        resolve({
          success: false,
          error: {
            type: 'read_error',
            message: `读取 Excel 文件时发生错误：${errMsg}`
          }
        });
      }
    };
    
    reader.onerror = () => {
      resolve({
        success: false,
        error: {
          type: 'read_error',
          message: '文件读取失败，请检查文件是否损坏或重新选择文件'
        }
      });
    };
    
    reader.readAsArrayBuffer(file);
  });
}

/** 读取 Excel 第一个工作表为 JSON 行数组（旧版兼容函数） */
export async function readExcelFirstSheetRows(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const XLSX = await getXlsxModule();
        const wb = XLSX.read(evt.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws) as Record<string, unknown>[];
        resolve(json);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsBinaryString(file);
  });
}

/** 将 JSON 行导出为 xlsx 并触发下载 */
export async function downloadJsonRowsAsXlsx(
  rows: Record<string, unknown>[],
  sheetName: string,
  fileName: string,
): Promise<void> {
  const XLSX = await getXlsxModule();
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(
    new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    fileName,
  );
}