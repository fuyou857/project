import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDebouncedValue } from './useDebouncedValue';
import { supabase } from '../../../../supabase/client';
import { useCompanyScope } from '../../../../hooks/useCompanyScope';
import { invoicePaidAmount, invoiceRemainingAmount } from '../../../../utils/costInvoiceAmounts';
import type { InvoiceAttachmentItem } from '../types';
import {
  emptyCostInvoiceFilters,
  type CostInvoiceListFilters,
  type CostInvoiceRow,
  type EnrichedCostInvoiceRow,
  type PaymentHistoryItem,
  type SortState,
} from './types';

const DEFAULT_PAGE_SIZE = 10;

function normalizeAttachments(raw: unknown): InvoiceAttachmentItem[] | null {
  if (!raw || !Array.isArray(raw)) return null;
  const items = raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const o = item as Record<string, unknown>;
      const url = typeof o.url === 'string' ? o.url : '';
      if (!url) return null;
      return {
        url,
        filename: typeof o.filename === 'string' ? o.filename : url.split('/').pop() || '附件',
        mime: typeof o.mime === 'string' ? o.mime : '',
      };
    })
    .filter(Boolean) as InvoiceAttachmentItem[];
  return items.length ? items : null;
}

export function useCostInvoiceList() {
  const { companyIds } = useCompanyScope();
  const [filters, setFilters] = useState(emptyCostInvoiceFilters);
  const debouncedFilters = useDebouncedValue(filters, 500);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [sort, setSort] = useState<SortState>({ field: null, direction: 'desc' });
  const [rows, setRows] = useState<EnrichedCostInvoiceRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [partyBList, setPartyBList] = useState<{ id: string; unit_name: string }[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string; project_id?: string }[]>([]);
  const [expenseContracts, setExpenseContracts] = useState<
    { id: string; contract_name: string; contract_code?: string | null }[]
  >([]);
  const [userNameMap, setUserNameMap] = useState<Map<string, string>>(new Map());
  const [allUsers, setAllUsers] = useState<{ id: string; real_name: string; username: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let projQuery = supabase.from('projects').select('id, name').order('name');
      if (companyIds.length > 0) projQuery = projQuery.in('company_id', companyIds);
      const [projRes, pbRes, supRes, contractRes, userRes] = await Promise.all([
        projQuery,
        supabase.from('party_b').select('id, unit_name'),
        supabase.from('suppliers').select('id, name, project_id'),
        (() => {
          let q = supabase.from('expense_contracts').select('id, contract_name, contract_code').order('contract_name');
          if (companyIds.length > 0) q = q.in('company_id', companyIds);
          return q;
        })(),
        supabase.from('users').select('id, real_name, username').order('real_name'),
      ]);
      if (cancelled) return;
      if (projRes.data) setProjects(projRes.data);
      if (pbRes.data) setPartyBList(pbRes.data);
      if (supRes.data) setSuppliers(supRes.data);
      if (contractRes.data) setExpenseContracts(contractRes.data);
      if (userRes.data) {
        setAllUsers(userRes.data);
        const next = new Map(userNameMap);
        for (const u of userRes.data) {
          next.set(u.id, u.real_name || u.username || u.id);
        }
        setUserNameMap(next);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyIds]);

  const projectNameById = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);

  const resolveSellerName = useCallback(
    (row: CostInvoiceRow) => {
      const seller = row.seller_name?.trim();
      if (seller) return seller;
      if (row.supplier_id) {
        const sup = suppliers.find((s) => s.id === row.supplier_id);
        if (sup?.name) return sup.name;
        const pb = partyBList.find((p) => p.id === row.supplier_id);
        if (pb?.unit_name) return pb.unit_name;
      }
      return '-';
    },
    [partyBList, suppliers],
  );

  const contractLabelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of expenseContracts) {
      const code = c.contract_code ? ` (${c.contract_code})` : '';
      m.set(c.id, `${c.contract_name}${code}`);
    }
    return m;
  }, [expenseContracts]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let scopedProjectIds: string[] | null = null;
      if (companyIds.length > 0) {
        let pq = supabase.from('projects').select('id');
        pq = pq.in('company_id', companyIds);
        const { data: projs, error: pErr } = await pq;
        if (pErr) throw pErr;
        scopedProjectIds = (projs ?? []).map((p) => p.id);
        if (scopedProjectIds.length === 0) {
          setRows([]);
          setTotal(0);
          return;
        }
      }

      let projectFilterIds: string[] | null = null;
      if (debouncedFilters.projectId) {
        projectFilterIds = [debouncedFilters.projectId];
      } else if (debouncedFilters.projectKeyword.trim()) {
        const kw = debouncedFilters.projectKeyword.trim().toLowerCase();
        projectFilterIds = projects.filter((p) => p.name.toLowerCase().includes(kw)).map((p) => p.id);
        if (projectFilterIds.length === 0) {
          setRows([]);
          setTotal(0);
          return;
        }
      }

      let q = supabase.from('cost_invoices').select('*', { count: 'exact' });

      if (scopedProjectIds) q = q.in('project_id', scopedProjectIds);
      if (projectFilterIds) q = q.in('project_id', projectFilterIds);
      if (debouncedFilters.invoiceType) q = q.eq('invoice_type', debouncedFilters.invoiceType);
      if (debouncedFilters.invoiceNumber.trim()) {
        q = q.ilike('invoice_number', `%${debouncedFilters.invoiceNumber.trim()}%`);
      }
      if (debouncedFilters.expenseContractId) q = q.eq('expense_contract_id', debouncedFilters.expenseContractId);
      if (debouncedFilters.associationStatus) q = q.eq('association_status', debouncedFilters.associationStatus);
      if (debouncedFilters.createdBy) q = q.eq('created_by', debouncedFilters.createdBy);
      
      if (debouncedFilters.sellerKeyword.trim()) {
        const sk = debouncedFilters.sellerKeyword.trim();
        const supIds = suppliers.filter((s) => s.name.includes(sk)).map((s) => s.id);
        const pbIds = partyBList.filter((p) => p.unit_name.includes(sk)).map((p) => p.id);
        const allIds = [...new Set([...supIds, ...pbIds])];
        if (allIds.length > 0) {
          q = q.or(`seller_name.ilike.%${sk}%,supplier_id.in.(${allIds.join(',')})`);
        } else {
          q = q.ilike('seller_name', `%${sk}%`);
        }
      }

      if (sort.field) {
        q = q.order(sort.field, { ascending: sort.direction === 'asc', nullsFirst: false });
      } else {
        q = q.order('created_at', { ascending: false });
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const { data, count, error: qErr } = await q.range(from, to);
      if (qErr) throw qErr;

      const rawRows = (data ?? []) as CostInvoiceRow[];
      const invoiceIds = rawRows.map((r) => r.id);

      let paymentsByInvoice = new Map<string, PaymentHistoryItem[]>();
      if (invoiceIds.length > 0) {
        const { data: payRows } = await supabase
          .from('payment_records')
          .select('*')
          .in('invoice_id', invoiceIds)
          .eq('status', 'completed');
        for (const p of payRows ?? []) {
          if (!p.invoice_id) continue;
          const list = paymentsByInvoice.get(p.invoice_id) ?? [];
          list.push(p as PaymentHistoryItem);
          paymentsByInvoice.set(p.invoice_id, list);
        }
      }

      const creatorIds = [...new Set(rawRows.map((r) => r.created_by).filter(Boolean))] as string[];
      let names = userNameMap;
      if (creatorIds.length > 0) {
        const missing = creatorIds.filter((id) => !userNameMap.has(id));
        if (missing.length > 0) {
          const { data: users } = await supabase
            .from('users')
            .select('id, real_name, username')
            .in('id', missing);
          const next = new Map(userNameMap);
          for (const u of users ?? []) {
            const label = u.real_name || u.username || u.id;
            next.set(u.id, label);
          }
          names = next;
          setUserNameMap(next);
        }
      }

      let enriched: EnrichedCostInvoiceRow[] = rawRows.map((row, idx) => {
        let expense_contract_label = '-';
        if (row.association_status === 'associated_contract' && row.expense_contract_id) {
          expense_contract_label = contractLabelById.get(row.expense_contract_id) || '-';
        } else if (row.association_status === 'no_contract_payment') {
          expense_contract_label = `无合同付款${row.no_contract_payment_remark ? `（备注：${row.no_contract_payment_remark}）` : ''}`;
        }

        return {
          ...row,
          attachment_urls: normalizeAttachments(row.attachment_urls),
          rowIndex: from + idx + 1,
          project_name: projectNameById.get(row.project_id) || '-',
          seller_display: resolveSellerName(row),
          expense_contract_label,
          created_by_name: row.created_by ? names.get(row.created_by) || '-' : '-',
          payments: paymentsByInvoice.get(row.id) ?? [],
        };
      });

      setRows(enriched);
      setTotal(count ?? enriched.length);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '加载失败，请稍后重试';
      setError(msg);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [
    companyIds,
    contractLabelById,
    debouncedFilters,
    page,
    pageSize,
    projectNameById,
    projects,
    resolveSellerName,
    sort.direction,
    sort.field,
    partyBList,
    suppliers,
  ]);

  const resetFilters = useCallback(() => {
    setFilters(emptyCostInvoiceFilters());
    setPage(1);
  }, []);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const toggleSort = useCallback((field: SortState['field']) => {
    setSort((prev) => {
      if (prev.field !== field) return { field, direction: 'asc' };
      if (prev.direction === 'asc') return { field, direction: 'desc' };
      return { field: null, direction: 'desc' };
    });
    setPage(1);
  }, []);

  return {
    filters,
    setFilters,
    resetFilters,
    page,
    setPage,
    pageSize,
    setPageSize,
    sort,
    toggleSort,
    rows,
    total,
    loading,
    error,
    fetchList,
    projects,
    allUsers,
    expenseContracts,
    projectNameById,
    resolveSellerName,
    getPaid: invoicePaidAmount,
    getRemaining: invoiceRemainingAmount,
  };
}
