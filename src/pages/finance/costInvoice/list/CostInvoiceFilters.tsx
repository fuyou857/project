import { useMemo } from 'react';
import { FaSearch, FaUndo } from 'react-icons/fa';
import { SearchableSelect } from '../../../../components/ui';
import { contractSelectOptions, projectSelectOptions } from '../../../../components/ui/options';
import { INVOICE_TYPE_FILTER_OPTIONS } from './formatters';
import type { CostInvoiceListFilters } from './types';

type Props = {
  filters: CostInvoiceListFilters;
  onChange: (patch: Partial<CostInvoiceListFilters>) => void;
  onReset: () => void;
  projects: { id: string; name: string }[];
  expenseContracts: { id: string; contract_name: string; contract_code?: string | null }[];
  allUsers: { id: string; real_name: string; username: string }[];
  sellerSuggestions: string[];
  invoiceNumberSuggestions: string[];
};

const ASSOCIATION_STATUS_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'unassociated', label: '未关联' },
  { value: 'associated_contract', label: '已关联合同' },
  { value: 'no_contract_payment', label: '无合同付款' },
];

export default function CostInvoiceFilters({
  filters,
  onChange,
  onReset,
  projects,
  expenseContracts,
  allUsers,
  sellerSuggestions,
  invoiceNumberSuggestions,
}: Props) {
  const projectOptions = projectSelectOptions(projects, '全部项目');
  const contractOptions = contractSelectOptions(
    expenseContracts.map((c) => ({ ...c, contract_code: c.contract_code ?? undefined })),
    '全部支出合同',
  );
  const userOptions = useMemo(() => [
    { value: '', label: '全部' },
    ...allUsers.map(u => ({ value: u.id, label: u.real_name || u.username }))
  ], [allUsers]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end gap-2 lg:flex-nowrap">
        <div className="w-full sm:w-56 lg:w-40 xl:w-48 shrink-0">
          <label className="ui-label" htmlFor="cost-inv-filter-project">
            项目名称
          </label>
          <SearchableSelect
            id="cost-inv-filter-project"
            value={filters.projectId}
            onChange={(v) => onChange({ projectId: v })}
            options={projectOptions}
            placeholder="项目"
            emptyLabel="全部"
            searchPlaceholder="搜索…"
            searchThreshold={0}
            metricsContext="page:cost_invoice_list:filter_project"
          />
          <div className="relative mt-1.5">
            <FaSearch className="pointer-events-none absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              list="cost-inv-project-suggest"
              value={filters.projectKeyword}
              onChange={(e) => onChange({ projectKeyword: e.target.value, projectId: '' })}
              placeholder="关键字"
              className="ui-input w-full pl-8 h-9 text-xs"
            />
            <datalist id="cost-inv-project-suggest">
              {projects.map((p) => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
          </div>
        </div>
        <div className="w-full min-w-0 flex-1 lg:max-w-xs">
          <label className="ui-label" htmlFor="cost-inv-filter-seller">
            销售方名称
          </label>
          <div className="relative">
            <FaSearch className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              id="cost-inv-filter-seller"
              type="text"
              list="cost-inv-seller-suggest"
              value={filters.sellerKeyword}
              onChange={(e) => onChange({ sellerKeyword: e.target.value })}
              placeholder="搜索销售方"
              className="ui-input w-full pl-9"
            />
            <datalist id="cost-inv-seller-suggest">
              {sellerSuggestions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>
        </div>
        <div className="w-full sm:w-36 lg:w-28 shrink-0">
          <label className="ui-label">票据类型</label>
          <SearchableSelect
            value={filters.invoiceType}
            onChange={(v) => onChange({ invoiceType: v })}
            options={INVOICE_TYPE_FILTER_OPTIONS}
            placeholder="类型"
            emptyLabel="全部"
            searchThreshold={20}
            metricsContext="page:cost_invoice_list:filter_type"
          />
        </div>
        <div className="w-full sm:w-44 lg:w-32 shrink-0">
          <label className="ui-label" htmlFor="cost-inv-filter-number">
            号码（后6位）
          </label>
          <div className="relative">
            <FaSearch className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              id="cost-inv-filter-number"
              type="text"
              list="cost-inv-number-suggest"
              value={filters.invoiceNumber}
              onChange={(e) => onChange({ invoiceNumber: e.target.value })}
              placeholder="后6位"
              className="ui-input w-full pl-8"
              title="搜索发票号码后6位"
            />
            <datalist id="cost-inv-number-suggest">
              {invoiceNumberSuggestions.map((no) => (
                <option key={no} value={no} />
              ))}
            </datalist>
          </div>
        </div>
        <div className="w-full sm:w-56 lg:w-40 xl:w-48 shrink-0">
          <label className="ui-label">支出合同</label>
          <SearchableSelect
            value={filters.expenseContractId}
            onChange={(v) => onChange({ expenseContractId: v })}
            options={contractOptions}
            placeholder="关联合同"
            emptyLabel="全部"
            searchPlaceholder="搜索…"
            metricsContext="page:cost_invoice_list:filter_contract"
          />
        </div>
        <div className="w-full sm:w-32 lg:w-28 shrink-0">
          <label className="ui-label">关联状态</label>
          <SearchableSelect
            value={filters.associationStatus}
            onChange={(v) => onChange({ associationStatus: v })}
            options={ASSOCIATION_STATUS_OPTIONS}
            placeholder="状态"
            emptyLabel="全部"
            metricsContext="page:cost_invoice_list:filter_status"
          />
        </div>
        <div className="w-full sm:w-32 lg:w-28 shrink-0">
          <label className="ui-label">录入人</label>
          <SearchableSelect
            value={filters.createdBy}
            onChange={(v) => onChange({ createdBy: v })}
            options={userOptions}
            placeholder="录入人"
            emptyLabel="全部"
            metricsContext="page:cost_invoice_list:filter_user"
          />
        </div>
        <div className="shrink-0">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 active:scale-[0.98]"
          >
            <FaUndo className="h-3 w-3" aria-hidden />
            重置
          </button>
        </div>
      </div>
    </section>
  );
}