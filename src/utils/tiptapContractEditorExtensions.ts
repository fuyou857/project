/**
 * 与合同正文编辑器（TiptapContractEditor）一致的扩展列表，
 * 供 generateJSON(html, …) 与编辑器实例解析同一套 HTML 结构。
 */
import type { Extensions } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';

export const contractTiptapExtensions: Extensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: false,
  }),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Table.configure({ resizable: false }),
  TableRow,
  TableHeader,
  TableCell,
  Image.configure({ allowBase64: true }),
  Link.configure({ openOnClick: false, autolink: true }),
];
