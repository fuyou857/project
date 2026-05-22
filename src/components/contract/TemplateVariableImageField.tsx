import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../supabase/client';
import { CONTRACT_FILES_STORAGE_BUCKET, publicUrlForStoragePath } from '../../utils/contractDocxStorageFetch';
import { uploadBytesToStorage } from '../../services/contractTemplateLibraryService';

const MAX_BYTES = 5 * 1024 * 1024;

function parseStoragePaths(raw: string): string[] {
  const s = raw.trim();
  if (!s) return [];
  if (s.startsWith('[')) {
    try {
      const a = JSON.parse(s) as unknown;
      if (Array.isArray(a)) return a.filter((x): x is string => typeof x === 'string' && !!x.trim()).map((x) => x.trim());
    } catch {
      return [];
    }
  }
  if (s.startsWith('contract-templates/') || s.startsWith('contract-generated/')) return [s];
  return [];
}

type Props = {
  templateId: string;
  value: string;
  onChange: (storagePathsJson: string) => void;
  onError: (msg: string) => void;
};

/** 模板生成表单：多图上传、缩略预览；值存 JSON 数组字符串，填充时取首张写入 Word */
export default function TemplateVariableImageField({ templateId, value, onChange, onError }: Props) {
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const paths = parseStoragePaths(value);

  const refreshPreviews = useCallback(async () => {
    const ps = parseStoragePaths(value);
    if (!ps.length) {
      setPreviewUrls([]);
      return;
    }
    const urls: string[] = [];
    for (const p of ps) {
      const { data, error } = await supabase.storage.from(CONTRACT_FILES_STORAGE_BUCKET).createSignedUrl(p, 600);
      urls.push(!error && data?.signedUrl ? data.signedUrl : publicUrlForStoragePath(p));
    }
    setPreviewUrls(urls);
  }, [value]);

  useEffect(() => {
    void refreshPreviews();
  }, [refreshPreviews]);

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const next = [...paths];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > MAX_BYTES) {
        onError(`单张图片不能超过 ${MAX_BYTES / 1024 / 1024} MB：${file.name}`);
        return;
      }
      const ext =
      file.name.toLowerCase().match(/\.(png|jpg|jpeg|webp|gif)$/i)?.[1]?.toLowerCase() || (() => {if (
        file.type.includes('png')) {return (
            'png');} else {if (
          file.type.includes('jpeg') || file.type.includes('jpg')) {return (
              'jpg');} else {if (
            file.type.includes('webp')) {return (
                'webp');} else {if (
              file.type.includes('gif')) {return (
                  'gif');} else {return (
                  'bin');}}}}})();
      const path = `contract-templates/field-images/${templateId}/${crypto.randomUUID()}.${ext}`;
      const buf = await file.arrayBuffer();
      try {
        await uploadBytesToStorage(path, buf, file.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`);
      } catch (ex: unknown) {
        onError((ex as Error)?.message || '上传失败');
        return;
      }
      next.push(path);
    }
    onChange(JSON.stringify(next));
  };

  const removeAt = (idx: number) => {
    const next = paths.filter((_, j) => j !== idx);
    onChange(next.length ? JSON.stringify(next) : '');
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-300 bg-white hover:bg-gray-50 cursor-pointer text-sm text-gray-700 w-fit">
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const fl = e.target.files;
            e.target.value = '';
            void uploadFiles(fl).catch((ex) => onError((ex as Error)?.message || '上传失败'));
          }} />
        
        选择图片（可多选）
      </label>
      {paths.length ?
      <div className="flex flex-wrap gap-2">
          {paths.map((p, idx) =>
        <div key={`${p}-${idx}`} className="relative group w-24 h-24 rounded-lg border border-gray-200 overflow-hidden bg-gray-50 shrink-0">
              {previewUrls[idx] ?
          <img src={previewUrls[idx]} alt="" className="w-full h-full object-cover" /> :

          <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400 p-1 text-center break-all">
                  {p.slice(-18)}
                </div>
          }
              <button
            type="button"
            title="移除"
            onClick={() => removeAt(idx)}
            className="absolute top-0.5 right-0.5 w-6 h-6 rounded-full bg-black/60 text-white text-xs leading-6 opacity-0 group-hover:opacity-100 transition-opacity">
            
                ×
              </button>
            </div>
        )}
        </div> :

      <p className="text-xs text-gray-400">未选择图片</p>
      }
      <p className="text-[11px] text-gray-500">
        填充 Word 时当前版本对同一占位符仅嵌入<strong>第一张</strong>图；多图便于留档或后续扩展。
      </p>
    </div>);

}