import { describe, expect, it } from 'vitest';
import {
  buildPartyBInsertFromSeller,
  matchPartyBInBase,
  normalizeCreditCode,
  parseSellerBank,
  parseSellerPhone,
  syncProjectSupplier,
} from './sellerPartyBSync';

const partyBList = [
  { id: '1', unit_name: '甲公司', credit_code: '91110000MA001', unit_type: '劳务类' },
  { id: '2', unit_name: '乙公司', credit_code: '91110000MA002', unit_type: '材料类' },
];

describe('sellerPartyBSync', () => {
  it('matchPartyBInBase exact match', () => {
    const r = matchPartyBInBase(partyBList, '甲公司', '91110000MA001');
    expect(r.status).toBe('exact');
    expect(r.partyB?.id).toBe('1');
  });

  it('matchPartyBInBase warns when name and credit split', () => {
    const r = matchPartyBInBase(partyBList, '甲公司', '91110000MA002');
    expect(r.status).toBe('name_only');
    expect(r.message).toMatch(/无法对应同一条/);
  });

  it('parseSellerPhone and bank', () => {
    expect(parseSellerPhone('北京市 xx 路 13800138000')).toBe('13800138000');
    expect(parseSellerBank('中国工商银行北京分行 6222021234567890123')).toEqual({
      bank_name: '中国工商银行北京分行',
      bank_account: '6222021234567890123',
    });
  });

  it('buildPartyBInsertFromSeller uses 劳务类', () => {
    const row = buildPartyBInsertFromSeller({
      seller_name: '  测试公司 ',
      seller_tax_id: '91110000MA099',
      seller_address_phone: '010-12345678',
      seller_bank: '建行 6222000111111111111',
    });
    expect(row.unit_name).toBe('测试公司');
    expect(row.unit_type).toBe('劳务类');
    expect(normalizeCreditCode(row.credit_code || '')).toBe('91110000MA099');
  });

  it('syncProjectSupplier matches existing project supplier', () => {
    const r = syncProjectSupplier(
      'p1',
      {
        seller_name: '甲公司',
        seller_tax_id: '91110000MA001',
        seller_address_phone: '',
        seller_bank: '',
      },
      [{ id: 's1', project_id: 'p1', name: '甲公司', supply_category: '人工' }],
      partyBList,
    );
    expect(r.status).toBe('matched');
    if (r.status === 'matched') expect(r.supplierId).toBe('s1');
  });
});
