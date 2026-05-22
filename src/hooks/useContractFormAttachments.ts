import { useCallback, useState } from 'react';
import {
  parseContractAttachmentField,
  persistContractAttachments,
  type ContractAttachmentItem,
} from '../utils/contractAttachments';

/**
 * 合同子业务表单附件（本地上传 + 从已生成合同选择），与收入/支出签约列表 UI 一致。
 */
export function useContractFormAttachments(storageFolder: string) {
  const [attachments, setAttachments] = useState<ContractAttachmentItem[]>([]);

  const reset = useCallback(() => {
    setAttachments([]);
  }, []);

  const loadFromField = useCallback((raw: string | null | undefined) => {
    setAttachments(parseContractAttachmentField(raw));
  }, []);

  const persistForSubmit = useCallback(
    async (recordId?: string) => persistContractAttachments(attachments, storageFolder, recordId),
    [attachments, storageFolder],
  );

  return {
    attachments,
    setAttachments,
    reset,
    loadFromField,
    persistForSubmit,
  };
}
