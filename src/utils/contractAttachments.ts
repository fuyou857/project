import { getGeneratedContract } from '../services/contractGenerationService';
import { uploadFileToStorage } from '../services/contractTemplateLibraryService';
import {
  CONTRACT_FILES_STORAGE_BUCKET,
  preferSignedStorageUrlWithHint,
  publicUrlForStoragePath,
} from './contractDocxStorageFetch';

export type ContractAttachmentItem = {
  name: string;
  type: 'local' | 'generated';
  file?: File;
  url?: string;
  generatedContractId?: string;
  size?: number;
};

type StoredContractAttachment = {
  name: string;
  type: 'local' | 'generated';
  url: string;
  generatedContractId?: string;
};

const BUNDLE_PREFIX = '{"ciond_attachments":';

function sanitizeStorageFileName(fileName: string): string {
  return (fileName || 'file')
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 180);
}

function isBundle(raw: string): boolean {
  return raw.trim().startsWith(BUNDLE_PREFIX);
}

/** 从库字段 attachment_url 还原附件列表（兼容历史纯 URL 字符串） */
export function parseContractAttachmentField(raw: string | null | undefined): ContractAttachmentItem[] {
  const t = (raw || '').trim();
  if (!t) return [];
  if (isBundle(t)) {
    try {
      const parsed = JSON.parse(t) as { ciond_attachments?: StoredContractAttachment[] };
      const items = parsed?.ciond_attachments;
      if (!Array.isArray(items)) return [];
      return items
        .filter((x) => x?.url)
        .map((x) => ({
          name: x.name || '附件',
          type: x.type === 'generated' ? 'generated' : 'local',
          url: x.url,
          generatedContractId: x.generatedContractId,
        }));
    } catch {
      return [{ name: '附件', type: 'local', url: t }];
    }
  }
  return [{ name: t.split('/').pop() || '附件', type: 'local', url: t }];
}

/** 写入 attachment_url 字段 */
export function serializeContractAttachmentField(items: StoredContractAttachment[]): string | null {
  if (!items.length) return null;
  if (items.length === 1) return items[0].url;
  return JSON.stringify({ ciond_attachments: items });
}

/**
 * 上传本地文件 / 解析已生成合同 docx 链接，返回可存入 attachment_url 的字符串。
 */
export async function persistContractAttachments(
  items: ContractAttachmentItem[],
  storageFolder: string,
  recordId?: string,
): Promise<string | null> {
  if (!items.length) return null;
  const baseId = recordId || `draft-${Date.now()}`;
  const resolved: StoredContractAttachment[] = [];

  for (const item of items) {
    if (item.type === 'generated' && item.generatedContractId) {
      const row = await getGeneratedContract(item.generatedContractId);
      const path = row?.generated_docx_storage_path?.trim();
      if (!path) continue;
      const { url } = await preferSignedStorageUrlWithHint(path);
      resolved.push({
        name: item.name,
        type: 'generated',
        url,
        generatedContractId: item.generatedContractId,
      });
      continue;
    }

    if (item.type === 'local') {
      if (item.url && !item.file) {
        resolved.push({ name: item.name, type: 'local', url: item.url });
        continue;
      }
      if (!item.file) continue;
      const path = `contract-attachments/${storageFolder}/${baseId}/${crypto.randomUUID()}_${sanitizeStorageFileName(item.file.name)}`;
      await uploadFileToStorage(path, item.file);
      resolved.push({
        name: item.name,
        type: 'local',
        url: publicUrlForStoragePath(path),
      });
    }
  }

  return serializeContractAttachmentField(resolved);
}

export { CONTRACT_FILES_STORAGE_BUCKET };
