import { invokeConvert } from './contractDocumentConvertService';

/** Storage 上 docx → pdf（与预览弹窗、模板库等页原 invokeConvert 参数一致） */
export async function convertStorageDocxToPdf(
  sourcePath: string,
  outputPath: string,
): Promise<void> {
  await invokeConvert({
    action: 'docx_to_pdf',
    source_path: sourcePath,
    output_path: outputPath,
  });
}
