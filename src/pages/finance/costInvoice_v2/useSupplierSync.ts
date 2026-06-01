import { useCallback, useState } from 'react';
import { supabase } from '../../../supabase/client';
import {
  sellerFieldsFromForm,
  syncProjectSupplier,
  matchPartyBInBase,
  buildPartyBInsertFromSeller,
  DEFAULT_PARTY_B_UNIT_TYPE,
  mapPartyBTypeToSupplyCategory,
  type PartyBRow
} from '../costInvoice/sellerPartyBSync';
import { type CostInvoiceForm } from '../costInvoice/types';

export function useSupplierSync(
  partyBList: PartyBRow[],
  projectSuppliers: any[],
  setProjectSuppliers: React.Dispatch<React.SetStateAction<any[]>>
) {
  const [warnings, setWarnings] = useState<string[]>([]);

  const clearWarnings = useCallback(() => setWarnings([]), []);

  const syncProjectSupplierForForm = useCallback(async (
    invoiceForm: CostInvoiceForm,
    basePartyB?: PartyBRow
  ) => {
    if (!invoiceForm.project_id?.trim() || !invoiceForm.seller_name?.trim()) return;

    const fields = sellerFieldsFromForm(invoiceForm);
    const sync = syncProjectSupplier(
      invoiceForm.project_id,
      fields,
      projectSuppliers,
      partyBList,
    );

    if (sync.status === 'warning') {
      setWarnings((prev) => prev.includes(sync.message) ? prev : [...prev, sync.message]);
      return { status: 'warning' as const, message: sync.message };
    }

    if (sync.status === 'matched') {
      return { status: 'matched' as const, supplierId: sync.supplierId };
    }

    if (sync.status === 'skipped') {
      const partyB = basePartyB || matchPartyBInBase(partyBList, fields.seller_name, fields.seller_tax_id).partyB;
      const supplyCategory = mapPartyBTypeToSupplyCategory(partyB?.unit_type);
      const { bank_name, bank_account } = buildPartyBInsertFromSeller(fields);

      const { data, error } = await supabase.from('suppliers').insert({
        project_id: invoiceForm.project_id,
        name: fields.seller_name.trim(),
        supply_category: supplyCategory,
        bank_account: bank_account || null,
        bank_name: bank_name || null,
        status: 'active',
      }).select().maybeSingle();

      if (data) {
        setProjectSuppliers(prev => [...prev, data]);
        return { status: 'created' as const, supplierId: data.id };
      }

      if (error) {
        console.error('[useSupplierSync] 创建供应商失败', error);
        return { status: 'error' as const, message: error.message };
      }
    }

    return { status: 'noop' as const };
  }, [partyBList, projectSuppliers, setProjectSuppliers]);

  const handleOcrComplete = useCallback(async (completedForm: CostInvoiceForm) => {
    if (!completedForm.seller_name?.trim()) return;

    const fields = sellerFieldsFromForm(completedForm);
    const match = matchPartyBInBase(partyBList, fields.seller_name, fields.seller_tax_id);

    if (match.status === 'exact' && match.partyB && completedForm.project_id) {
      await syncProjectSupplierForForm(completedForm, match.partyB);
    }
  }, [partyBList, syncProjectSupplierForForm]);

  return {
    warnings,
    setWarnings,
    clearWarnings,
    syncProjectSupplierForForm,
    handleOcrComplete
  };
}
