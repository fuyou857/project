import { useCallback, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase/client';
import { useAuth } from '../../hooks/useAuth';
import { useMergedRolePermissions } from '../../hooks/useMergedRolePermissions';
import SingleToastBanner from '../../components/ui/SingleToastBanner';
import { useSingleToast } from '../../hooks/useSingleToast';
import CostInvoiceFilters from './costInvoice/list/CostInvoiceFilters';
import CostInvoiceListView from './costInvoice/list/CostInvoiceListView';
import CostInvoicePagination from './costInvoice/list/CostInvoicePagination';
import CostInvoiceDetailModal from './costInvoice/list/CostInvoiceDetailModal';
import CostInvoiceDeleteDialog from './costInvoice/list/CostInvoiceDeleteDialog';
import AssociateBusinessDialog from './costInvoice/list/AssociateBusinessDialog';
import { useCostInvoiceList } from './costInvoice/list/useCostInvoiceList';
import type { EnrichedCostInvoiceRow } from './costInvoice/list/types';

type Props = { embedded?: boolean };

export default function CostInvoiceList({ embedded = false }: Props) {
  const navigate = useNavigate();
  const { isSuperAdmin, isStrictSuperAdmin } = useAuth();
  const { mergedPerms } = useMergedRolePermissions();
  const list = useCostInvoiceList();

  const [detailRow, setDetailRow] = useState<EnrichedCostInvoiceRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EnrichedCostInvoiceRow | null>(null);
  const [associateTarget, setAssociateTarget] = useState<EnrichedCostInvoiceRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast, showToast } = useSingleToast();

  const canEdit = isSuperAdmin || mergedPerms.has('成本发票录入');
  const canDelete = isSuperAdmin || isStrictSuperAdmin;

  const sellerSuggestions = useMemo(() => {
    const names = new Set<string>();
    list.rows.forEach((r) => {
      if (r.seller_display && r.seller_display !== '-') names.add(r.seller_display);
    });
    return [...names].slice(0, 30);
  }, [list.rows]);

  const invoiceNumberSuggestions = useMemo(() => {
    return list.rows.map((r) => r.invoice_number).filter(Boolean).slice(0, 30) as string[];
  }, [list.rows]);

  const handleFilterChange = useCallback(
    (patch: Partial<typeof list.filters>) => {
      list.setFilters((f) => ({ ...f, ...patch }));
      list.setPage(1);
    },
    [list],
  );

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('cost_invoices').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (error) {
      showToast('error', `删除失败：${error.message}`);
      return;
    }
    showToast('success', '发票已删除');
    setDeleteTarget(null);
    void list.fetchList();
  };

  const handleEdit = (row: EnrichedCostInvoiceRow) => {
    navigate('/finance/cost-invoice', { state: { editInvoiceId: row.id } });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {toast && <SingleToastBanner type={toast.type} message={toast.message} />}

      {!embedded && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="ui-page-title text-gray-900">成本发票管理</h1>
            <p className="text-caption mt-1 text-gray-500">查询、查看与管理项目成本发票</p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={() => navigate('/finance/cost-invoice', { state: { autoOpen: true } })}
              className="min-h-[44px] rounded-lg bg-blue-600 px-4 py-2 text-sm text-white transition hover:bg-blue-700 active:scale-[0.98]"
            >
              录入发票
            </button>
          )}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
        <CostInvoiceFilters
          filters={list.filters}
          onChange={handleFilterChange}
          onReset={list.resetFilters}
          projects={list.projects}
          expenseContracts={list.expenseContracts}
          allUsers={list.allUsers}
          sellerSuggestions={sellerSuggestions}
          invoiceNumberSuggestions={invoiceNumberSuggestions}
        />

        {list.error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {list.error}
            <button
              type="button"
              onClick={() => void list.fetchList()}
              className="ml-3 font-medium underline hover:no-underline"
            >
              重试
            </button>
          </div>
        )}

        <div className="mt-4">
          <CostInvoiceListView
            rows={list.rows}
            loading={list.loading}
            sort={list.sort}
            onSort={list.toggleSort}
            getPaid={list.getPaid}
            getRemaining={list.getRemaining}
            canEdit={canEdit}
            canDelete={canDelete}
            onView={setDetailRow}
            onEdit={handleEdit}
            onDelete={setDeleteTarget}
            onAssociate={setAssociateTarget}
          />
        </div>

        <div className="mt-4">
          <CostInvoicePagination
            page={list.page}
            pageSize={list.pageSize}
            total={list.total}
            onPageChange={list.setPage}
            onPageSizeChange={(size) => {
              list.setPageSize(size);
              list.setPage(1);
            }}
          />
        </div>
      </div>

      <CostInvoiceDetailModal invoice={detailRow} onClose={() => setDetailRow(null)} />

      <CostInvoiceDeleteDialog
        open={!!deleteTarget}
        invoiceNumber={deleteTarget?.invoice_number || ''}
        deleting={deleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />

      <AssociateBusinessDialog
        invoice={associateTarget}
        onClose={() => setAssociateTarget(null)}
        onSuccess={() => {
          setAssociateTarget(null);
          showToast('success', '关联业务已更新');
          void list.fetchList();
        }}
      />
    </motion.div>
  );
}
