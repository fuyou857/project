import { describe, expect, it } from 'vitest';
import { collectCompanyIds } from './companyScope';

describe('collectCompanyIds', () => {
  it('returns empty when no current company', () => {
    expect(collectCompanyIds(null, [])).toEqual([]);
  });

  it('includes current company and direct children', () => {
    const companies = [
      { id: 'a', parent_id: null },
      { id: 'b', parent_id: 'a' },
      { id: 'c', parent_id: '0' },
      { id: 'd', parent_id: 'x' },
    ];
    expect(collectCompanyIds({ id: 'a' }, companies)).toEqual(['a', 'b', 'c']);
  });
});
