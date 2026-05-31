import { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
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
import { useFocusTrap } from '../hooks/useFocusTrap';
import { supabase } from '../supabase/client';
import GeneratedContractRichWorkspace from './contract/GeneratedContractRichWorkspace';
import ContractPreviewHtml from './contract/ContractPreviewHtml';
import PreviewModalHeader from './contract/PreviewModalHeader';
import PreviewModalFooter from './contract/PreviewModalFooter';
import PreviewHistoryPanel from './contract/PreviewHistoryPanel';
import PreviewOnlyOfficePanel from './contract/PreviewOnlyOfficePanel';
import { PreviewSkeleton } from './Skeleton';
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
  const modalRef = useFocusTrap(isOpen, onClose);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" ref={modalRef}>
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl">
        <PreviewModalHeader contractNo={contract?.contract_no ?? null} onClose={onClose} />

        <div className="flex-1 overflow-hidden flex flex-col" aria-live="polite" aria-busy={loading}>
          {loading ? (
            <div className="flex-1 flex items-center justify-center p-8" role="status">
              <PreviewSkeleton height="300px" />
            </div>
          ) : error && !contract ? (
            <div className="flex-1 flex items-center justify-center p-4" role="alert">
              <div className="text-red-600 text-center">{error}</div>
            </div>
          ) : contract ? (
            <>
              {error && (
                <div className="mx-4 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
                  {error}
                </div>
              )}

              <div className="flex border-b border-gray-200" role="tablist" aria-label="预览模式">
                {[
                  { key: 'workspace', label: '正文与编辑', icon: 'FileText', active: !showHistory && !showHtmlPreview },
                  { key: 'history', label: '版本历史', icon: 'History', active: showHistory },
                  { key: 'html', label: 'HTML预览', icon: 'Eye', active: showHtmlPreview },
                  { key: 'onlyoffice', label: 'ONLYOFFICE编辑器', icon: 'Edit', active: showOnlyOffice },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={tab.active}
                    onClick={() => {
                      setShowHistory(tab.key === 'history');
                      setShowHtmlPreview(tab.key === 'html');
                      setShowOnlyOffice(tab.key === 'onlyoffice');
                    }}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                      tab.active ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-auto p-4">
                {showHistory && (
                  <PreviewHistoryPanel
                    revisions={revisions}
                    loading={false}
                    onPreviewRevision={handlePreviewRevision}
                  />
                )}

                {showHtmlPreview && (
                  <div className="space-y-3">
                    {loadingHtml ? (
                      <div role="status" aria-live="polite">
                        <PreviewSkeleton height="300px" />
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
                )}

                {showOnlyOffice && contract && (
                  <PreviewOnlyOfficePanel
                    contract={contract}
                    syncDraftToWordBusy={syncDraftToWordBusy}
                    hasVisibleDraft={hasVisibleDraft}
                    draftLikelyNewerThanDocx={draftLikelyNewerThanDocx}
                    latestRevisionSavedAt={latestRevisionSavedAt}
                    docxStorageUpdatedAt={docxStorageUpdatedAt}
                    onlyOfficeUrlBusy={onlyOfficeUrlBusy}
                    onlyOfficeDocUrl={onlyOfficeDocUrl}
                    onlyOfficeUrlHint={onlyOfficeUrlHint}
                    onlyOfficeUrlNonce={onlyOfficeUrlNonce}
                    onSyncDraftToWord={() => void handleSyncDraftToWord()}
                  />
                )}

                {!showHistory && !showHtmlPreview && !showOnlyOffice && workspaceRow && (
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
                    }}
                  />
                )}

                {!showHistory && !showHtmlPreview && contract?.seal_annotation && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                    签章信息：{contract.seal_annotation}
                  </div>
                )}

                {!showHistory && contract && !contract.generated_docx_storage_path && (
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 space-y-2">
                    <p>尚未生成 Word 文件时，仍可在上方工作区编辑正文；也可重试从模板自动填充。</p>
                    <button
                      type="button"
                      disabled={retryFillBusy}
                      onClick={() => void handleRetryWordFill()}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
                      aria-busy={retryFillBusy}
                    >
                      <RefreshCw className={`w-4 h-4 ${retryFillBusy ? 'animate-spin' : ''}`} />
                      {retryFillBusy ? '正在填充…' : '重试从模板填充 Word'}
                    </button>
                  </div>
                )}
              </div>

              <PreviewModalFooter
                contract={contract}
                pdfBusy={pdfBusy}
                onConvertPdf={() => void handleConvertPdf()}
                onClose={onClose}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-gray-500">合同不存在</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}