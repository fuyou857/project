import { useMemo } from 'react';
import { useUiPreferences } from '../../../../contexts/UiPreferencesContext';
import { useAuth } from '../../../../hooks/useAuth';
import EmptyState from '../../../../components/ui/EmptyState';
import CostInvoiceActionMenu from './CostInvoiceActionMenu';
import CostInvoicePaidCell from './CostInvoicePaidCell';
import SortableTh from './SortableTh';
import { formatAmount, formatDateDisplay, formatInvoiceTypeLabel } from './formatters';
import type { EnrichedCostInvoiceRow, SortField, SortState } from './types';

type Props = {
  rows: EnrichedCostInvoiceRow[];
  loading: boolean;
  sort: SortState;
  onSort: (field: SortField) => void;
  getPaid: (row: EnrichedCostInvoiceRow) => number;
  getRemaining: (row: EnrichedCostInvoiceRow) => number;
  canEdit: boolean;
  canDelete: boolean;
  onView: (row: EnrichedCostInvoiceRow) => void;
  onEdit: (row: EnrichedCostInvoiceRow) => void;
  onDelete: (row: EnrichedCostInvoiceRow) => void;
  onAssociate: (row: EnrichedCostInvoiceRow) => void;
};

const AssociationStatusTag = ({ status }: { status: string }) => {
  const config = {
    unassociated: { label: '未关联', color: 'bg-gray-100 text-gray-700' },
    associated_contract: { label: '已关联合同', color: 'bg-blue-100 text-blue-700' },
    no_contract_payment: { label: '无合同付款', color: 'bg-yellow-100 text-yellow-700' },
  };
  const item = config[status as keyof typeof config] || config.unassociated;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${item.color}`}>
      {item.label}
    </span>
  );
};

export default function CostInvoiceListView({
  rows,
  loading,
  sort,
  onSort,
  getPaid,
  getRemaining,
  canEdit,
  canDelete,
  onView,
  onEdit,
  onDelete,
  onAssociate,
}: Props) {
  const { tableHeadCellClass, tableCellClass } = useUiPreferences();
  const { user, isSuperAdmin } = useAuth();

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        const amt = Number(row.invoice_amount);
        const tax = Number(row.tax_amount ?? row.deductible_tax ?? 0);
        const pd = Number(getPaid(row));
        const rem = Number(getRemaining(row));

        if (!isNaN(amt)) acc.invoiceAmount += amt;
        if (!isNaN(tax)) acc.taxAmount += tax;
        if (!isNaN(pd)) acc.paidAmount += pd;
        if (!isNaN(rem)) acc.remainingAmount += rem;
        return acc;
      },
      { invoiceAmount: 0, taxAmount: 0, paidAmount: 0, remainingAmount: 0 },
    );
  }, [rows, getPaid, getRemaining]);

  const clickableClass = "cursor-pointer hover:text-blue-800 hover:underline transition-colors";

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-500" role="status">
        <span className="h-9 w-9 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600" />
        <span>数据加载中…</span>
      </div>
    );
  }

  if (rows.length === 0) {
    return <EmptyState title="暂无发票数据" description="可调整筛选条件，或前往录入页新增发票" />;
  }

  return (
    <>
      {/* 桌面表格 */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[1400px] border-collapse text-sm">
          <thead className="bg-gray-50">
            <tr className="border-b border-gray-200">
              <th className={`${tableHeadCellClass} min-w-[3rem] text-left text-gray-600`}>序号</th>
              <SortableTh label="项目名称" field="project_name" sort={sort} onSort={onSort} className={`${tableHeadCellClass} min-w-[8rem]`} />
              <SortableTh label="销售方名称" field="seller_name" sort={sort} onSort={onSort} className={`${tableHeadCellClass} min-w-[12rem]`} />
              <th className={`${tableHeadCellClass} min-w-[4.5rem] text-left text-gray-600`}>票据类型</th>
              <SortableTh label="价税合计" field="invoice_amount" sort={sort} onSort={onSort} className={tableHeadCellClass} align="right" />
              <SortableTh label="合计税额" field="tax_amount" sort={sort} onSort={onSort} className={tableHeadCellClass} align="right" />
              <SortableTh label="开票日期" field="invoice_date" sort={sort} onSort={onSort} className={tableHeadCellClass} />
              <SortableTh label="发票编号" field="invoice_number" sort={sort} onSort={onSort} className={`${tableHeadCellClass} min-w-[9rem]`} />
              <SortableTh label="已付" field="paid_amount" sort={sort} onSort={onSort} className={tableHeadCellClass} align="right" />
              <SortableTh label="尚欠" field="remaining_amount" sort={sort} onSort={onSort} className={tableHeadCellClass} align="right" />
              <th className={`${tableHeadCellClass} min-w-[6rem] text-left text-gray-600`}>录入人</th>
              <SortableTh label="关联状态" field="association_status" sort={sort} onSort={onSort} className={`${tableHeadCellClass} min-w-[6rem]`} />
              <th className={`${tableHeadCellClass} min-w-[10rem] text-left text-gray-600`}>关联支出合同</th>
              <th className={`${tableHeadCellClass} min-w-[10rem] text-left text-gray-600`}>收票方名称</th>
              <th className={`${tableHeadCellClass} min-w-[7rem] text-center text-gray-600`}>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const paid = getPaid(row);
              const remaining = getRemaining(row);
              
              // 权限检查: 普通用户仅可修改自己录入的发票
              const isOwner = user?.id === row.created_by;
              const rowCanEdit = isSuperAdmin || (canEdit && isOwner);

              return (
                <tr key={row.id} className="border-b border-gray-100 transition hover:bg-gray-50/80">
                  <td className={`${tableCellClass} text-gray-500`}>{row.rowIndex}</td>
                  <td className={`${tableCellClass} ${clickableClass} max-w-[12rem] text-gray-800`} onClick={() => onView(row)} title={row.project_name}>
                    {row.project_name}
                  </td>
                  <td className={`${tableCellClass} ${clickableClass} max-w-[12rem] text-gray-700`} onClick={() => onView(row)} title={row.seller_display}>
                    {row.seller_display}
                  </td>
                  <td className={`${tableCellClass} ${clickableClass}`} onClick={() => onView(row)}>
                    <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                      {formatInvoiceTypeLabel(row.invoice_type, row.ocr_invoice_type_label)}
                    </span>
                  </td>
                  <td className={`${tableCellClass} ${clickableClass} ui-numeric min-w-[6.5rem] text-right font-medium text-gray-800`} onClick={() => onView(row)}>
                    {formatAmount(row.invoice_amount)}
                  </td>
                  <td className={`${tableCellClass} ${clickableClass} ui-numeric text-right text-gray-700`} onClick={() => onView(row)}>
                    {formatAmount(row.tax_amount ?? row.deductible_tax)}
                  </td>
                  <td className={`${tableCellClass} ${clickableClass} whitespace-nowrap text-gray-700`} onClick={() => onView(row)}>
                    {formatDateDisplay(row.invoice_date)}
                  </td>
                  <td className={`${tableCellClass} ${clickableClass} min-w-[9rem] font-mono text-sm text-gray-700`} onClick={() => onView(row)}>
                    {row.invoice_number || '-'}
                  </td>
                  <td className={`${tableCellClass} text-right`}>
                    <CostInvoicePaidCell paid={paid} payments={row.payments} />
                  </td>
                  <td className={`${tableCellClass} ui-numeric text-right font-medium ${remaining > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                    {formatAmount(remaining)}
                  </td>
                  <td className={`${tableCellClass} text-gray-600`} title={row.created_at ? `录入时间：${formatDateDisplay(row.created_at)}` : ''}>
                    {row.created_by_name}
                  </td>
                  <td className={tableCellClass}>
                    <AssociationStatusTag status={row.association_status || 'unassociated'} />
                  </td>
                  <td className={`${tableCellClass} max-w-[10rem] truncate text-gray-600`} title={row.expense_contract_label}>
                    {row.expense_contract_label}
                  </td>
                  <td className={`${tableCellClass} max-w-[10rem] truncate text-gray-600`} title={row.buyer_name || ''}>
                    {row.buyer_name || '-'}
                  </td>
                  <td className={`${tableCellClass} text-center`}>
                    <CostInvoiceActionMenu
                      canEdit={rowCanEdit}
                      canDelete={canDelete}
                      onView={() => onView(row)}
                      onEdit={() => onEdit(row)}
                      onDelete={() => onDelete(row)}
                      onAssociate={() => onAssociate(row)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="sticky bottom-0 z-10 border-t-2 border-blue-200 bg-blue-50/95 font-bold backdrop-blur-sm">
            <tr>
              <td className={`${tableCellClass} text-blue-900`}>合计</td>
              <td className={tableCellClass} colSpan={3}></td>
              <td className={`${tableCellClass} ui-numeric text-right text-blue-900`}>
                {formatAmount(totals.invoiceAmount)} 元
              </td>
              <td className={`${tableCellClass} ui-numeric text-right text-blue-900`}>
                {formatAmount(totals.taxAmount)} 元
              </td>
              <td className={tableCellClass} colSpan={2}></td>
              <td className={`${tableCellClass} ui-numeric text-right text-blue-900`}>
                {formatAmount(totals.paidAmount)} 元
              </td>
              <td className={`${tableCellClass} ui-numeric text-right ${totals.remainingAmount > 0 ? 'text-red-700' : 'text-blue-900'}`}>
                {formatAmount(totals.remainingAmount)} 元
              </td>
              <td className={tableCellClass} colSpan={5}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 移动卡片 */}
      <div className="space-y-3 md:hidden">
        {rows.map((row) => {
          const paid = getPaid(row);
          const remaining = getRemaining(row);
          
          const isOwner = user?.id === row.created_by;
          const rowCanEdit = isSuperAdmin || (canEdit && isOwner);

          return (
            <article key={row.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="cursor-pointer" onClick={() => onView(row)}>
                  <p className="text-xs text-gray-500">#{row.rowIndex}</p>
                  <h4 className="font-medium text-gray-900 hover:text-blue-600 hover:underline">{row.project_name}</h4>
                  <p className="text-sm text-gray-600">{row.seller_display}</p>
                </div>
                <span className="shrink-0 rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                  {formatInvoiceTypeLabel(row.invoice_type, row.ocr_invoice_type_label)}
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div className="cursor-pointer" onClick={() => onView(row)}>
                  <dt className="text-gray-500">价税合计</dt>
                  <dd className="ui-numeric font-medium hover:text-blue-600">{formatAmount(row.invoice_amount)}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">尚欠</dt>
                  <dd className={`ui-numeric font-medium ${remaining > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                    {formatAmount(remaining)}
                  </dd>
                </div>
                <div className="cursor-pointer" onClick={() => onView(row)}>
                  <dt className="text-gray-500">开票日期</dt>
                  <dd className="hover:text-blue-600">{formatDateDisplay(row.invoice_date)}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">已付</dt>
                  <dd>
                    <CostInvoicePaidCell paid={paid} payments={row.payments} />
                  </dd>
                </div>
                <div className="col-span-2 mt-2 flex items-center justify-between border-t border-gray-50 pt-2">
                  <AssociationStatusTag status={row.association_status || 'unassociated'} />
                  <CostInvoiceActionMenu
                    canEdit={rowCanEdit}
                    canDelete={canDelete}
                    onView={() => onView(row)}
                    onEdit={() => onEdit(row)}
                    onDelete={() => onDelete(row)}
                    onAssociate={() => onAssociate(row)}
                  />
                </div>
              </dl>
            </article>
          );
        })}
      </div>
    </>
  );
}
