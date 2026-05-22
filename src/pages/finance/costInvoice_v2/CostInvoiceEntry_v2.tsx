import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaPlus, FaCog } from 'react-icons/fa';
import { supabase } from '../../../supabase/client';
import { useCompanyScope } from '../../../hooks/useCompanyScope';
import { useCostInvoiceForm_v2 } from './useCostInvoiceForm_v2';
import CostInvoiceEntryWorkspace_v2 from './CostInvoiceEntryWorkspace_v2';
import UiModalOverlay from '../../../components/ui/UiModalOverlay';
import { useModalInteractionGuard } from '../../../hooks/useModalInteractionGuard';
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock';
import { projectSelectOptions } from '../../../components/ui/options';
import { 
  sellerFieldsFromForm, 
  syncProjectSupplier, 
  matchPartyBInBase,
  buildPartyBInsertFromSeller,
  DEFAULT_PARTY_B_UNIT_TYPE,
  mapPartyBTypeToSupplyCategory,
  type PartyBRow
} from '../costInvoice/sellerPartyBSync';
import { 
  invoicePaidAmount, 
  costInvoicePaymentWritePayload 
} from '../../../utils/costInvoiceAmounts';
import { resolvePersistOcrStatus } from '../costInvoice/applyOcrToForm';
import { addLog, logAction, logModule } from '../../../services/logService';
import { getStoredUser } from '../../../utils/sessionUser';
import { packExtendedRemark, initialCostInvoiceForm, type OcrUiStatus, type CostInvoiceForm } from '../costInvoice/types';
import CostInvoiceList from '../CostInvoiceList';
import { isFeatureEnabled, setFeatureEnabled, FEATURE_FLAGS } from '../../../utils/featureFlags';
import { deferModalOpen } from '../../../utils/deferModalOpen';
import { resetBodyInteractionLock } from '../../../utils/bodyInteractionLock';

export default function CostInvoiceEntry_v2() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentCompany, companyIds } = useCompanyScope();

  // State for data
  const [projects, setProjects] = useState<any[]>([]);
  const [partyBList, setPartyBList] = useState<any[]>([]);
  const [projectSuppliers, setProjectSuppliers] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [supplierSyncWarnings, setSupplierSyncWarnings] = useState<string[]>([]);

  // V2 Hook
  const {
    form,
    setForm,
    editingId,
    submitting,
    setSubmitting,
    ocr,
    resetForm,
    initFromInvoice,
    validate,
    uploadFile
  } = useCostInvoiceForm_v2({
    onSuccess: () => {
      setShowModal(false);
      fetchData();
    },
    onOcrComplete: (completedForm, status) => handleOcrComplete(completedForm, status)
  });

  useBodyScrollLock(showModal);
  const interactionReady = useModalInteractionGuard(showModal);

  useEffect(() => {
    fetchData();
  }, [currentCompany]);

  // Initial routing check (for edit/autoOpen)
  useEffect(() => {
    const state = location.state as { editInvoiceId?: string; autoOpen?: boolean } | null;
    if (state?.autoOpen) {
      openCreateModal();
      navigate(location.pathname, { replace: true, state: {} });
    } else if (state?.editInvoiceId) {
      fetchInvoiceAndOpen(state.editInvoiceId);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  async function fetchData() {
    try {
      let projectQuery = supabase.from('projects').select('id, name, company_id');
      if (companyIds.length > 0) projectQuery = projectQuery.in('company_id', companyIds);
      
      const [projRes, pbRes, supRes] = await Promise.all([
        projectQuery,
        supabase.from('party_b').select('*'),
        supabase.from('suppliers').select('*')
      ]);

      if (projRes.data) setProjects(projRes.data);
      if (pbRes.data) setPartyBList(pbRes.data);
      if (supRes.data) setProjectSuppliers(supRes.data);
    } catch (e) {
      console.error('[CostInvoiceEntry_v2] fetchData error', e);
    }
  }

  async function fetchInvoiceAndOpen(id: string) {
    const { data, error } = await supabase.from('cost_invoices').select('*').eq('id', id).single();
    if (data) {
      initFromInvoice(data);
      setShowModal(true);
    }
  }

  const syncProjectSupplierForForm = useCallback(async (invoiceForm: CostInvoiceForm, basePartyB?: PartyBRow) => {
    if (!invoiceForm.project_id?.trim() || !invoiceForm.seller_name?.trim()) return;

    const fields = sellerFieldsFromForm(invoiceForm);
    const sync = syncProjectSupplier(
      invoiceForm.project_id,
      fields,
      projectSuppliers,
      partyBList as PartyBRow[],
    );

    if (sync.status === 'warning') {
      setSupplierSyncWarnings((prev) => prev.includes(sync.message) ? prev : [...prev, sync.message]);
      return;
    }

    if (sync.status === 'matched') {
      setForm((f) => ({ ...f, supplier_id: sync.supplierId }));
      return;
    }

    if (sync.status === 'skipped') {
      // Auto create project supplier if not exists
      const partyB = basePartyB || matchPartyBInBase(partyBList as PartyBRow[], fields.seller_name, fields.seller_tax_id).partyB;
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
        setForm(f => ({ ...f, supplier_id: data.id }));
      }
    }
  }, [partyBList, projectSuppliers]);

  const handleOcrComplete = useCallback(async (completedForm: CostInvoiceForm, status: OcrUiStatus) => {
    if (status === 'failed' || !completedForm.seller_name?.trim()) return;
    const fields = sellerFieldsFromForm(completedForm);
    const match = matchPartyBInBase(partyBList as PartyBRow[], fields.seller_name, fields.seller_tax_id);
    
    if (match.status === 'exact' && match.partyB) {
      if (completedForm.project_id) {
        await syncProjectSupplierForForm(completedForm, match.partyB);
      }
    }
    // Note: If no match, UI in Workspace will handle prompting to add party_b
  }, [partyBList, syncProjectSupplierForForm]);

  const openCreateModal = useCallback(() => {
    resetForm();
    setSupplierSyncWarnings([]);
    const lastProject = localStorage.getItem('ciond_cost_invoice_last_project');
    if (lastProject) setForm((f) => ({ ...f, project_id: lastProject }));
    deferModalOpen(() => setShowModal(true));
  }, [resetForm, setForm]);

  const handleClose = useCallback(() => {
    try {
      if (ocr.ocrUiStatus === 'pending') {
        if (!window.confirm('识别正在进行中，确定要关闭吗？')) return;
      }
      setShowModal(false);
      resetForm();
      resetBodyInteractionLock();
    } catch (err) {
      console.error('[CostInvoiceEntry_v2] handleClose failed', err);
      setShowModal(false);
      resetForm();
      resetBodyInteractionLock();
    }
  }, [ocr, resetForm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validate();
    if (errors.length > 0) {
      alert(`请补全必填项：${errors.join('、')}`);
      return;
    }

    setSubmitting(true);
    try {
      const persistOcrStatus = resolvePersistOcrStatus(ocr.ocrUiStatus, form.attachment_urls.length > 0);
      const baseInvoiceData: any = {
        project_id: form.project_id,
        supplier_id: form.supplier_id,
        invoice_type: form.invoice_type,
        invoice_number: form.invoice_number,
        invoice_amount: form.invoice_amount,
        deductible_tax: form.invoice_type === '专票' ? form.deductible_tax ?? 0 : null,
        invoice_date: form.invoice_date,
        attachment_urls: form.attachment_urls.length > 0 ? form.attachment_urls : null,
        invoice_code: form.invoice_code.trim() || null,
        amount_excluding_tax: form.amount_excluding_tax ?? null,
        tax_rate: form.tax_rate ?? null,
        tax_amount: form.tax_amount ?? null,
        goods_name: form.goods_name.trim() || null,
        seller_name: form.seller_name.trim() || null,
        seller_tax_id: form.seller_tax_id.trim() || null,
        remark: packExtendedRemark(form) || null,
        ocr_invoice_type_label: form.ocr_invoice_type_label.trim() || null,
        ocr_status: form.attachment_urls.length > 0 ? persistOcrStatus : 'idle'
      };

      if (editingId) {
        // Need original invoice to calculate paid/remaining
        const { data: original } = await supabase.from('cost_invoices').select('*').eq('id', editingId).single();
        const paid = invoicePaidAmount(original);
        const payment = costInvoicePaymentWritePayload(form.invoice_amount ?? 0, paid);
        const { error } = await supabase.from('cost_invoices').update({ ...baseInvoiceData, ...payment }).eq('id', editingId);
        if (error) throw error;
        
        await addLog(logModule.INVOICE, logAction.UPDATE, `更新成本发票：${form.invoice_number}`, { id: editingId, ...baseInvoiceData });
      } else {
        const user = getStoredUser();
        const payment = costInvoicePaymentWritePayload(form.invoice_amount ?? 0, 0);
        const { error, data: inserted } = await supabase.from('cost_invoices').insert({ 
          ...baseInvoiceData, 
          ...payment,
          created_by: user.id || null 
        }).select().single();
        if (error) throw error;
        
        await addLog(logModule.INVOICE, logAction.CREATE, `录入成本发票：${form.invoice_number}`, { id: inserted?.id, ...baseInvoiceData });
      }

      if (form.project_id) localStorage.setItem('ciond_cost_invoice_last_project', form.project_id);
      alert('保存成功');
      setShowModal(false);
      fetchData();
    } catch (err: any) {
      alert('提交失败: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const projectOptions = useMemo(() => projectSelectOptions(projects), [projects]);
  const supplierOptions = useMemo(() => {
    const filtered = projects.find(p => p.id === form.project_id) ? projectSuppliers.filter(s => s.project_id === form.project_id) : [];
    return [
      { value: '', label: form.project_id ? (filtered.length ? '选择乙方单位' : '该项目暂无乙方') : '请先选择项目' },
      ...filtered.map(s => ({ value: s.id, label: `${s.name} (${s.supply_category})` }))
    ];
  }, [form.project_id, projectSuppliers, projects]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-800">成本发票录入</h3>
          <p className="text-xs text-slate-500 mt-1">
            智能录入引擎 V2 · 已正式上线
            <button 
              onClick={() => {
                if (confirm('确认切换回旧版录入页面？')) {
                  setFeatureEnabled(FEATURE_FLAGS.COST_INVOICE_V2, false);
                  window.location.reload();
                }
              }}
              className="ml-2 text-blue-600 hover:underline flex items-center gap-1 inline-flex"
            >
              <FaCog /> 兼容模式
            </button>
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md transition-all active:scale-95"
        >
          <FaPlus /> 录入发票
        </button>
      </div>

      <CostInvoiceList embedded />

      <UiModalOverlay
        open={showModal}
        onClose={handleClose}
        panelClassName="bg-white rounded-xl p-0 w-full max-w-[min(96vw,1400px)] max-h-[95vh] overflow-hidden shadow-2xl"
      >
        <CostInvoiceEntryWorkspace_v2
          form={form}
          setForm={setForm}
          editing={!!editingId}
          submitting={submitting}
          projectOptions={projectOptions}
          supplierOptions={supplierOptions}
          supplierSyncWarnings={supplierSyncWarnings}
          ocr={ocr}
          uploadFile={uploadFile}
          onSubmit={handleSubmit}
          onClose={handleClose}
          onProjectChange={(pid: string) => {
            setSupplierSyncWarnings([]);
            setForm(f => {
              const next = { ...f, project_id: pid, supplier_id: '' };
              syncProjectSupplierForForm(next);
              return next;
            });
          }}
          interactionReady={interactionReady}
        />
      </UiModalOverlay>
    </motion.div>
  );
}
