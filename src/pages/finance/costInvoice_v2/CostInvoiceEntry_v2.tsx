import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaPlus } from 'react-icons/fa';
import { supabase } from '../../../supabase/client';
import { useCompanyScope } from '../../../hooks/useCompanyScope';
import { useCostInvoiceForm_v2 } from './useCostInvoiceForm_v2';
import { useSupplierSync } from './useSupplierSync';
import { useInvoiceSubmit } from './useInvoiceSubmit';
import CostInvoiceEntryWorkspace_v2 from './CostInvoiceEntryWorkspace_v2';
import UiModalOverlay from '../../../components/ui/UiModalOverlay';
import { useModalInteractionGuard } from '../../../hooks/useModalInteractionGuard';
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock';
import { projectSelectOptions } from '../../../components/ui/options';
import { type PartyBRow } from '../costInvoice/sellerPartyBSync';
import { type CostInvoiceForm } from '../costInvoice/types';
import CostInvoiceList from '../CostInvoiceList';
import { deferModalOpen } from '../../../utils/deferModalOpen';
import { resetBodyInteractionLock } from '../../../utils/bodyInteractionLock';

export default function CostInvoiceEntry_v2() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentCompany, companyIds } = useCompanyScope();

  const [projects, setProjects] = useState<any[]>([]);
  const [partyBList, setPartyBList] = useState<PartyBRow[]>([]);
  const [projectSuppliers, setProjectSuppliers] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);

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
    onSuccess: handleSuccess,
    onOcrComplete: handleOcrComplete
  });

  const { warnings, clearWarnings, syncProjectSupplierForForm } = useSupplierSync(
    partyBList,
    projectSuppliers,
    setProjectSuppliers
  );

  const { handleSubmit } = useInvoiceSubmit(
    form,
    editingId,
    ocr.ocrUiStatus,
    validate,
    handleSuccess
  );

  useBodyScrollLock(showModal);
  const interactionReady = useModalInteractionGuard(showModal);

  useEffect(() => {
    fetchData();
  }, [currentCompany]);

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

  function handleOcrComplete(completedForm: CostInvoiceForm) {
    syncProjectSupplierForForm(completedForm);
  }

  function handleSuccess() {
    setShowModal(false);
    fetchData();
  }

  const openCreateModal = useCallback(() => {
    resetForm();
    clearWarnings();
    const lastProject = localStorage.getItem('ciond_cost_invoice_last_project');
    if (lastProject) setForm((f) => ({ ...f, project_id: lastProject }));
    deferModalOpen(() => setShowModal(true));
  }, [resetForm, clearWarnings, setForm]);

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

  const handleSubmitWithState = useCallback(async (e: React.FormEvent) => {
    setSubmitting(true);
    try {
      await handleSubmit(e);
    } finally {
      setSubmitting(false);
    }
  }, [handleSubmit, setSubmitting]);

  const handleProjectChange = useCallback((pid: string) => {
    clearWarnings();
    setForm(f => {
      const next = { ...f, project_id: pid, supplier_id: '' };
      syncProjectSupplierForForm(next);
      return next;
    });
  }, [clearWarnings, setForm, syncProjectSupplierForForm]);

  const projectOptions = useMemo(() => projectSelectOptions(projects), [projects]);
  const supplierOptions = useMemo(() => {
    const filtered = projects.find(p => p.id === form.project_id)
      ? projectSuppliers.filter(s => s.project_id === form.project_id)
      : [];
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
        showCloseButton={false}
        panelClassName="bg-white rounded-xl p-0 w-full max-w-[min(96vw,1400px)] max-h-[95vh] overflow-hidden shadow-2xl"
      >
        <CostInvoiceEntryWorkspace_v2
          form={form}
          setForm={setForm}
          editing={!!editingId}
          submitting={submitting}
          projectOptions={projectOptions}
          supplierOptions={supplierOptions}
          supplierSyncWarnings={warnings}
          ocr={ocr}
          uploadFile={uploadFile}
          onSubmit={handleSubmitWithState}
          onClose={handleClose}
          onProjectChange={handleProjectChange}
          interactionReady={interactionReady}
        />
      </UiModalOverlay>
    </motion.div>
  );
}
