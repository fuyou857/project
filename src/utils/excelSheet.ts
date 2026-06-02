import { saveAs } from 'file-saver';

async function getXlsxModule() {
  return import('xlsx');
}

/** 读取 Excel 第一个工作表为 JSON 行数组 */
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