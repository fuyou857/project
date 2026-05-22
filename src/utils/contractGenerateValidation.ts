import type { DocxVariableToken } from './docxVariables';

/** 生成合同前表单快照（与页面 genForm 对齐） */
export type ContractGenerateFormInput = {
  party_a_id: string;
  party_b_id: string;
  project_id: string;
  payment_method_text: string;
  vars: Record<string, string>;
};

const AMOUNT_HINT = /金额|价款|总价|合同价|造价|价税|含税|不含税|price|amount|money|元整/i;
const DATE_HINT = /日期|时间|签订|生效|交付|竣工|起始|截止|date|time/i;

function tokenLooksLikeAmount(t: DocxVariableToken): boolean {
  return t.kind === 'text' && (AMOUNT_HINT.test(t.placeholder) || AMOUNT_HINT.test(t.label));
}

function tokenLooksLikeDate(t: DocxVariableToken): boolean {
  return t.kind === 'text' && (DATE_HINT.test(t.placeholder) || DATE_HINT.test(t.label));
}

/** 金额：含阿拉伯数字则做简单合法性检查；纯中文大写金额也允许（长度受限） */
export function isPlausibleContractAmount(raw: string): boolean {
  const s = raw.trim();
  if (!s) return false;
  if (/\d/.test(s)) {
    const letters = s.replace(/[\s\d￥¥,，.．万亿元整角分佰仟]/gi, '');
    return !/[a-zA-Z]/.test(letters);
  }
  return /[零一二三四五六七八九十百千万亿两壹贰叁肆伍陆柒捌玖拾佰仟元整角分]/.test(s) && s.length <= 80;
}

/** 日期：YYYY-MM-DD / YYYY/MM/DD / YYYY.MM.DD 或可被 Date 解析且年份合理 */
export function isPlausibleContractDate(raw: string): boolean {
  const s = raw.trim();
  if (!s) return false;
  const m = s.match(/^(\d{4})[-/.／年](\d{1,2})[-/.／月](\d{1,2})(?:日)?/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const dt = new Date(y, mo - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
  }
  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return false;
  const y = dt.getFullYear();
  return y >= 1949 && y <= 2120;
}

/**
 * 点击「确定生成合同」前的数据校验：甲乙、付款方式、模板变量必填；金额/日期类占位做格式检查。
 */
export function validateBeforeGenerateContract(input: {
  form: ContractGenerateFormInput;
  variables: DocxVariableToken[];
}): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const { form, variables } = input;

  if (!form.party_a_id?.trim()) errors.push('请选择甲方。');
  if (!form.party_b_id?.trim()) errors.push('请选择乙方。');
  if (!form.payment_method_text?.trim()) errors.push('请填写付款方式（可点上方快捷预设）。');

  for (const t of variables) {
    const raw = form.vars[t.placeholder];
    if (t.kind === 'text') {
      const s = typeof raw === 'string' ? raw.trim() : '';
      if (!s) {
        errors.push(`请填写模板变量：${t.placeholder}（${t.label}）`);
        continue;
      }
      if (tokenLooksLikeAmount(t) && !isPlausibleContractAmount(s)) {
        errors.push(`「${t.label}」疑似金额，格式需为有效数字（可含千分位、￥、万/元等）。`);
      }
      if (tokenLooksLikeDate(t) && !isPlausibleContractDate(s)) {
        errors.push(`「${t.label}」疑似日期，请使用合法日期（推荐 YYYY-MM-DD）。`);
      }
    } else if (t.kind === 'image' || t.kind === 'file') {
      const s = typeof raw === 'string' ? raw.trim() : '';
      let filled = Boolean(s);
      if (t.kind === 'image' && s.startsWith('[')) {
        try {
          const arr = JSON.parse(s) as unknown;
          filled = Array.isArray(arr) && arr.some(x => typeof x === 'string' && String(x).trim());
        } catch {
          filled = false;
        }
      }
      if (!filled) {
        errors.push(`请完成${t.kind === 'image' ? '图片' : '文件'}上传：${t.placeholder}（${t.label}）`);
      }
    }
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true };
}
