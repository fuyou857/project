import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { FaArrowLeft, FaDownload, FaListUl, FaSave } from 'react-icons/fa';
import { saveAs } from 'file-saver';
import OnlyOfficeEditor, { preloadOnlyOfficeEnvironment } from '../../components/contract/OnlyOfficeEditor';
import {
  getGeneratedContract,
  type GeneratedContract,
} from '../../services/contractGenerationService';
import { preferSignedStorageUrlWithHint } from '../../utils/contractDocxStorageFetch';
import type { DraftEditorLocationState } from './draftEditorLocationState';

function GeneratedContractDraftEditorPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const navState = (location.state ?? null) as DraftEditorLocationState | null;
  const { contractId } = useParams<{ contractId: string }>();
  const [contract, setContract] = useState<GeneratedContract | null>(navState?.contract ?? null);
  const [documentUrl, setDocumentUrl] = useState(navState?.documentUrl?.trim() ?? '');
  const [urlHint, setUrlHint] = useState<string | null>(navState?.urlHint ?? null);
  const [loading, setLoading] = useState(!navState?.documentUrl?.trim());
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    preloadOnlyOfficeEnvironment();
  }, []);

  useEffect(() => {
    if (!contractId) {
      navigate('/contract/templates/my-generated');
      return;
    }

    if (navState?.documentUrl?.trim()) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      setDocumentUrl('');
      setUrlHint(null);
      try {
        const row = await getGeneratedContract(contractId);
        if (!row) {
          if (!cancelled) setErr('合同草稿不存在或已删除');
          return;
        }
        if (!row.generated_docx_storage_path) {
          if (!cancelled) setErr('合同副本 Word 尚未就绪，请返回列表重试');
          return;
        }
        const { url, hint } = await preferSignedStorageUrlWithHint(row.generated_docx_storage_path);
        if (cancelled) return;
        setContract(row);
        setDocumentUrl(url);
        setUrlHint(hint);
      } catch (e: unknown) {
        if (!cancelled) setErr((e as Error)?.message || '加载合同草稿失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [contractId, navigate, navState?.documentUrl]);

  const handleDownload = async () => {
    if (!documentUrl || !contract) return;
    try {
      const res = await fetch(documentUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      saveAs(blob, `${contract.contract_no || 'contract-draft'}.docx`);
    } catch (e: unknown) {
      setErr((e as Error)?.message || '下载失败');
    }
  };

  const handleSaveHint = () => {
    window.alert(
      '正在编辑的是合同草稿副本，不会修改系统模板原文件。\n\n' +
        '请在 ONLYOFFICE 内使用「保存」或等待自动保存；保存结果会写回本合同的 Storage 路径。\n' +
        '关闭本页后可在「我生成的合同」列表中查看该草稿（状态：草稿）。',
    );
  };

  const callbackQuery = contractId ? `generated_contract_id=${contractId}` : undefined;
  const showEditorShell = Boolean(documentUrl && contractId);

  return (
    <div className="w-full min-w-0 px-4 py-6 sm:px-5 md:p-6">
      <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
        <p className="font-medium">合同草稿 · 在线编辑</p>
        <p className="mt-1 text-xs leading-relaxed text-blue-900/90">
          当前打开的是从模板<strong>复制</strong>的 Word 副本（编号 {contract?.contract_no ?? '—'}）。
          保存只更新本合同，<strong>不会改动模板库中的原模板</strong>。
        </p>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="inline-flex items-center px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            onClick={() =>
              navigate(
                `/contract/templates/my-generated?contract=${encodeURIComponent(contractId ?? '')}`,
              )
            }
          >
            <FaArrowLeft className="mr-2 shrink-0" />
            返回合同详情
          </button>
          <button
            type="button"
            className="inline-flex items-center px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            onClick={() => navigate('/contract/templates/my-generated')}
          >
            <FaListUl className="mr-2 shrink-0" />
            我生成的合同
          </button>
          <h1 className="text-lg font-semibold text-gray-900">
            {contract?.contract_no ?? '合同草稿'}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex items-center px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40"
            disabled={!documentUrl}
            onClick={() => void handleDownload()}
          >
            <FaDownload className="mr-2 shrink-0" />
            下载 Word
          </button>
          <button
            type="button"
            className="inline-flex items-center px-3 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            onClick={handleSaveHint}
          >
            <FaSave className="mr-2 shrink-0" />
            保存说明
          </button>
        </div>
      </div>

      {err ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {err}
        </div>
      ) : null}
      {urlHint ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
          {urlHint}
        </div>
      ) : null}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-3 sm:p-4 min-h-[720px]">
        {loading && !showEditorShell ? (
          <div className="flex flex-col items-center justify-center py-24 text-sm text-gray-500 gap-3">
            <span className="inline-block animate-spin h-10 w-10 border-4 border-blue-300 rounded-full border-t-blue-600" />
            <span>正在准备合同副本与文档链接…</span>
          </div>
        ) : null}
        {showEditorShell ? (
          <OnlyOfficeEditor
            documentUrl={documentUrl}
            documentTitle={`${contract?.contract_no || '合同草稿'}.docx`}
            documentKey={contractId}
            onlyOfficeCallbackQuery={callbackQuery}
            height="700px"
            forceViewMode={false}
          />
        ) : null}
        {!loading && !showEditorShell ? (
          <p className="text-sm text-gray-500 py-16 text-center">无法加载合同 Word 副本</p>
        ) : null}
      </div>
    </div>
  );
}

export default GeneratedContractDraftEditorPage;
