import { describe, expect, it } from 'vitest';
import {
  alertMissingRequiredFields,
  contractAmountById,
  contractNameById,
  filterRowsBySearch,
} from './contractSubPageHelpers';

describe('alertMissingRequiredFields', () => {
  it('returns false when nothing missing', () => {
    const messages: string[] = [];
    const prev = globalThis.alert;
    globalThis.alert = (msg?: string) => {
      messages.push(String(msg));
    };
    try {
      expect(alertMissingRequiredFields([])).toBe(false);
      expect(messages).toHaveLength(0);
    } finally {
      globalThis.alert = prev;
    }
  });

  it('alerts and returns true when fields missing', () => {
    const messages: string[] = [];
    const prev = globalThis.alert;
    globalThis.alert = (msg?: string) => {
      messages.push(String(msg));
    };
    try {
      expect(alertMissingRequiredFields(['关联合同'])).toBe(true);
      expect(messages[0]).toContain('关联合同');
    } finally {
      globalThis.alert = prev;
    }
  });
});

describe('contractNameById', () => {
  it('returns name or dash', () => {
    const rows = [{ id: '1', contract_name: 'A' }];
    expect(contractNameById(rows, '1')).toBe('A');
    expect(contractNameById(rows, 'x')).toBe('-');
  });
});

describe('contractAmountById', () => {
  it('returns amount or zero', () => {
    const rows = [{ id: '1', contract_amount: 100 }];
    expect(contractAmountById(rows, '1')).toBe(100);
    expect(contractAmountById(rows, 'x')).toBe(0);
  });
});

describe('filterRowsBySearch', () => {
  it('filters string fields case-insensitively', () => {
    const rows = [
      { code: 'ABC-1', name: 'foo' },
      { code: 'xyz', name: 'bar' },
    ];
    expect(filterRowsBySearch(rows, 'abc', ['code'])).toHaveLength(1);
    expect(filterRowsBySearch(rows, '', ['code'])).toHaveLength(2);
  });
});
