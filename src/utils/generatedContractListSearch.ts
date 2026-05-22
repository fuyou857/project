import type { GeneratedContractListRow } from '../services/contractGenerationService';

/** 与合同模板库列表一致：乙方展示名（name 优先，否则 unit_name） */
export function partyBDisplayNameFromListRow(row: GeneratedContractListRow): string {
  const pb = row.party_b;
  if (!pb) return '—';
  const n =
    (typeof pb.name === 'string' && pb.name.trim()) ||
    (typeof pb.unit_name === 'string' && pb.unit_name.trim()) ||
    '';
  return n || '—';
}

/** 「我生成的合同」主列表关键字筛选（编号、模板、工程、甲乙方） */
export function rowMatchesMyGeneratedContractSearch(row: GeneratedContractListRow, searchRaw: string): boolean {
  const q = searchRaw.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    row.contract_no,
    row.contract_templates?.title,
    row.projects?.name,
    row.party_a?.name,
    partyBDisplayNameFromListRow(row),
  ]
    .filter(Boolean)
    .join('\u0000')
    .toLowerCase();
  return hay.includes(q);
}
