import { useCallback, useEffect, useImperativeHandle, forwardRef, useRef } from 'react';
import type { JSONContent } from '@tiptap/core';
import { useEditor, EditorContent } from '@tiptap/react';
import { contractTiptapExtensions } from '../../utils/tiptapContractEditorExtensions';
import './tiptap-contract-editor.css';

export type TiptapContractEditorHandle = {
  getHTML: () => string;
  getJSON: () => JSONContent;
  setContentFromHtml: (html: string) => void;
  focus: () => void;
};

type Props = {
  /** 用于从服务端或 mammoth 注入 HTML */
  initialHtml: string;
  /** 变化时执行 setContent（不销毁编辑器实例） */
  resetKey: number;
  className?: string;
  disabled?: boolean;
};

const TiptapContractEditor = forwardRef<TiptapContractEditorHandle, Props>(function TiptapContractEditor(
  { initialHtml, resetKey, className = '', disabled = false },
  ref,
) {
  const lastResetKey = useRef(resetKey);
  const lastInitial = useRef(initialHtml);

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: contractTiptapExtensions,
      content: '<p></p>',
      editable: !disabled,
      editorProps: {
        attributes: {
          class: 'prose prose-sm max-w-none focus:outline-none',
        },
      },
    },
    [],
  );

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    if (!editor) return;
    const keyChanged = resetKey !== lastResetKey.current;
    const htmlChanged = initialHtml !== lastInitial.current;
    if (keyChanged || htmlChanged) {
      lastResetKey.current = resetKey;
      lastInitial.current = initialHtml;
      const html = initialHtml?.trim() ? initialHtml : '<p></p>';
      editor.commands.setContent(html, { emitUpdate: false });
    }
  }, [editor, initialHtml, resetKey]);

  useImperativeHandle(
    ref,
    () => ({
      getHTML: () => editor?.getHTML() ?? '',
      getJSON: () => editor?.getJSON() ?? { type: 'doc', content: [] },
      setContentFromHtml: (html: string) => {
        editor?.commands.setContent(html?.trim() ? html : '<p></p>', { emitUpdate: false });
      },
      focus: () => editor?.commands.focus(),
    }),
    [editor],
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  const insertTable = useCallback(() => {
    if (!editor) return;
    const rs = window.prompt('表格行数', '3');
    const cs = window.prompt('表格列数', '3');
    const rows = Math.min(20, Math.max(1, parseInt(rs || '3', 10) || 3));
    const cols = Math.min(10, Math.max(1, parseInt(cs || '3', 10) || 3));
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
  }, [editor]);

  const onPickImage = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file || !editor) return;
      if (!file.type.startsWith('image/')) {
        window.alert('请选择图片文件');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const src = typeof reader.result === 'string' ? reader.result : '';
        if (src) {
          editor.chain().focus().setImage({ src }).run();
        }
      };
      reader.readAsDataURL(file);
    },
    [editor],
  );

  if (!editor) {
    return <div className={`rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500 ${className}`}>编辑器加载中…</div>;
  }

  return (
    <div className={`contract-tiptap-editor rounded-lg border border-gray-200 bg-white ${className}`}>
      <div className="flex flex-wrap gap-1 border-b border-gray-200 bg-gray-50 px-2 py-1.5">
        <ToolbarBtn label="B" title="加粗" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} />
        <ToolbarBtn label="I" title="斜体" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} />
        <ToolbarBtn label="U" title="下划线" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} />
        <span className="w-px bg-gray-300 mx-0.5 self-stretch" />
        <ToolbarBtn label="H1" title="标题1" active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} />
        <ToolbarBtn label="H2" title="标题2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
        <ToolbarBtn label="H3" title="标题3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
        <span className="w-px bg-gray-300 mx-0.5 self-stretch" />
        <ToolbarBtn label="左" title="左对齐" onClick={() => editor.chain().focus().setTextAlign('left').run()} />
        <ToolbarBtn label="中" title="居中" onClick={() => editor.chain().focus().setTextAlign('center').run()} />
        <ToolbarBtn label="右" title="右对齐" onClick={() => editor.chain().focus().setTextAlign('right').run()} />
        <ToolbarBtn label="齐" title="两端对齐" onClick={() => editor.chain().focus().setTextAlign('justify').run()} />
        <span className="w-px bg-gray-300 mx-0.5 self-stretch" />
        <ToolbarBtn label="•" title="无序列表" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} />
        <ToolbarBtn label="1." title="有序列表" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
        <span className="w-px bg-gray-300 mx-0.5 self-stretch" />
        <button
          type="button"
          title="插入表格"
          onClick={insertTable}
          className="px-2 py-0.5 text-xs rounded border border-gray-300 bg-white hover:bg-gray-100"
        >
          表格
        </button>
        <button
          type="button"
          title="插入图片"
          onClick={() => fileInputRef.current?.click()}
          className="px-2 py-0.5 text-xs rounded border border-gray-300 bg-white hover:bg-gray-100"
        >
          图片
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="ui-file-input-safe" data-file-upload-field="true" onChange={onPickImage} />
      </div>
      <EditorContent editor={editor} className="max-h-[min(50vh,420px)] overflow-y-auto" />
    </div>
  );
});

function ToolbarBtn({
  label,
  title,
  active,
  onClick,
}: {
  label: string;
  title: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`min-w-[1.75rem] px-1.5 py-0.5 text-xs rounded border ${
        active ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 bg-white hover:bg-gray-100'
      }`}
    >
      {label}
    </button>
  );
}

export default TiptapContractEditor;
