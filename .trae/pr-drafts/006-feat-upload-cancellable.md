# PR #6: feat(upload): 可取消 & 续传上传

**状态**: 📝 待实现

**估算**: 8h

## 目标

为大文件上传提供可取消能力（AbortController），显示上传进度条和取消按钮，上传失败时支持重试。此 PR 聚焦可取消上传，断点续传（tus/分片）留待后续。

## 变更文件

| 文件 | 变更 |
|------|------|
| `src/services/uploadService.ts` | **新增** — 统一上传服务（支持 AbortController + 进度回调） |
| `src/components/contract/ContractAttachmentManager.tsx` | 集成上传服务，显示进度条和取消按钮 |

## uploadService API

```tsx
// src/services/uploadService.ts
interface UploadOptions {
  file: File;
  bucket: string;
  path: string;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

interface UploadResult {
  path: string;
  url: string;
}

export async function uploadFile({
  file,
  bucket,
  path,
  onProgress,
  signal,
}: UploadOptions): Promise<UploadResult> {
  // 使用 XMLHttpRequest 实现进度监听 + 可取消
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    // 进度监听
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    
    // AbortController 集成
    signal?.addEventListener('abort', () => xhr.abort());
    
    xhr.onload = () => { /* 解析响应 */ };
    xhr.onerror = () => reject(new Error('上传失败'));
    
    xhr.open('PUT', signedUrl);
    xhr.send(file);
  });
}
```

## ContractAttachmentManager 改动

```tsx
// 状态管理
const [uploads, setUploads] = useState<UploadState[]>([]);
// UploadState = { file, progress, status: 'uploading'|'done'|'failed', abort? }

// 渲染
{uploads.map(u => (
  <div key={u.file.name} className="flex items-center gap-2">
    <span className="text-sm truncate">{u.file.name}</span>
    <div className="flex-1 h-2 bg-gray-100 rounded-full">
      <div className="h-full bg-blue-500 rounded-full transition-all"
           style={{ width: `${u.progress}%` }} />
    </div>
    <span className="text-xs text-gray-500">{u.progress}%</span>
    {u.status === 'uploading' && (
      <button
        type="button"
        onClick={() => u.abort?.()}
        className="text-xs text-red-500 hover:text-red-700"
        aria-label="取消上传"
      >
        取消
      </button>
    )}
    {u.status === 'failed' && (
      <button
        type="button"
        onClick={() => retryUpload(u)}
        className="text-xs text-blue-500 hover:text-blue-700"
        aria-label="重试"
      >
        重试
      </button>
    )}
  </div>
))}
```

## 向后兼容

- `uploadService.ts` 是全新的服务文件
- `ContractAttachmentManager` 的 props 接口不变
- 未使用新上传服务的代码不受影响

## 测试步骤

1. 选择大文件上传 → 显示进度条从 0 → 100%
2. 上传中途点击取消 → 上传中止，文件未存储
3. 上传失败 → 显示重试按钮 → 点击重试成功
4. 同时上传多个文件 → 各自独立进度条
5. 网络断开/恢复 → 显示失败状态

## 回退方法

```bash
git revert <merge-commit>
```