import { useCallback, useEffect, useRef, useState } from 'react';
import { saveAs } from 'file-saver';
import mammoth from 'mammoth';
import { supabase } from '../../supabase/client';
import { CONTRACT_FILES_STORAGE_BUCKET, publicUrlForStoragePath, loadContractDocxBufferFromStorage } from '../../utils/contractDocxStorageFetch';
import { type GeneratedContract } from '../../services/contractGenerationService';
import { exportTiptapJsonToDocxBlob } from '../../utils/tiptapJsonToDocx';
import TiptapContractEditor, { type TiptapContractEditorHandle } from './TiptapContractEditor';
import DocxStoragePreview from './DocxStoragePreview';

export type GeneratedContractRichWorkspaceProps = {
  row: GeneratedContract;
  userId: string | null;
  onSaveRevision: (html: string) => Promise<void>;
  onUploadDocx: (file: File) => Promise<void>;
  genDocxBusy?: boolean;
};

function escapeHtmlText(s: string): string {
  return (s || '').
  replace(/&/g, '&amp;').
  replace(/</g, '&lt;').
  replace(/>/g, '&gt;').
  replace(/"/g, '&quot;');
}

function htmlToVisibleText(html: string): string {
  return (html || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

const MAMMOTH_MS = 20_000;

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  const timeoutP = new Promise<never>((_, rej) => {
    t = setTimeout(() => rej(new Error(`${label}，已超过 ${ms / 1000} 秒`)), ms);
  });
  try {
    return await Promise.race([p, timeoutP]);
  } finally {
    if (t !== undefined) clearTimeout(t);
  }
}

type PreviewTab = 'docx' | 'pdf' | 'office' | 'google';

export default function GeneratedContractRichWorkspace({
  row,
  userId: _userId,
  onSaveRevision,
  onUploadDocx,
  genDocxBusy = false
}: GeneratedContractRichWorkspaceProps) {
  const editorRef = useRef<TiptapContractEditorHandle>(null);

  const [editorNotice, setEditorNotice] = useState<string | null>(null);
  const [editorBootBusy, setEditorBootBusy] = useState(false);
  const [sourceHtml, setSourceHtml] = useState('<p></p>');
  const [editorResetKey, setEditorResetKey] = useState(0);
  const [saveBusy, setSaveBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [previewTab, setPreviewTab] = useState<PreviewTab>('docx');
  const [officeEmbedUrl, setOfficeEmbedUrl] = useState<string | null>(null);
  const [officeBusy, setOfficeBusy] = useState(false);
  const [officeErr, setOfficeErr] = useState<string | null>(null);
  const [googleEmbedUrl, setGoogleEmbedUrl] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleErr, setGoogleErr] = useState<string | null>(null);
  const [pdfEmbedSrc, setPdfEmbedSrc] = useState<string | null>(null);

  const path = row.generated_docx_storage_path;
  const pdfPath = row.merged_pdf_storage_path;

  useEffect(() => {
    if (!pdfPath) {
      setPdfEmbedSrc(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase.storage.from(CONTRACT_FILES_STORAGE_BUCKET).createSignedUrl(pdfPath, 3600);
      if (cancelled) return;
      if (!error && data?.signedUrl) setPdfEmbedSrc(data.signedUrl);else
      setPdfEmbedSrc(publicUrlForStoragePath(pdfPath));
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfPath]);

  /** 切换合同时重置嵌入预览；默认 PDF 或 Word（与模板相同的 docx-preview） */
  useEffect(() => {
    setOfficeEmbedUrl(null);
    setOfficeErr(null);
    setGoogleEmbedUrl(null);
    setGoogleErr(null);
    setPreviewTab(path && pdfPath ? 'pdf' : 'docx');
  }, [row.id, path, pdfPath]);

  /** 仅用于 TipTap 初始 HTML：有草稿用草稿，否则从 Word 抽取（与上方 Word 预览独立） */
  useEffect(() => {
    let cancelled = false;
    if (!path) {
      setEditorNotice(null);
      setEditorBootBusy(false);
      const draft = row.rich_text_draft?.trim() ? row.rich_text_draft : '<p></p>';
      if (!cancelled) {
        setSourceHtml(draft);
        setEditorResetKey((k) => k + 1);
      }
      return;
    }

    setEditorBootBusy(true);
    setEditorNotice(null);

    void (async () => {
      try {
        const { buffer: buf, errorMessage: fetchMsg } = await loadContractDocxBufferFromStorage(path);
        if (cancelled) return;
        if (!buf) {
          setEditorNotice(fetchMsg || '无法从存储读取 Word，编辑器将以草稿或空正文为准');
          setSourceHtml(row.rich_text_draft?.trim() ? row.rich_text_draft! : '<p></p>');
          setEditorResetKey((k) => k + 1);
          return;
        }

        const { value: mammothHtml, messages } = await withTimeout(
          mammoth.convertToHtml({ arrayBuffer: buf }, { includeDefaultStyleMap: true }),
          MAMMOTH_MS,
          'Word 转编辑器 HTML 较慢'
        );
        if (cancelled) return;

        let extractedPlain: string | null = null;
        let displayHtml = mammothHtml?.trim() ? mammothHtml : '';
        if (!htmlToVisibleText(displayHtml)) {
          const { value: rawText } = await withTimeout(
            mammoth.extractRawText({ arrayBuffer: buf }),
            Math.min(MAMMOTH_MS, 12_000),
            '提取纯文本超时'
          );
          if (cancelled) return;
          extractedPlain = rawText?.trim() || null;
        }

        const warn = messages?.filter((m) => m.type === 'error').map((m) => m.message).join('；');
        if (warn) setEditorNotice(`编辑器加载提示：${warn}`);

        const draft = row.rich_text_draft?.trim();
        if (draft) {
          setSourceHtml(draft);
        } else if (mammothHtml?.trim()) {
          setSourceHtml(mammothHtml);
        } else if (extractedPlain) {
          setSourceHtml(
            extractedPlain.
            split(/\n+/).
            map((line) => `<p>${escapeHtmlText(line)}</p>`).
            join('')
          );
        } else {
          setSourceHtml('<p></p>');
        }
        setEditorResetKey((k) => k + 1);
      } catch (e: unknown) {
        if (!cancelled) {
          setEditorNotice((e as Error)?.message || '加载 Word 供编辑失败');
          setSourceHtml(row.rich_text_draft?.trim() ? row.rich_text_draft! : '<p></p>');
          setEditorResetKey((k) => k + 1);
        }
      } finally {
        if (!cancelled) setEditorBootBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [row.id, path, row.rich_text_draft]);

  const openOfficeEmbed = useCallback(async () => {
    if (!path) return;
    setPreviewTab('office');
    setOfficeBusy(true);
    setOfficeErr(null);
    try {
      const { data, error } = await supabase.storage.from(CONTRACT_FILES_STORAGE_BUCKET).createSignedUrl(path, 3600);
      if (error || !data?.signedUrl) {
        const fallback = publicUrlForStoragePath(path);
        setOfficeEmbedUrl(
          `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fallback)}`
        );
        return;
      }
      setOfficeEmbedUrl(
        `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(data.signedUrl)}`
      );
    } catch (e: unknown) {
      setOfficeErr((e as Error)?.message || '无法生成在线预览地址');
    } finally {
      setOfficeBusy(false);
    }
  }, [path]);

  const openGoogleEmbed = useCallback(async () => {
    if (!path) return;
    setPreviewTab('google');
    setGoogleBusy(true);
    setGoogleErr(null);
    try {
      const { data, error } = await supabase.storage.from(CONTRACT_FILES_STORAGE_BUCKET).createSignedUrl(path, 3600);
      const fileUrl = !error && data?.signedUrl ? data.signedUrl : publicUrlForStoragePath(path);
      setGoogleEmbedUrl(`https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(fileUrl)}`);
    } catch (e: unknown) {
      setGoogleErr((e as Error)?.message || '无法生成 Google 预览地址');
    } finally {
      setGoogleBusy(false);
    }
  }, [path]);

  const handleSave = useCallback(async () => {
    const html = editorRef.current?.getHTML() ?? '';
    const plain = html.replace(/<[^>]+>/g, '').trim();
    if (!plain) {
      window.alert('正文为空，无需保存');
      return;
    }
    setSaveBusy(true);
    try {
      await onSaveRevision(html);
      try {
        const { syncHtmlToWord } = await import('../../services/contractGenerationService');
        await syncHtmlToWord(row.id, html, _userId);
      } catch (syncErr: unknown) {
        window.alert(
          `正文已保存，但同步到 Word 失败（ONLYOFFICE 可能仍为旧版）：${(syncErr as Error)?.message || String(syncErr)}`
        );
      }
    } catch (e: unknown) {
      window.alert((e as Error)?.message || '保存失败');
    } finally {
      setSaveBusy(false);
    }
  }, [onSaveRevision, row.id, row.contract_no, _userId]);

  const handleExportDocx = useCallback(async () => {
    const json = editorRef.current?.getJSON();
    if (!json) return;
    setExportBusy(true);
    try {
      const blob = await exportTiptapJsonToDocxBlob(json, row.contract_no || '合同');
      saveAs(blob, `${row.contract_no || 'contract'}-正文.docx`);
    } catch (e: unknown) {
      window.alert((e as Error)?.message || '导出 Word 失败');
    } finally {
      setExportBusy(false);
    }
  }, [row.contract_no]);

  const signedDownload = useCallback(async () => {
    if (!path) return;
    const { data, error } = await supabase.storage.from(CONTRACT_FILES_STORAGE_BUCKET).createSignedUrl(path, 60 * 60 * 4);
    const url = !error && data?.signedUrl ? data.signedUrl : publicUrlForStoragePath(path);
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [path]);

  const pdfPublicUrl = pdfPath ? publicUrlForStoragePath(pdfPath) : '';
  const pdfIframeSrc = pdfEmbedSrc || pdfPublicUrl;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 md:p-6 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium text-gray-900">合同正文</h3>
        <div className="flex flex-wrap gap-2">
          {path ?
          <button
            type="button"
            onClick={() => void signedDownload()}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 bg-white hover:bg-gray-50">
            
              下载原 Word
            </button> :
          null}
          <label className="px-3 py-1.5 text-sm rounded-lg bg-violet-600 text-white cursor-pointer hover:bg-violet-700 disabled:opacity-50 inline-flex items-center gap-1 relative">
            {genDocxBusy ? '上传中…' : '上传 / 替换 Word'}
            <input
              type="file"
              accept=".docx"
              className="ui-file-input-overlay" data-file-upload-field="true"
              disabled={genDocxBusy}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                e.target.value = '';
                if (f) void onUploadDocx(f);
              }} />
            
          </label>
          <button
            type="button"
            disabled={exportBusy}
            onClick={() => void handleExportDocx()}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-800 text-gray-900 hover:bg-gray-50 disabled:opacity-50">
            
            {exportBusy ? '导出中…' : '导出编辑器为 Word'}
          </button>
          <button
            type="button"
            disabled={saveBusy}
            onClick={() => void handleSave()}
            className="px-3 py-1.5 text-sm rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50">
            
            {saveBusy ? '保存中…' : '保存正文 HTML'}
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-500 leading-relaxed">
        <strong>在线预览</strong>：与<strong>合同模板</strong>一致，使用 <strong>docx-preview</strong> 渲染已生成的 .docx；有合并 PDF 时默认打开{' '}
        <strong>PDF</strong>。下方富文本编辑区（TipTap）用于在线修订，初始内容可由 Word 转换（与预览渲染相互独立）；保存后写入{' '}
        <code className="mx-1 text-[11px] bg-gray-100 px-1 rounded">rich_text_draft</code>。
      </p>

      {editorNotice ?
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{editorNotice}</div> :
      null}
      {officeErr ?
      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{officeErr}</div> :
      null}
      {googleErr ?
      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{googleErr}</div> :
      null}

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="text-xs font-medium text-gray-600">在线预览</div>
          {path ?
          <div className="flex flex-wrap gap-1 p-0.5 rounded-lg bg-gray-100 border border-gray-200">
              <button
              type="button"
              className={`px-2.5 py-1 text-xs rounded-md font-medium ${previewTab === 'docx' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              onClick={() => setPreviewTab('docx')}>
              
                Word 预览
              </button>
              {pdfPath ?
            <button
              type="button"
              className={`px-2.5 py-1 text-xs rounded-md font-medium ${previewTab === 'pdf' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              onClick={() => setPreviewTab('pdf')}>
              
                  PDF
                </button> :
            null}
              <button
              type="button"
              disabled={officeBusy}
              className={`px-2.5 py-1 text-xs rounded-md font-medium ${previewTab === 'office' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'} disabled:opacity-50`}
              onClick={() => {
                if (officeEmbedUrl) {
                  setPreviewTab('office');
                  return;
                }
                void openOfficeEmbed();
              }}>
              
                {officeBusy ? '准备中…' : 'Office 在线'}
              </button>
              <button
              type="button"
              disabled={googleBusy}
              className={`px-2.5 py-1 text-xs rounded-md font-medium ${previewTab === 'google' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'} disabled:opacity-50`}
              onClick={() => {
                if (googleEmbedUrl) {
                  setPreviewTab('google');
                  return;
                }
                void openGoogleEmbed();
              }}>
              
                {googleBusy ? '准备中…' : 'Google 预览'}
              </button>
            </div> :
          null}
        </div>

        <div className="relative rounded-lg border border-gray-200 bg-slate-50 overflow-hidden max-h-[min(52vh,560px)] min-h-[220px]">
          {!path ?
          <div className="p-6 text-sm text-gray-500">
              暂无 Word 文件，请上传 .docx；您仍可先在下方编辑正文并保存。
            </div> :
          null}

          {path && previewTab === 'docx' ?
          <DocxStoragePreview
            key={path}
            storagePath={path}
            minHeight={420}
            className="max-h-[min(52vh,560px)] border-0 rounded-none shadow-none" /> :

          null}

          {path && previewTab === 'pdf' && pdfPath ?
          <iframe
            title="合同 PDF 预览"
            src={pdfIframeSrc}
            className="w-full min-h-[min(52vh,560px)] border-0 bg-white" /> :

          null}

          {path && previewTab === 'office' ? (
            officeBusy && !officeEmbedUrl ? (
              <div className="flex items-center justify-center min-h-[min(52vh,560px)] text-sm text-gray-500">
                正在准备 Office 预览…
              </div>
            ) : officeEmbedUrl ? (
              <iframe
                title="Office 在线预览"
                src={officeEmbedUrl}
                className="w-full min-h-[min(52vh,560px)] border-0 bg-white"
                allow="fullscreen"
              />
            ) : (
              <div className="p-6 text-sm text-gray-500">无法加载 Office 预览，请改用 Word 预览、PDF 或 Google 预览。</div>
            )
          ) : null}

          {path && previewTab === 'google' ? (
            googleBusy && !googleEmbedUrl ? (
              <div className="flex items-center justify-center min-h-[min(52vh,560px)] text-sm text-gray-500">
                正在准备 Google 预览…
              </div>
            ) : googleEmbedUrl ? (
              <iframe
                title="Google 文档预览"
                src={googleEmbedUrl}
                className="w-full min-h-[min(52vh,560px)] border-0 bg-white"
                allow="fullscreen"
              />
            ) : (
              <div className="p-6 text-sm text-gray-500">无法加载 Google 预览，请改用其他标签或下载 Word。</div>
            )
          ) : null}
        </div>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
          <div className="text-xs font-medium text-gray-600">富文本编辑</div>
          {editorBootBusy ? <div className="text-xs text-gray-400">正在从 Word 准备编辑器初始内容…</div> : null}
        </div>
        <TiptapContractEditor ref={editorRef} initialHtml={sourceHtml} resetKey={editorResetKey} />
      </div>
    </div>);

}