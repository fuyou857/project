import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase/client';
import { useCompanyScope } from './useCompanyScope';

type UseContractSideListOptions = {
  contractSelect?: string;
  listLimit?: number;
  /** 子表关联主合同的字段，默认 contract_id；补充协议为 main_contract_id */
  listContractFk?: 'contract_id' | 'main_contract_id';
};

function listFkForTable(listTable: string, override?: 'contract_id' | 'main_contract_id') {
  if (override) return override;
  return listTable.includes('supplement') ? 'main_contract_id' : 'contract_id';
}

/**
 * 合同子业务列表页通用数据加载（fetchContracts + fetchList）
 * 与主签约列表一致：按当前公司过滤主合同下拉。
 */
export function useContractSideList(
  contractsTable: string,
  listTable: string,
  options: UseContractSideListOptions = {},
) {
  const { companyIds } = useCompanyScope();
  const { contractSelect = 'id, contract_name, contract_code', listLimit = 49, listContractFk } = options;
  const [contracts, setContracts] = useState<any[]>([]);
  const [listData, setListData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const fkField = listFkForTable(listTable, listContractFk);

  const fetchContracts = useCallback(async () => {
    let query = supabase
      .from(contractsTable)
      .select(contractSelect)
      .order('created_at', { ascending: false })
      .range(0, 99);
    if (companyIds.length > 0) {
      query = query.in('company_id', companyIds);
    }
    const { data } = await query;
    if (data) setContracts(data);
  }, [contractsTable, contractSelect, companyIds]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from(listTable)
      .select('*')
      .order('created_at', { ascending: false })
      .range(0, listLimit - 1);

    if (companyIds.length > 0) {
      const { data: contractRows } = await supabase
        .from(contractsTable)
        .select('id')
        .in('company_id', companyIds);
      const ids = (contractRows || []).map((r) => r.id);
      if (ids.length === 0) {
        setListData([]);
        setLoading(false);
        return;
      }
      query = query.in(fkField, ids);
    }

    const { data } = await query;
    if (data) setListData(data);
    setLoading(false);
  }, [companyIds, contractsTable, fkField, listLimit, listTable]);

  const refreshAll = useCallback(() => {
    void fetchContracts();
    void fetchData();
  }, [fetchContracts, fetchData]);

  useEffect(() => {
    void fetchContracts();
    void fetchData();
  }, [fetchContracts, fetchData]);

  return {
    contracts,
    setContracts,
    listData,
    setListData,
    loading,
    fetchContracts,
    fetchData,
    refreshAll,
  };
}
