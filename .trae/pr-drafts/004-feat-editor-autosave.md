# PR #4: feat(editor): 草稿自动保存（Autosave）

**状态**: 📝 待实现

**估算**: 4h

## 目标

在合同草稿编辑器中实现自动保存机制，防止用户因意外（断网、浏览器崩溃、误关页面）丢失编辑内容。显示「已保存/保存中」状态指示器，并在检测到服务端版本冲突时提示用户。

## 变更文件

| 文件 | 变更 |
|------|------|
| `src/hooks/useAutosave.ts` | **新增** — 自动保存 hook |
| `src/pages/contract/GeneratedContractDraftEditorPage.tsx` | 集成 useAutosave，添加保存状态指示器 |

## useAutosave API

```tsx
const { status, triggerSave } = useAutosave({
  key: `draft:${contractId}`,        // localStorage key 用于崩溃恢复
  debounceMs: 2000,                   // 防抖间隔
  onSave: async (content) => {
    // 调用后台 sync API
    await editorService.syncDraft(contractId, content);
  },
  onConflict: (serverVersion) => {
    // 服务端版本新于本地时的处理
    showToast('warning', '服务端有更新版本，请手动处理冲突');
  },
});

// status: 'saved' | 'saving' | 'unsaved' | 'conflict' | 'error'
```

## 保存状态指示器

```tsx
// UI 角标
<span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
  status === 'saved'   ? 'bg-green-100 text-green-700'  :
  status === 'saving'  ? 'bg-blue-100 text-blue-700'    :
  status === 'error'   ? 'bg-red-100 text-red-700'      :
                         'bg-gray-100 text-gray-500'
}`}>
  {status === 'saved'   && '✓ 已保存'}
  {status === 'saving'  && '⟳ 保存中'}
  {status === 'unsaved' && '○ 未保存'}
  {status === 'error'   && '✗ 保存失败'}
</span>
```

## useAutosave 实现要点

```tsx
// src/hooks/useAutosave.ts
export function useAutosave({ key, debounceMs, onSave, onConflict }) {
  const [status, setStatus] = useState<SaveStatus>('saved');
  const lastSavedRef = useRef<string>('');
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // 防抖保存
  const handleChange = useCallback((content: string) => {
    setStatus('unsaved');
    // 写入 localStorage 用于崩溃恢复
    localStorage.setItem(key, content);
    
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setStatus('saving');
      try {
        const result = await onSave(content);
        if (result?.conflict) {
          setStatus('conflict');
          onConflict?.(result.serverVersion);
        } else {
          setStatus('saved');
          lastSavedRef.current = content;
        }
      } catch {
        setStatus('error');
      }
    }, debounceMs);
  }, [key, debounceMs, onSave, onConflict]);

  // 页面关闭前尝试同步保存
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (status === 'unsaved') {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [status]);

  // 启动时尝试从 localStorage 恢复
  useEffect(() => {
    const saved = localStorage.getItem(key);
    if (saved) {
      // 显示恢复提示
    }
  }, [key]);

  return { status, triggerSave: () => handleChange };
}
```

## 向后兼容

- 纯新增功能，不影响现有保存流程
- OnlyOffice 编辑器的服务端保存回调保持不变
- useAutosave 仅作为前端辅助，不强制同步

## 测试步骤

1. 在草稿编辑器中输入内容 → 等待 2s → 显示「已保存」
2. 断网编辑 → 显示「未保存」→ localStorage 中有草稿
3. 刷新页面 → 提示恢复草稿
4. 服务端版本冲突 → 显示冲突提示

## 回退方法

```bash
git revert <merge-commit>
```