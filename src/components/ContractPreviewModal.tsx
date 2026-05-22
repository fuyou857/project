import { useState, useEffect, useCallback } from 'react';
import { X, Download, FileText, History, RefreshCw, Eye, Edit, AlertTriangle, Info } from 'lucide-react';
import {
  getGeneratedContract,
  updateGeneratedContract,
  listRevisions,
  runDocxFillAfterGeneratedContract,
  syncHtmlToWord,
  convertDocxToHtml,
  saveGeneratedRichTextRevision,
  type GeneratedContract,
  type GeneratedRevision } from
'../services/contractGenerationService';
import { uploadFileToStorage } from '../services/contractTemplateLibraryService';
import { convertStorageDocxToPdf } from '../services/contractConvertActions';
import { CONTRACT_FILES_STORAGE_BUCKET, publicUrlForStoragePath, resolveContractStorageAccessUrl } from '../utils/contractDocxStorageFetch';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../supabase/client';
import GeneratedContractRichWorkspace from './contract/GeneratedContractRichWorkspace';
import ContractPreviewHtml from './contract/ContractPreviewHtml';
import OnlyOfficeEditor from './contract/OnlyOfficeEditor';
import type { DocxVariableToken } from '../utils/docxVariables';

function htmlHasVisibleText(html: string | null | undefined): boolean {
  const t = (html || '').replace(/<[^>]+>/g, '').replace(/\s+/g, '').trim();
  return t.length > 0;
}

interface ContractPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  contractId: string;
}

export default function ContractPreviewModal({ isOpen, onClose, contractId }: ContractPreviewModalProps) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [contract, setContract] = useState<GeneratedContract | null>(null);
  const [loading, setLoading] = useState(false);
  const [revisions, setRevisions] = useState<GeneratedRevision[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryFillBusy, setRetryFillBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [revisionDraftOverride, setRevisionDraftOverride] = useState<string | null>(null);
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(null);
  const [showHtmlPreview, setShowHtmlPreview] = useState(false);
  const [showOnlyOffice, setShowOnlyOffice] = useState(false);
  const [onlyOfficeDocUrl, setOnlyOfficeDocUrl] = useState<string | null>(null);
  const [onlyOfficeUrlBusy, setOnlyOfficeUrlBusy] = useState(false);
  const [onlyOfficeUrlHint, setOnlyOfficeUrlHint] = useState<string | null>(null);
  const [htmlTemplate, setHtmlTemplate] = useState('');
  const [htmlVariables, setHtmlVariables] = useState<DocxVariableToken[]>([]);
  const [loadingHtml, setLoadingHtml] = useState(false);
  const [docxStorageUpdatedAt, setDocxStorageUpdatedAt] = useState<string | null>(null);
  const [onlyOfficeUrlNonce, setOnlyOfficeUrlNonce] = useState(0);
  const [syncDraftToWordBusy, setSyncDraftToWordBusy] = useState(false);

  const loadHtmlTemplate = useCallback(async (templateFileVersionId: string) => {
    setLoadingHtml(true);
    try {
      // 从数据库中获取模板文件版本信息，包括存储路径
      const { data: templateVersion, error: versionError } = await supabase.
      from('contract_template_file_versions').
      select('storage_path').
      eq('id', templateFileVersionId).
      single();

      if (versionError) {
        throw new Error('获取模板文件版本信息失败');
      }

      if (!templateVersion?.storage_path) {
        throw new Error('模板文件路径不存在');
      }

      const templateStoragePath = templateVersion.storage_path;
      const { html, variables } = await convertDocxToHtml(templateStoragePath);
      setHtmlTemplate(html);
      setHtmlVariables(variables);
    } catch (e: unknown) {
      console.error('加载HTML模板失败:', e);
      setError((e as Error)?.message || '加载HTML模板失败');
    } finally {
      setLoadingHtml(false);
    }
  }, []);

  const loadContract = useCallback(async () => {
    if (!contractId) return;
    setLoading(true);
    setError(null);
    setRevisionDraftOverride(null);
    setSelectedRevisionId(null);
    try {
      const data = await getGeneratedContract(contractId);
      if (data) {
        setContract(data);
        // 加载HTML模板
        await loadHtmlTemplate(data.template_file_version_id);
      } else {
        setContract(null);
        setHtmlTemplate('');
        setHtmlVariables([]);
      }
      const revData = await listRevisions(contractId);
      setRevisions(revData);
    } catch (e: unknown) {
      setError((e as Error)?.message || '加载合同失败');
    } finally {
      setLoading(false);
    }
  }, [contractId, loadHtmlTemplate]);

  useEffect(() => {
    if (isOpen && contractId) {
      void loadContract();
    }
  }, [isOpen, contractId, loadContract]);

  /** ONLYOFFICE 文档服务器须能访问绝对 HTTPS URL：为已生成 docx 创建签名 URL（或回退公开 URL） */
  useEffect(() => {
    if (!isOpen || !showOnlyOffice || !contract?.generated_docx_storage_path) {
      setOnlyOfficeDocUrl(null);
      setOnlyOfficeUrlHint(null);
      setOnlyOfficeUrlBusy(false);
      return;
    }
    let cancelled = false;
    const path = contract.generated_docx_storage_path;
    setOnlyOfficeUrlBusy(true);
    setOnlyOfficeUrlHint(null);
    setOnlyOfficeDocUrl(null);
    void (async () => {
      try {
        const { url, hint } = await resolveContractStorageAccessUrl(path, 3600);
        if (cancelled) return;
        setOnlyOfficeDocUrl(url);
        setOnlyOfficeUrlHint(hint);
      } catch (e: unknown) {
        if (!cancelled) {
          setOnlyOfficeDocUrl(publicUrlForStoragePath(path));
          setOnlyOfficeUrlHint((e as Error)?.message || '创建签名 URL 异常，已回退到公开链接');
        }
      } finally {
        if (!cancelled) setOnlyOfficeUrlBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, showOnlyOffice, contract?.generated_docx_storage_path, contract?.id, onlyOfficeUrlNonce]);

  /** 读取 Storage 中当前 docx 对象的 updated_at，用于与最近修订时间对比 */
  useEffect(() => {
    if (!isOpen || !showOnlyOffice || !contract?.generated_docx_storage_path) {
      setDocxStorageUpdatedAt(null);
      return;
    }
    let cancelled = false;
    const fullPath = contract.generated_docx_storage_path.trim();
    const lastSlash = fullPath.lastIndexOf('/');
    const folder = lastSlash > 0 ? fullPath.slice(0, lastSlash) : '';
    const fileName = lastSlash > 0 ? fullPath.slice(lastSlash + 1) : fullPath;
    void (async () => {
      try {
        const { data, error } = await supabase.storage.from(CONTRACT_FILES_STORAGE_BUCKET).list(folder, { limit: 200 });
        if (cancelled) return;
        if (error || !data?.length) {
          setDocxStorageUpdatedAt(null);
          return;
        }
        const hit = data.find((o) => o.name === fileName);
        setDocxStorageUpdatedAt(hit?.updated_at ?? null);
      } catch {
        if (!cancelled) setDocxStorageUpdatedAt(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, showOnlyOffice, contract?.generated_docx_storage_path, contract?.id, onlyOfficeUrlNonce]);

  const handleConvertPdf = async () => {
    if (!contract?.generated_docx_storage_path) {
      setError('请先上传或生成Word合同文件');
      return;
    }
    const {
      data: { session }
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setError('登录会话无效或已过期，请重新登录后再试生成 PDF。');
      return;
    }
    setPdfBusy(true);
    setError(null);
    try {
      const outPath = `contract-generated/${contract.id}/contract-${Date.now()}.pdf`;
      await convertStorageDocxToPdf(contract.generated_docx_storage_path, outPath);
      await updateGeneratedContract(contract.id, { merged_pdf_storage_path: outPath }, userId);
      const fresh = await getGeneratedContract(contract.id);
      if (fresh) {
        setContract(fresh);
      }
    } catch (e: unknown) {
      setError((e as Error)?.message || '生成PDF失败');
    } finally {
      setPdfBusy(false);
    }
  };

  const handleSyncDraftToWord = async () => {
    if (!contract) return;
    const effectiveHtml =
    revisionDraftOverride !== null ? revisionDraftOverride : contract.rich_text_draft ?? '';
    if (!htmlHasVisibleText(effectiveHtml)) {
      setError(
        '当前没有可同步的正文草稿。请切换到「正文与编辑」编辑并保存正文，或从「版本历史」载入一版后再试。'
      );
      return;
    }
    setSyncDraftToWordBusy(true);
    setError(null);
    try {
      await syncHtmlToWord(contract.id, effectiveHtml, userId);
      await loadContract();
      setOnlyOfficeUrlNonce((n) => n + 1);
    } catch (e: unknown) {
      setError((e as Error)?.message || '将正文同步到 Word 失败');
    } finally {
      setSyncDraftToWordBusy(false);
    }
  };

  const handlePreviewRevision = async (revision: GeneratedRevision) => {
    setRevisionDraftOverride(revision.rich_text_html || '');
    setSelectedRevisionId(revision.id);
    setShowHistory(false);
  };

  const handleRetryWordFill = async () => {
    if (!contract) return;
    const {
      data: { session }
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setError('登录会话无效或已过期，请重新登录后再试「从模板填充 Word」。');
      return;
    }
    setRetryFillBusy(true);
    setError(null);
    try {
      await runDocxFillAfterGeneratedContract({
        generatedId: contract.id,
        variables: contract.variables_values || {},
        userId
      });
      await loadContract();
      setOnlyOfficeUrlNonce((n) => n + 1);
    } catch (e: unknown) {
      setError(
        (e as Error)?.message ||
        '从模板填充 Word 失败：请确认已部署 contract-document-convert 与 contract-convert 服务，且 Storage 可写。'
      );
    } finally {
      setRetryFillBusy(false);
    }
  };

  const handleUploadDocx = async (file: File) => {
    if (!contract) return;
    setUploadBusy(true);
    setError(null);
    try {
      const path = `contract-generated/${contract.id}/upload-${Date.now()}.docx`;
      await uploadFileToStorage(path, file);
      await updateGeneratedContract(contract.id, { generated_docx_storage_path: path }, userId);
      await loadContract();
      setOnlyOfficeUrlNonce((n) => n + 1);
    } catch (e: unknown) {
      setError((e as Error)?.message || '上传失败');
    } finally {
      setUploadBusy(false);
    }
  };

  const workspaceRow: GeneratedContract | null = contract ?
  {
    ...contract,
    rich_text_draft: revisionDraftOverride !== null ? revisionDraftOverride : contract.rich_text_draft
  } :
  null;

  const effectiveDraftHtml =
  revisionDraftOverride !== null ? revisionDraftOverride : contract?.rich_text_draft ?? '';
  const hasVisibleDraft = htmlHasVisibleText(effectiveDraftHtml);
  const latestRevisionSavedAt = revisions[0]?.created_at ?? null;
  const draftLikelyNewerThanDocx =
  Boolean(
    latestRevisionSavedAt &&
    docxStorageUpdatedAt &&
    !Number.isNaN(new Date(latestRevisionSavedAt).getTime()) &&
    !Number.isNaN(new Date(docxStorageUpdatedAt).getTime()) &&
    new Date(latestRevisionSavedAt).getTime() > new Date(docxStorageUpdatedAt).getTime()
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">合同预览与编辑</h3>
              <p className="text-xs text-gray-500">{contract?.contract_no || '加载中...'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors">
            
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          {loading ? (
                <div className="flex-1 flex items-center justify-center">
              <div className="text-gray-500">加载中...</div>
            </div>
            ) : error && !contract ? (
                  <div className="flex-1 flex items-center justify-center p-4">
              <div className="text-red-600 text-center">{error}</div>
            </div>
            ) : contract ? (
                    <>
              {error ?
                      <div className="mx-4 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {error}
                </div> :
                      null}

              <div className="flex border-b border-gray-200">
                <button
                          type="button"
                          onClick={() => {setShowHistory(false);setShowHtmlPreview(false);}}
                          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                          !showHistory && !showHtmlPreview ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-600 hover:bg-gray-50'}`
                          }>
                          
                  <FileText className="w-4 h-4" /> 正文与编辑
                </button>
                <button
                          type="button"
                          onClick={() => {setShowHistory(true);setShowHtmlPreview(false);}}
                          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                          showHistory ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-600 hover:bg-gray-50'}`
                          }>
                          
                  <History className="w-4 h-4" /> 版本历史
                </button>
                <button
                          type="button"
                          onClick={() => {setShowHistory(false);setShowHtmlPreview(true);setShowOnlyOffice(false);}}
                          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                          showHtmlPreview ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-600 hover:bg-gray-50'}`
                          }>
                          
                  <Eye className="w-4 h-4" /> HTML预览
                </button>
                <button
                          type="button"
                          onClick={() => {setShowHistory(false);setShowHtmlPreview(false);setShowOnlyOffice(true);}}
                          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                          showOnlyOffice ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-600 hover:bg-gray-50'}`
                          }>
                          
                  <Edit className="w-4 h-4" /> ONLYOFFICE编辑器
                </button>
              </div>

              <div className="flex-1 overflow-auto p-4">
                {showHistory ? (
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-900">修订历史记录</h4>
                    {revisions.length === 0 ? (
                      <p className="text-sm text-gray-500">暂无修订记录</p>
                    ) : (
                      <div className="space-y-2">
                        {revisions.map((rev) => (
                          <div
                            key={rev.id}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                            onClick={() => void handlePreviewRevision(rev)}
                          >
                            <div>
                              <span className="font-medium">第 {rev.revision} 版</span>
                              <span className="ml-2 text-sm text-gray-500">
                                {new Date(rev.created_at).toLocaleString('zh-CN')}
                              </span>
                            </div>
                            <button
                              type="button"
                              className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                            >
                              载入编辑器
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : showHtmlPreview ? (
                  <div className="space-y-3">
                    {loadingHtml ? (
                      <div className="flex items-center justify-center h-64 text-gray-500">
                        加载HTML预览中...
                      </div>
                    ) : (
                      <ContractPreviewHtml
                        htmlTemplate={htmlTemplate}
                        variables={contract?.variables_values || {}}
                        variableTokens={htmlVariables}
                        richTextContent={
                          (revisionDraftOverride !== null ? revisionDraftOverride : contract?.rich_text_draft) ?? undefined
                        }
                      />
                    )}
                  </div>
                ) : showOnlyOffice ? (
                  <div className="space-y-3">
                    {contract?.generated_docx_storage_path ? (
                      <>
                        {draftLikelyNewerThanDocx ? (
                          <div className="rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 shadow-sm">
                            <div className="flex gap-3 min-w-0 flex-1">
                              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" aria-hidden />
                              <div className="min-w-0 text-sm">
                                <p className="font-semibold text-amber-950">正文修订可能新于当前 Word 文件</p>
                                <p className="text-amber-900/90 mt-1 text-xs leading-relaxed">
                                  最近保存的正文修订时间为{' '}
                                  <span className="font-mono">
                                    {latestRevisionSavedAt ? new Date(latestRevisionSavedAt).toLocaleString('zh-CN') : '—'}
                                  </span>
                                  ，晚于 Storage 中当前 .docx 的更新时间{' '}
                                  <span className="font-mono">
                                    {docxStorageUpdatedAt ? new Date(docxStorageUpdatedAt).toLocaleString('zh-CN') : '—'}
                                  </span>
                                  。ONLYOFFICE 仍打开的是旧 Word；请点击右侧按钮把当前正文草稿写入 Word 后再查看。
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              disabled={syncDraftToWordBusy || !hasVisibleDraft}
                              onClick={() => void handleSyncDraftToWord()}
                              className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-700 text-white text-sm font-medium hover:bg-amber-800 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                            >
                              <RefreshCw className={`w-4 h-4 ${syncDraftToWordBusy ? 'animate-spin' : ''}`} />
                              {syncDraftToWordBusy ? '正在同步…' : '将正文同步到 Word'}
                            </button>
                          </div>
                        ) : hasVisibleDraft ? (
                          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                            <div className="flex gap-3 min-w-0 flex-1">
                              <Info className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" aria-hidden />
                              <div className="min-w-0 text-sm text-blue-950">
                                <p className="font-medium">HTML 预览与 ONLYOFFICE 数据源不同</p>
                                <p className="text-blue-900/85 mt-1 text-xs leading-relaxed">
                                  HTML 预览优先展示正文草稿；ONLYOFFICE 始终打开 Storage 中的 .docx。若曾在「正文与编辑」中改过字句，建议点右侧按钮同步后再用 ONLYOFFICE 校对。
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              disabled={syncDraftToWordBusy}
                              onClick={() => void handleSyncDraftToWord()}
                              className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-700 text-white text-sm font-medium hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap"
                            >
                              <RefreshCw className={`w-4 h-4 ${syncDraftToWordBusy ? 'animate-spin' : ''}`} />
                              {syncDraftToWordBusy ? '正在同步…' : '将正文同步到 Word'}
                            </button>
                          </div>
                        ) : (
                          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-xs text-gray-600 flex flex-wrap items-center justify-between gap-2">
                            <span>
                              当前无正文草稿；ONLYOFFICE 显示的是模板填充或上传的 Word。若 HTML 预览仅来自模板变量替换，请使用「重试从模板填充 Word」更新 .docx。
                            </span>
                          </div>
                        )}
                        {onlyOfficeUrlBusy ? (
                          <div className="flex items-center justify-center h-64 text-gray-500">
                            正在准备 ONLYOFFICE 文档访问链接…
                          </div>
                        ) : onlyOfficeDocUrl ? (
                                              <>
                            {onlyOfficeUrlHint ?
                                                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                                {onlyOfficeUrlHint}
                              </div> :
                                                null}
                            <OnlyOfficeEditor
                              key={`${onlyOfficeDocUrl}-${onlyOfficeUrlNonce}`}
                              documentUrl={onlyOfficeDocUrl}
                              documentTitle={`${contract.contract_no || '合同'}.docx`}
                              documentKey={`${contract.id}-${onlyOfficeUrlNonce}`}
                              height="600px"
                              forceViewMode
                            />
                          </>
                        ) : (
                          <div className="flex items-center justify-center h-64 text-gray-500">
                            无法生成文档访问链接
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-64 text-gray-500 space-y-2 px-4 text-center text-sm">
                        <p>暂无已生成的 Word 文件。</p>
                        <p className="text-xs text-gray-400 max-w-md">
                          请先使用「正文与编辑」保存表单并生成文档，或点击下方「重试从模板填充 Word」。HTML
                          预览基于模板实时渲染；ONLYOFFICE 打开的是已写入 Storage 的 .docx，两者在未生成 Word 前不一致属预期。
                        </p>
                      </div>
                    )}
                  </div>
                ) : workspaceRow ? (
                                    <GeneratedContractRichWorkspace
                                      key={`${workspaceRow.id}-${selectedRevisionId ?? 'cur'}`}
                                      row={workspaceRow}
                                      userId={userId}
                                      genDocxBusy={uploadBusy}
                                      onSaveRevision={async (html) => {
                                        await saveGeneratedRichTextRevision({
                                          generatedId: contract.id,
                                          html,
                                          userId
                                        });
                                        setRevisionDraftOverride(null);
                                        setSelectedRevisionId(null);
                                        await loadContract();
                                      }}
                                      onUploadDocx={async (f) => {
                                        await handleUploadDocx(f);
                                      }} />
                ) : null}
              }

                {!showHistory && !showHtmlPreview && contract?.seal_annotation ?
                        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                    签章信息：{contract.seal_annotation}
                  </div> :
                        null}

                {!showHistory && contract && !contract.generated_docx_storage_path ?
                        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 space-y-2">
                    <p>尚未生成 Word 文件时，仍可在上方工作区编辑正文；也可重试从模板自动填充。</p>
                    <button
                            type="button"
                            disabled={retryFillBusy}
                            onClick={() => void handleRetryWordFill()}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50">
                            
                      <RefreshCw className={`w-4 h-4 ${retryFillBusy ? 'animate-spin' : ''}`} />
                      {retryFillBusy ? '正在填充…' : '重试从模板填充 Word'}
                    </button>
                  </div> :
                        null}
              </div>

              <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  {contract?.generated_docx_storage_path ?
                          <SignedDownloadButton path={contract.generated_docx_storage_path} label="下载Word" /> :
                          null}
                  {contract?.merged_pdf_storage_path ?
                          <a
                            href={publicUrlForStoragePath(contract.merged_pdf_storage_path)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors">
                            
                      <Download className="w-4 h-4" /> 下载PDF
                    </a> :

                          <button
                            type="button"
                            onClick={() => void handleConvertPdf()}
                            disabled={pdfBusy || !contract?.generated_docx_storage_path}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                            
                      {pdfBusy ?
                            <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          生成PDF中...
                        </> :

                            <>
                          <Download className="w-4 h-4" /> 生成PDF
                        </>
                            }
                    </button>
                          }
                </div>
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">
                  关闭
                </button>
              </div>
            </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
              <div className="text-gray-500">合同不存在</div>
            </div>
            )}
          }
        </div>
      </div>
    </div>);

}

function SignedDownloadButton({ path, label }: {path: string;label: string;}) {
  const onClick = async () => {
    const { url } = await resolveContractStorageAccessUrl(path, 60 * 60 * 4);
    window.open(url, '_blank', 'noopener,noreferrer');
  };
  return (
    <button
      type="button"
      onClick={() => void onClick()}
      className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
      
      <Download className="w-4 h-4" /> {label}
    </button>);

}