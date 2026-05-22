import { PARTY_B_TYPES } from '../../../constants';

export type PartyBRow = {
  id: string;
  unit_name: string;
  unit_type?: string | null;
  credit_code?: string | null;
  phone?: string | null;
  bank_name?: string | null;
  bank_account?: string | null;
};

export type ProjectSupplierRow = {
  id: string;
  project_id: string;
  name: string;
  supply_category?: string | null;
};

export type SellerInvoiceFields = {
  seller_name: string;
  seller_tax_id: string;
  seller_address_phone: string;
  seller_bank: string;
};

export type PartyBMatchStatus = 'exact' | 'name_only' | 'credit_only' | 'none';

export type PartyBMatchResult = {
  status: PartyBMatchStatus;
  partyB?: PartyBRow;
  message?: string;
};

export type ProjectSupplierSyncResult =
  | { status: 'matched'; supplierId: string }
  | { status: 'added'; supplierId: string }
  | { status: 'skipped'; reason: string }
  | { status: 'warning'; message: string };

export const DEFAULT_PARTY_B_UNIT_TYPE = PARTY_B_TYPES[1]; // 劳务类

export function normalizeUnitName(name: string): string {
  return name.trim().replace(/\s+/g, '');
}

export function normalizeCreditCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

/** 从「地址、电话」字段提取联系电话 */
export function parseSellerPhone(addressPhone: string): string {
  const raw = addressPhone.trim();
  if (!raw) return '';
  const mobile = raw.match(/1[3-9]\d{9}/);
  if (mobile) return mobile[0];
  const landline = raw.match(/\d{3,4}-\d{7,8}/);
  return landline?.[0] || '';
}

/** 从「开户行及账号」拆分银行名称与账号 */
export function parseSellerBank(sellerBank: string): { bank_name: string; bank_account: string } {
  const raw = sellerBank.trim();
  if (!raw) return { bank_name: '', bank_account: '' };
  const accountMatch = raw.match(/(\d{10,25})\s*$/);
  const bank_account = accountMatch?.[1] || '';
  const bank_name = bank_account ? raw.slice(0, raw.length - bank_account.length).trim() : raw;
  return { bank_name, bank_account };
}

export function buildPartyBInsertFromSeller(fields: SellerInvoiceFields) {
  const { bank_name, bank_account } = parseSellerBank(fields.seller_bank);
  return {
    unit_name: fields.seller_name.trim(),
    unit_type: DEFAULT_PARTY_B_UNIT_TYPE,
    credit_code: fields.seller_tax_id.trim() || null,
    phone: parseSellerPhone(fields.seller_address_phone) || null,
    bank_name: bank_name || null,
    bank_account: bank_account || null,
  };
}

export function mapPartyBTypeToSupplyCategory(unitType?: string | null): string {
  const t = (unitType || '').trim();
  if (t === '劳务类' || t === '劳务供应商' || t === 'labor') return '人工';
  if (t === '材料类' || t === '材料供应商') return '材料';
  if (t === '专业分包' || t === '专业分包供应商') return '其他';
  return '人工';
}

/** 基础数据乙方单位：须名称与社会信用代码同时完全匹配 */
export function matchPartyBInBase(
  list: PartyBRow[],
  sellerName: string,
  sellerTaxId: string,
): PartyBMatchResult {
  const name = normalizeUnitName(sellerName);
  const credit = normalizeCreditCode(sellerTaxId);
  if (!name) {
    return { status: 'none', message: '发票未识别到销售方名称，无法校验乙方单位。' };
  }
  if (!credit) {
    return {
      status: 'none',
      message: '发票未识别到销售方纳税人识别号，无法与基础数据统一社会信用代码比对。',
    };
  }

  const exact = list.find(
    (p) =>
      normalizeUnitName(p.unit_name) === name &&
      normalizeCreditCode(p.credit_code || '') === credit,
  );
  if (exact) return { status: 'exact', partyB: exact };

  const byName = list.filter((p) => normalizeUnitName(p.unit_name) === name);
  const byCredit = list.filter((p) => normalizeCreditCode(p.credit_code || '') === credit);

  if (byName.length > 0 && byCredit.length > 0) {
    return {
      status: 'name_only',
      message: `基础数据校验未通过：单位名称「${sellerName.trim()}」与统一社会信用代码「${sellerTaxId.trim()}」无法对应同一条乙方单位记录，请核对后手动选择或修正。`,
    };
  }
  if (byName.length > 0) {
    return {
      status: 'name_only',
      partyB: byName[0],
      message: `基础数据中存在同名乙方「${byName[0].unit_name}」，但社会信用代码与发票不一致，请核对。`,
    };
  }
  if (byCredit.length > 0) {
    return {
      status: 'credit_only',
      partyB: byCredit[0],
      message: `基础数据中存在相同社会信用代码的乙方「${byCredit[0].unit_name}」，但单位名称与发票销售方不一致，请核对。`,
    };
  }
  return { status: 'none' };
}

/** 项目乙方列表：按名称 + 基础数据信用代码交叉校验 */
export function syncProjectSupplier(
  projectId: string,
  fields: SellerInvoiceFields,
  projectSuppliers: ProjectSupplierRow[],
  partyBList: PartyBRow[],
): ProjectSupplierSyncResult {
  const name = normalizeUnitName(fields.seller_name);
  const credit = normalizeCreditCode(fields.seller_tax_id);
  if (!projectId || !name) {
    return { status: 'skipped', reason: '未选择项目或未识别销售方名称' };
  }

  const baseMatch = matchPartyBInBase(partyBList, fields.seller_name, fields.seller_tax_id);
  const projectList = projectSuppliers.filter((s) => s.project_id === projectId);
  const byName = projectList.filter((s) => normalizeUnitName(s.name) === name);
  const byCreditPartyB = credit
    ? partyBList.filter((p) => normalizeCreditCode(p.credit_code || '') === credit)
    : [];

  if (byName.length > 0 && credit && byCreditPartyB.length > 0 && baseMatch.status !== 'exact') {
    const creditNames = byCreditPartyB.map((p) => p.unit_name).join('、');
    return {
      status: 'warning',
      message: `项目乙方校验：发票销售方「${fields.seller_name.trim()}」与统一社会信用代码在基础数据中对应「${creditNames}」，与当前项目乙方名称不一致，请核对后手动选择。`,
    };
  }

  if (byName.length === 1) {
    if (credit && baseMatch.status === 'exact' && baseMatch.partyB) {
      return { status: 'matched', supplierId: byName[0].id };
    }
    if (credit && baseMatch.status !== 'exact') {
      return {
        status: 'warning',
        message:
          baseMatch.message ||
          `项目乙方「${byName[0].name}」与发票销售方名称一致，但统一社会信用代码校验未通过，请核对。`,
      };
    }
    return { status: 'matched', supplierId: byName[0].id };
  }

  if (byName.length > 1) {
    return {
      status: 'warning',
      message: `当前项目存在多个同名乙方「${fields.seller_name.trim()}」，请手动选择开票单位。`,
    };
  }

  return { status: 'skipped', reason: '项目乙方列表中无匹配项，需自动新增' };
}

export function sellerFieldsFromForm(form: {
  seller_name: string;
  seller_tax_id: string;
  seller_address_phone: string;
  seller_bank: string;
}): SellerInvoiceFields {
  return {
    seller_name: form.seller_name,
    seller_tax_id: form.seller_tax_id,
    seller_address_phone: form.seller_address_phone,
    seller_bank: form.seller_bank,
  };
}
