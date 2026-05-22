/**
 * 将 TipTap / ProseMirror JSON 转为 Word（docx 包），供浏览器端导出。
 * 覆盖：段落、标题、加粗/斜体/下划线、对齐、有序/无序列表、表格、图片（data URL）、链接。
 */
import type { JSONContent } from '@tiptap/core';
import {
  AlignmentType,
  Document as DocxDocument,
  ExternalHyperlink,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  UnderlineType,
  WidthType,
} from 'docx';

const BULLET_REF = 'bullet-contract';
const ORDERED_REF = 'ordered-contract';

type ListKind = 'bullet' | 'ordered' | null;

function headingLevelFromAttrs(level?: number): (typeof HeadingLevel)[keyof typeof HeadingLevel] {
  const lv = level ?? 1;
  if (lv <= 1) return HeadingLevel.HEADING_1;
  if (lv === 2) return HeadingLevel.HEADING_2;
  if (lv === 3) return HeadingLevel.HEADING_3;
  if (lv === 4) return HeadingLevel.HEADING_4;
  if (lv === 5) return HeadingLevel.HEADING_5;
  return HeadingLevel.HEADING_6;
}

function alignmentFromAttrs(textAlign?: string | null): (typeof AlignmentType)[keyof typeof AlignmentType] | undefined {
  if (!textAlign) return undefined;
  if (textAlign === 'center') return AlignmentType.CENTER;
  if (textAlign === 'right') return AlignmentType.RIGHT;
  if (textAlign === 'justify') return AlignmentType.BOTH;
  return AlignmentType.LEFT;
}

function parseDataUrl(
  src: string,
): { type: 'png' | 'jpg' | 'gif' | 'bmp'; data: Uint8Array } | null {
  const m = src.match(/^data:image\/(png|jpeg|jpg|gif|bmp);base64,(.+)$/i);
  if (!m) return null;
  const fmt = m[1].toLowerCase();
  const type = fmt === 'jpeg' || fmt === 'jpg' ? 'jpg' : (fmt as 'png' | 'gif' | 'bmp');
  try {
    const binary = atob(m[2]);
    const len = binary.length;
    const data = new Uint8Array(len);
    for (let i = 0; i < len; i++) data[i] = binary.charCodeAt(i);
    return { type, data };
  } catch {
    return null;
  }
}

function runsFromInlineContent(content: JSONContent[] | undefined): (TextRun | ExternalHyperlink | ImageRun)[] {
  const out: (TextRun | ExternalHyperlink | ImageRun)[] = [];
  if (!content) return out;
  for (const node of content) {
    if (node.type === 'text') {
      const text = node.text ?? '';
      const marks = node.marks ?? [];
      let bold = false;
      let italics = false;
      let underline: { type: (typeof UnderlineType)[keyof typeof UnderlineType] } | undefined;
      let href: string | undefined;
      for (const m of marks) {
        if (m.type === 'bold') bold = true;
        if (m.type === 'italic') italics = true;
        if (m.type === 'underline') underline = { type: UnderlineType.SINGLE };
        if (m.type === 'link' && m.attrs?.href) href = String(m.attrs.href);
      }
      const tr = new TextRun({ text, bold, italics, underline });
      if (href) {
        out.push(
          new ExternalHyperlink({
            link: href,
            children: [tr],
          }),
        );
      } else {
        out.push(tr);
      }
    } else if (node.type === 'hardBreak') {
      out.push(new TextRun({ break: 1 }));
    } else if (node.type === 'image') {
      const src = String(node.attrs?.src ?? '');
      const parsed = parseDataUrl(src);
      if (parsed) {
        const w = Number(node.attrs?.width) || 420;
        const h = Number(node.attrs?.height) || 280;
        out.push(
          new ImageRun({
            type: parsed.type,
            data: parsed.data,
            transformation: { width: Math.min(w, 720), height: Math.min(h, 540) },
          }),
        );
      }
    }
  }
  return out;
}

function paragraphFromBlock(
  node: JSONContent,
  listKind: ListKind,
  listLevel: number,
): Paragraph {
  const align = alignmentFromAttrs(node.attrs?.textAlign as string | undefined);
  const runs = runsFromInlineContent(node.content);
  const children = runs.length ? runs : [new TextRun(' ')];

  if (node.type === 'heading') {
    const level = Number(node.attrs?.level) || 1;
    return new Paragraph({
      heading: headingLevelFromAttrs(level),
      alignment: align,
      children,
    });
  }

  const base: ConstructorParameters<typeof Paragraph>[0] = {
    alignment: align,
    children,
  };

  if (listKind === 'bullet') {
    return new Paragraph({
      ...base,
      numbering: { reference: BULLET_REF, level: listLevel },
    });
  }
  if (listKind === 'ordered') {
    return new Paragraph({
      ...base,
      numbering: { reference: ORDERED_REF, level: listLevel },
    });
  }

  return new Paragraph(base);
}

function flattenListItems(
  listNode: JSONContent,
  kind: ListKind,
  level: number,
): (Paragraph | Table)[] {
  const res: (Paragraph | Table)[] = [];
  for (const item of listNode.content ?? []) {
    if (item.type !== 'listItem') continue;
    for (const child of item.content ?? []) {
      if (child.type === 'paragraph') {
        res.push(paragraphFromBlock(child, kind, level));
      } else if (child.type === 'bulletList') {
        res.push(...flattenListItems(child, 'bullet', level + 1));
      } else if (child.type === 'orderedList') {
        res.push(...flattenListItems(child, 'ordered', level + 1));
      } else if (child.type === 'table') {
        const t = tableToDocx(child);
        if (t) res.push(t);
      }
    }
  }
  return res;
}

function tableToDocx(node: JSONContent): Table | null {
  const rows: TableRow[] = [];
  for (const row of node.content ?? []) {
    if (row.type !== 'tableRow') continue;
    const cells: TableCell[] = [];
    for (const cell of row.content ?? []) {
      if (cell.type !== 'tableCell' && cell.type !== 'tableHeader') continue;
      const inner: (Paragraph | Table)[] = [];
      for (const c of cell.content ?? []) {
        inner.push(...blockToDocxParts(c, null, 0));
      }
      cells.push(
        new TableCell({
          children: inner.length ? inner : [new Paragraph(' ')],
        }),
      );
    }
    if (cells.length) rows.push(new TableRow({ children: cells }));
  }
  if (!rows.length) return null;
  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

function blockToDocxParts(node: JSONContent, listKind: ListKind, listLevel: number): (Paragraph | Table)[] {
  if (node.type === 'paragraph' || node.type === 'heading') {
    return [paragraphFromBlock(node, listKind, listLevel)];
  }
  if (node.type === 'bulletList') {
    return flattenListItems(node, 'bullet', 0);
  }
  if (node.type === 'orderedList') {
    return flattenListItems(node, 'ordered', 0);
  }
  if (node.type === 'table') {
    const t = tableToDocx(node);
    return t ? [t] : [];
  }
  if (node.type === 'blockquote') {
    const inner: (Paragraph | Table)[] = [];
    for (const c of node.content ?? []) {
      inner.push(...blockToDocxParts(c, listKind, listLevel));
    }
    return inner.length ? inner : [new Paragraph(' ')];
  }
  if (node.type === 'horizontalRule') {
    return [new Paragraph({ text: '────────────────────────' })];
  }
  return [new Paragraph(' ')];
}

function docChildrenFromJson(doc: JSONContent): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  for (const node of doc.content ?? []) {
    out.push(...blockToDocxParts(node, null, 0));
  }
  return out.length ? out : [new Paragraph(' ')];
}

export async function exportTiptapJsonToDocxBlob(docJson: JSONContent, title?: string): Promise<Blob> {
  const children = docChildrenFromJson(docJson.type === 'doc' ? docJson : { type: 'doc', content: [] });

  const bulletLevels = [0, 1, 2, 3].map(level => ({
    level,
    format: LevelFormat.BULLET,
    text: '•',
    alignment: AlignmentType.LEFT,
  }));
  const orderedLevels = [0, 1, 2, 3].map(level => ({
    level,
    format: LevelFormat.DECIMAL,
    text: '%1.',
    alignment: AlignmentType.LEFT,
  }));

  const file = new DocxDocument({
    title: title || '合同正文',
    creator: 'construction-management-platform',
    numbering: {
      config: [
        {
          reference: BULLET_REF,
          levels: bulletLevels,
        },
        {
          reference: ORDERED_REF,
          levels: orderedLevels,
        },
      ],
    },
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  return Packer.toBlob(file);
}
