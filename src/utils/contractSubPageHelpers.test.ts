import { describe, expect, it } from 'vitest';
import {
  alertMissingRequiredFields,
  filterRowsBySearch,
  generateDatedRandomCode,
  generateDatedSequentialCode,
  contractNameById,
} from './contractSubPageHelpers';

describe('contractSubPageHelpers', () => {
  it('alertMissingRequiredFields returns false when empty', () => {
    expect(alertMissingRequiredFields([])).toBe(false);
  });

  it('filterRowsBySearch matches string fields', () => {
    const rows = [{ name: 'Alpha', code: 'A1' }, { name: 'Beta', code: 'B2' }];
    expect(filterRowsBySearch(rows, 'alpha', ['name'])).toHaveLength(1);
    expect(filterRowsBySearch(rows, '', ['name'])).toHaveLength(2);
  });

  it('generateDatedSequentialCode pads sequence', () => {
    expect(generateDatedSequentialCode('EX-V-', 3)).toMatch(/^EX-V-\d{8}-0003$/);
  });

  it('generateDatedRandomCode uses prefix', () => {
    expect(generateDatedRandomCode('VAR-')).toMatch(/^VAR-\d{8}-\d{4}$/);
  });

  it('contractNameById resolves name', () => {
    expect(contractNameById([{ id: '1', contract_name: 'Test' }], '1')).toBe('Test');
    expect(contractNameById([{ id: '1', contract_name: 'Test' }], 'x')).toBe('-');
  });
});
