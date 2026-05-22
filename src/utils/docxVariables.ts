import JSZip from 'jszip';

export type DocxVariableKind = 'text' | 'image' | 'file';

/** 与模板中占位符一致，用于回填替换 */
export interface DocxVariableToken {
  /** 完整占位符，如 {{甲方名称}} 或 {{图片:身份证正面}} */
  placeholder: string;
  kind: DocxVariableKind;
  /** 展示/表单用短名（不含大括号）；与 Word 中 {{}} 内文本一致，供 fill_docx 注入键 */
  label: string;
}

const PLACEHOLDER_RE = /\{\{([^}]+)\}\}/g;

/** 从完整占位符解析出 {{…}} 内原文（供与数据库旧数据对齐后重新分类） */
export function innerFromPlaceholder(placeholder: string): string {
  const s = (placeholder || '').trim();
  const m = /^\{\{([\s\S]*?)\}\}$/.exec(s);
  return m ? m[1] : s.replace(/^(?:\{\{)|(?:\}\})$/g, '').trim();
}

/**
 * 去除零宽字符、不间断空格等，并 NFC 规范化，避免 Word 复制出的「同形字串」导致关键字匹配失败。
 */
export function sanitizeVariableInner(inner: string): string {
  return (inner || '')
    .replace(/[\u200B-\u200D\uFEFF\u2060]/g, '')
    .replace(/\u00A0/g, ' ')
    .normalize('NFC')
    .trim();
}

/**
 * 变量名包含以下任一子串时，识别为图片上传（模糊包含、不区分大小写仅作用于 ASCII 段）。
 * 与产品约定一致；显式前缀「图片:」「文件:」仍优先。
 */
export const DOCX_IMAGE_VAR_KEYWORDS = [
  '正面',
  '反面',
  '营业执照',
  '身份证',
  '头像',
  '清单',
  '开户许可',
  '证书',
  '证',
] as const;

/** Word 正文命名空间（document.xml / header 等） */
const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

/**
 * Word 将占位符拆在多个 <w:t> 中时，对原始 XML 做正则会得到 XML 碎片「乱码」。
 * 按文档树顺序拼接所有 w:t 的纯文本后再匹配 {{…}}。
 */
function mergeWordTextNodesFromDocumentXml(xml: string): string {
  if (typeof DOMParser === 'undefined') {
    return mergeWordTextNodesFallback(xml);
  }
  try {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length > 0) {
      return mergeWordTextNodesFallback(xml);
    }
    if (!doc.documentElement) {
      return mergeWordTextNodesFallback(xml);
    }
    const buf: string[] = [];
    const walk = (node: Node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        if (el.namespaceURI === W_NS && el.localName === 't') {
          buf.push(el.textContent ?? '');
          return;
        }
      }
      node.childNodes.forEach(walk);
    };
    walk(doc.documentElement);
    return buf.join('');
  } catch {
    return mergeWordTextNodesFallback(xml);
  }
}

function mergeWordTextNodesFallback(xml: string): string {
  const parts: string[] = [];
  const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    let chunk = m[1];
    chunk = chunk
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
    parts.push(chunk);
  }
  return parts.join('');
}

/** 显式「图片:」「文件:」前缀之外，若含半角冒号则不作为关键字图片类，避免 Jinja 语法错误 */
function hasIllegalAsciiColonOutsidePrefix(sanitizedInner: string): boolean {
  const t = sanitizedInner.trim();
  if (/^(图片|Image)[:：]/i.test(t) || /^(文件|File)[:：]/i.test(t)) {
    return false;
  }
  return t.includes(':');
}

export function variableNameMatchesImageKeywords(inner: string): boolean {
  const t = sanitizeVariableInner(inner);
  if (!t) return false;
  const lower = t.toLowerCase();
  for (const kw of DOCX_IMAGE_VAR_KEYWORDS) {
    if (t.includes(kw)) return true;
    const kl = kw.toLowerCase();
    if (kl !== kw && lower.includes(kl)) return true;
  }
  return false;
}

function normalizeLabel(inner: string): { kind: DocxVariableKind; label: string } {
  const t = sanitizeVariableInner(inner);
  const imgPrefix = /^图片[:：]\s*|^Image[:：]\s*/i;
  if (imgPrefix.test(t)) {
    return { kind: 'image', label: t.replace(imgPrefix, '').trim() || t };
  }
  const filePrefix = /^文件[:：]\s*|^File[:：]\s*/i;
  if (filePrefix.test(t)) {
    return { kind: 'file', label: t.replace(filePrefix, '').trim() || t };
  }
  if (!hasIllegalAsciiColonOutsidePrefix(t) && variableNameMatchesImageKeywords(t)) {
    return { kind: 'image', label: t };
  }
  return { kind: 'text', label: t };
}

/** 导出供单测或调试：根据 {{}} 内文本判定变量类型 */
export function classifyDocxPlaceholderInner(inner: string): { kind: DocxVariableKind; label: string } {
  return normalizeLabel(inner);
}

/**
 * 从 .docx 的 word/document.xml 提取 {{变量}}；图片类来自「图片:」前缀或关键字命中（见 DOCX_IMAGE_VAR_KEYWORDS）。
 */
export async function extractVariablesFromDocx(file: File): Promise<DocxVariableToken[]> {
  const buf = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);
  const docXml = zip.file('word/document.xml');
  if (!docXml) return [];
  const xml = await docXml.async('string');
  const plain = mergeWordTextNodesFromDocumentXml(xml);
  const seen = new Set<string>();
  const out: DocxVariableToken[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(PLACEHOLDER_RE.source, 'g');
  while ((m = re.exec(plain)) !== null) {
    const inner = m[1];
    const full = m[0];
    if (seen.has(full)) continue;
    seen.add(full);
    const { kind, label } = normalizeLabel(inner);
    out.push({ placeholder: full, kind, label });
  }
  return out;
}

/**
 * 按当前规则从占位符重新推导 kind/label（不写库即可修复历史 variables_json 里 kind=文本 的旧数据）。
 */
export function hydrateDocxVariableTokens(tokens: DocxVariableToken[]): DocxVariableToken[] {
  return (tokens ?? []).map(t => {
    const inner = innerFromPlaceholder(t.placeholder);
    const classified = classifyDocxPlaceholderInner(inner);
    return { ...t, kind: classified.kind, label: classified.label };
  });
}
