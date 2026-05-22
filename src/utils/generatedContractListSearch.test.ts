import { describe, expect, it } from 'vitest';
import type { GeneratedContractListRow } from '../services/contractGenerationService';
import { partyBDisplayNameFromListRow, rowMatchesMyGeneratedContractSearch } from './generatedContractListSearch';

function minimalRow(partial: Partial<GeneratedContractListRow>): GeneratedContractListRow {
  return {
    id: '1',
    contract_no: 'HT-2026-0001',
    template_id: 't',
    template_file_version_id: 'v',
    project_id: null,
    party_a_id: null,
    party_b_id: null,
    payment_method_text: null,
    variables_values: {},
    merged_pdf_storage_path: null,
    generated_docx_storage_path: null,
    rich_text_draft: null,
    status: 'draft',
    approval_id: null,
    seal_annotation: null,
    sealed_pdf_storage_path: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

describe('partyBDisplayNameFromListRow', () => {
  it('uses name when present (与主库列表一致：name 优先于 unit_name)', () => {
    const row = minimalRow({
      party_b: { id: 'b', unit_name: '乙方A', name: '签约名' },
    });
    expect(partyBDisplayNameFromListRow(row)).toBe('签约名');
  });

  it('falls back to unit_name when name empty', () => {
    const row = minimalRow({
      party_b: { id: 'b', unit_name: '乙方A', name: '  ' },
    });
    expect(partyBDisplayNameFromListRow(row)).toBe('乙方A');
  });

  it('returns dash when missing', () => {
    expect(partyBDisplayNameFromListRow(minimalRow({ party_b: null }))).toBe('—');
  });
});

describe('rowMatchesMyGeneratedContractSearch', () => {
  it('matches contract_no substring', () => {
    const row = minimalRow({ contract_no: 'HT-2026-0099' });
    expect(rowMatchesMyGeneratedContractSearch(row, '0099')).toBe(true);
    expect(rowMatchesMyGeneratedContractSearch(row, '9999')).toBe(false);
  });

  it('matches template title case-insensitively', () => {
    const row = minimalRow({
      contract_templates: { id: 't', title: '桩基工程模板' },
    });
    expect(rowMatchesMyGeneratedContractSearch(row, '桩基')).toBe(true);
  });
});
