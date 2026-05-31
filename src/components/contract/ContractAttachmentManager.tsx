import { useCallback, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { FaFilePdf, FaFileWord, FaLink, FaPlus, FaTimes, FaUpload } from 'react-icons/fa';
import { listGeneratedContracts } from '../../services/contractGenerationService';
import type { ContractAttachmentItem } from '../../utils/contractAttachments';

type ContractAttachmentManagerProps = {
  attachments: ContractAttachmentItem[];
  onAttachmentsChange: (items: ContractAttachmentItem[]) => void;
  onNotifyError?: (message: string) => void;
};

export default function ContractAttachmentManager({
  attachments,
  onAttachmentsChange,
  onNotifyError,
}: ContractAttachmentManagerProps) {
  const [showSelector, setShowSelector] = useState(false);
  const [generatedContracts, setGeneratedContracts] = useState<any[]>([]);
  const [loadingGenerated, setLoadingGenerated] = useState(false);
  const localFileInputRef = useRef<HTMLInputElement>(null);

  const notify = useCallback(
    (message: string) => {
      if (onNotifyError) onNotifyError(message);
      else console.error(message);
    },
    [onNotifyError],
  );

  const handleLocalFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const added: ContractAttachmentItem[] = Array.from(files).map((file) => ({
        name: file.name,
        type: 'local',
        file,
        size: file.size,
      }));
      onAttachmentsChange([...attachments, ...added]);
    }
    e.target.value = '';
  };

  const loadGeneratedContracts = async () => {
    try {
      setLoadingGenerated(true);
      const data = await listGeneratedContracts();
      setGeneratedContracts(data || []);
    } catch (err) {
      console.error('加载已生成合同失败:', err);
      notify('加载已生成合同列表失败');
    } finally {
      setLoadingGenerated(false);
    }
  };

  const handleAddGenerated = (contract: {
    id: string;
    contract_no?: string;
    contract_templates?: { title?: string } | null;
  }) => {
    onAttachmentsChange([
      ...attachments,
      {
        name: `${contract.contract_no || '合同'} - ${contract.contract_templates?.title || '合同'}`,
        type: 'generated',
        generatedContractId: contract.id,
      },
    ]);
    setShowSelector(false);
  };

  const handleRemove = (index: number) => {
    onAttachmentsChange(attachments.filter((_, i) => i !== index));
  };

  return (
    <>
      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-gray-800">附件管理</h4>
          <div className="flex gap-2">
            {/* 隐藏的 file input — 使用 React ref 替代 document.createElement */}
            <input
              type="file"
              ref={localFileInputRef}
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
              onChange={handleLocalFileSelect}
              className="hidden"
              aria-label="选择本地文件上传"
            />
            <button
              type="button"
              onClick={() => localFileInputRef.current?.click()}
              className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 flex items-center gap-1"
            >
              <FaUpload className="w-3.5 h-3.5" />
              本地上传
            </button>
            <button
              type="button"
              onClick={async () => {
                await loadGeneratedContracts();
                setShowSelector(true);
              }}
              className="px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-md hover:bg-green-200 flex items-center gap-1"
            >
              <FaLink className="w-3.5 h-3.5" />
              从已生成合同选择
            </button>
          </div>
        </div>

        {attachments.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">暂无附件</p>
        ) : (
          <div className="space-y-2">
            {attachments.map((attachment, index) => (
              <div
                key={`${attachment.type}-${attachment.name}-${index}`}
                className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {attachment.type === 'local' ? (
                    attachment.name.toLowerCase().endsWith('.pdf') ? (
                      <FaFilePdf className="text-red-500 shrink-0" />
                    ) : (
                      <FaFileWord className="text-blue-500 shrink-0" />
                    )
                  ) : (
                    <FaLink className="text-green-600 shrink-0" />
                  )}
                  <span className="text-sm text-gray-700 truncate">{attachment.name}</span>
                  {attachment.size ? (
                    <span className="text-xs text-gray-400 shrink-0">
                      ({(attachment.size / 1024).toFixed(1)} KB)
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  className="text-gray-400 hover:text-red-500 shrink-0"
                >
                  <FaTimes className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showSelector ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]"
          onClick={() => setShowSelector(false)}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[70vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-lg font-bold text-gray-800">选择已生成的合同作为附件</h4>
              <button
                type="button"
                onClick={() => setShowSelector(false)}
                className="text-gray-500 hover:text-gray-800"
              >
                <FaTimes />
              </button>
            </div>

            {loadingGenerated ? (
              <div className="py-8 text-center text-gray-500">加载中...</div>
            ) : generatedContracts.length === 0 ? (
              <div className="py-8 text-center text-gray-500">暂无已生成的合同</div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {generatedContracts.map((contract) => (
                  <button
                    key={contract.id}
                    type="button"
                    onClick={() => handleAddGenerated(contract)}
                    className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-blue-50 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium text-gray-800">{contract.contract_no}</div>
                      <div className="text-sm text-gray-500">
                        {contract.contract_templates?.title || '合同'} ·{' '}
                        {new Date(contract.created_at).toLocaleString('zh-CN')}
                      </div>
                    </div>
                    <FaPlus className="text-blue-500 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </>
  );
}
