import { describe, expect, it } from 'vitest';
import {
  variableNameMatchesImageKeywords,
  classifyDocxPlaceholderInner,
  hydrateDocxVariableTokens,
} from './docxVariables';

describe('variableNameMatchesImageKeywords', () => {
  it('matches after stripping zero-width chars', () => {
    expect(variableNameMatchesImageKeywords('身\u200B份证正面')).toBe(true);
  });

  it('matches Chinese keywords (substring)', () => {
    expect(variableNameMatchesImageKeywords('身份证正面')).toBe(true);
    expect(variableNameMatchesImageKeywords('法人头像')).toBe(true);
    expect(variableNameMatchesImageKeywords('营业执照照片')).toBe(true);
    expect(variableNameMatchesImageKeywords('物料清单图片')).toBe(true);
    expect(variableNameMatchesImageKeywords('资质证照')).toBe(true);
  });

  it('is case-insensitive for ASCII letters in name', () => {
    expect(variableNameMatchesImageKeywords('ID正面')).toBe(true);
  });

  it('does not match plain text variables', () => {
    expect(variableNameMatchesImageKeywords('姓名')).toBe(false);
    expect(variableNameMatchesImageKeywords('签订日期')).toBe(false);
    expect(variableNameMatchesImageKeywords('公司名称')).toBe(false);
  });
});

describe('classifyDocxPlaceholderInner', () => {
  it('classifies keyword hits as image when no illegal colon', () => {
    expect(classifyDocxPlaceholderInner('身份证反面').kind).toBe('image');
    expect(classifyDocxPlaceholderInner('开户许可证').kind).toBe('image');
  });

  it('does not classify as image when halfwidth colon without 图片/文件 prefix', () => {
    expect(classifyDocxPlaceholderInner('甲方:名称').kind).toBe('text');
    expect(classifyDocxPlaceholderInner('身份证:正面').kind).toBe('text');
  });

  it('keeps explicit 图片 / 文件 prefix', () => {
    expect(classifyDocxPlaceholderInner('图片:身份证').kind).toBe('image');
    expect(classifyDocxPlaceholderInner('图片:身份证').label).toBe('身份证');
    expect(classifyDocxPlaceholderInner('文件:附件').kind).toBe('file');
  });
});

describe('hydrateDocxVariableTokens', () => {
  it('upgrades legacy DB row kind=text to image from placeholder', () => {
    const h = hydrateDocxVariableTokens([
      { placeholder: '{{身份证正面}}', kind: 'text', label: '身份证正面' },
      { placeholder: '{{身份证反面}}', kind: 'text', label: '身份证反面' },
    ]);
    expect(h[0].kind).toBe('image');
    expect(h[1].kind).toBe('image');
  });
});
