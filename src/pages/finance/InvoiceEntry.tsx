import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaPlus, FaTimes } from 'react-icons/fa';
import { getStoredUser } from '../../utils/sessionUser';
import CostInvoiceList from './CostInvoiceList';
import { SegmentedControl } from '../../components/ui';
import UiModalOverlay from '../../components/ui/UiModalOverlay';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useModalInteractionGuard } from '../../hooks/useModalInteractionGuard';
import { supabase } from '../../supabase/client';
import { alertMissingRequiredFields } from '../../utils/contractSubPage';
import { useCompanyScope } from '../../hooks/useCompanyScope';
import { useInvoiceOcrForm } from '../../hooks/useInvoiceOcrForm';
import { projectSelectOptions } from '../../components/ui/options';
import CostInvoiceEntryWorkspace from './costInvoice/CostInvoiceEntryWorkspace';
import CostInvoiceEntry_v2 from './costInvoice_v2/CostInvoiceEntry_v2';
import {
  type CostInvoiceForm,
  type InvoiceAttachmentItem,
  type OcrUiStatus,
  initialCostInvoiceForm,
  packExtendedRemark,
  unpackExtendedRemark,
  COST_INVOICE_MAX_BYTES } from
'./costInvoice/types';
import { resolveInvoiceFileMime, storageExtensionForFile } from './costInvoice/invoiceFileUtils';
import {
  buildPartyBInsertFromSeller,
  DEFAULT_PARTY_B_UNIT_TYPE,
  mapPartyBTypeToSupplyCategory,
  matchPartyBInBase,
  sellerFieldsFromForm,
  syncProjectSupplier,
  type PartyBRow,
} from './costInvoice/sellerPartyBSync';
import {
  invoicePaidAmount,
  costInvoicePaymentWritePayload } from
'../../utils/costInvoiceAmounts';
import { resolvePersistOcrStatus } from './costInvoice/applyOcrToForm';
import { addLog, logAction, logModule } from '../../services/logService';
import { deferModalOpen } from '../../utils/deferModalOpen';
import { resetBodyInteractionLock } from '../../utils/bodyInteractionLock';
import { isFeatureEnabled, FEATURE_FLAGS } from '../../utils/featureFlags';

export type { InvoiceAttachmentItem };

interface Invoice {
  id: string;
  project_id: string;
  supplier_id: string;
  company_id?: string | null;
  invoice_type: string;
  invoice_number: string;
  invoice_amount: number;
  deductible_tax: number | null;
  is_paid: boolean;
  payment_record_id: string | null;
  invoice_date: string;
  attachment_url: string | null;
  attachment_urls?: InvoiceAttachmentItem[] | null;
  paid_amount: number;
  remaining_amount: number;
  invoice_code?: string | null;
  amount_excluding_tax?: number | null;
  tax_rate?: number | null;
  tax_amount?: number | null;
  goods_name?: string | null;
  seller_name?: string | null;
  seller_tax_id?: string | null;
  remark?: string | null;
  ocr_invoice_type_label?: string | null;
  ocr_status?: string | null;
}

interface Project {
  id: string;
  name: string;
  company_id?: string | null;
}

interface PartyB {
  id: string;
  unit_name: string;
  unit_type: string;
  phone: string;
  credit_code: string;
  bank_name: string;
  bank_account: string;
}

interface Supplier {
  id: string;
  project_id: string;
  name: string;
  supply_category: string;
}

const initialPartyB = {
  unit_name: '',
  unit_type: DEFAULT_PARTY_B_UNIT_TYPE,
  phone: '',
  credit_code: '',
  bank_name: '',
  bank_account: '',
};

const PAGE_SIZE = 15;

function normalizeAttachments(raw: unknown): InvoiceAttachmentItem[] {
  if (!raw) return [];
  if (!Array.isArray(raw)) return [];
  return raw.
  map((item) => {
    if (!item || typeof item !== 'object') return null;
    const o = item as Record<string, unknown>;
    const url = typeof o.url === 'string' ? o.url : '';
    if (!url) return null;
    return {
      url,
      filename: typeof o.filename === 'string' ? o.filename : url.split('/').pop() || '附件',
      mime: typeof o.mime === 'string' ? o.mime : ''
    };
  }).
  filter(Boolean) as InvoiceAttachmentItem[];
}

export default function InvoiceEntry() {
  // 特性标志检查：如果V2已启用，直接返回V2组件
  const v2Enabled = isFeatureEnabled(FEATURE_FLAGS.COST_INVOICE_V2);
  if (v2Enabled) {
    return <CostInvoiceEntry_v2 />;
  }

  const location = useLocation();
  const { currentCompany, companies, companyIds } = useCompanyScope();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [partyBList, setPartyBList] = useState<PartyB[]>([]);
  const [projectSuppliers, setProjectSuppliers] = useState<Supplier[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showAddPartyB, setShowAddPartyB] = useState(false);
  const [form, setForm] = useState<CostInvoiceForm>(initialCostInvoiceForm);
  const [partyBForm, setPartyBForm] = useState(initialPartyB);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [partyBSearch, setPartyBSearch] = useState('');
  const [supplierSyncWarnings, setSupplierSyncWarnings] = useState<string[]>([]);
  const [addPartyBFromOcr, setAddPartyBFromOcr] = useState(false);

  const navigate = useNavigate();

  useBodyScrollLock(showModal || showAddPartyB);
  const invoiceModalInteractionReady = useModalInteractionGuard(showModal);

  // 确保组件初始化时不会有残留的弹窗状态
  useEffect(() => {
    console.log('[InvoiceEntry] 初始化 - 重置弹窗状态');
    setShowAddPartyB(false);
    setAddPartyBFromOcr(false);
  }, []);

  // 调试：追踪 showAddPartyB 状态变化
  useEffect(() => {
    console.log('[InvoiceEntry] showAddPartyB 状态变化:', showAddPartyB);
  }, [showAddPartyB]);

  useEffect(() => {
    fetchData();
  }, [currentCompany, companies]);

  useEffect(() => {
    const state = location.state as { editInvoiceId?: string; autoOpen?: boolean } | null;
    const editId = state?.editInvoiceId;
    const autoOpen = state?.autoOpen;

    if (autoOpen) {
      openCreateModal();
      navigate(location.pathname, { replace: true, state: {} });
      return;
    }

    if (!editId || invoices.length === 0) return;
    const inv = invoices.find((i) => i.id === editId);
    if (inv) {
      openEditModal(inv);
      // 清理 state 防止刷新页面重复弹窗，使用 navigate 彻底清除 router state
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, invoices, navigate, location.pathname]);

  async function fetchData() {
    try {

      let projectQuery = supabase.from('projects').select('id, name, company_id');
      if (companyIds.length > 0) {
        projectQuery = projectQuery.in('company_id', companyIds);
      }
      const projRes = await projectQuery;
      if (projRes.error) {
        console.error('[InvoiceEntry] projects', projRes.error);
        return;
      }
      const projectRows = (projRes.data ?? []) as Project[];
      const projectIds = projectRows.map((p) => p.id);

      if (companyIds.length > 0 && projectIds.length === 0) {
        setInvoices([]);
        setProjects(projectRows);
        const [pbRes, supRes] = await Promise.all([
        supabase.from('party_b').select('*'),
        supabase.from('suppliers').select('*')]
        );
        if (pbRes.error) console.error('[InvoiceEntry] party_b', pbRes.error);else
        if (pbRes.data) setPartyBList(pbRes.data);
        if (supRes.error) console.error('[InvoiceEntry] suppliers', supRes.error);else
        if (supRes.data) setProjectSuppliers(supRes.data);
        return;
      }

      let invoiceQuery = supabase.
      from('cost_invoices').
      select('*').
      order('id', { ascending: false }).
      limit(PAGE_SIZE);
      if (companyIds.length > 0) {
        invoiceQuery = invoiceQuery.in('project_id', projectIds);
      }

      const [invRes, pbRes, supRes] = await Promise.all([
      invoiceQuery,
      supabase.from('party_b').select('*'),
      supabase.from('suppliers').select('*')]
      );
      if (invRes.error) console.error('[InvoiceEntry] cost_invoices', invRes.error);else
      if (invRes.data) setInvoices(invRes.data as Invoice[]);
      setProjects(projectRows);
      if (pbRes.error) console.error('[InvoiceEntry] party_b', pbRes.error);else
      if (pbRes.data) setPartyBList(pbRes.data);
      if (supRes.error) console.error('[InvoiceEntry] suppliers', supRes.error);else
      if (supRes.data) setProjectSuppliers(supRes.data);
    } catch (e) {
      console.error('[InvoiceEntry] fetchData', e);
    }
  }

  const syncProjectSupplierForForm = useCallback(
    async (invoiceForm: CostInvoiceForm, basePartyB?: PartyBRow) => {
      if (!invoiceForm.project_id?.trim() || !invoiceForm.seller_name?.trim()) return;

      const fields = sellerFieldsFromForm(invoiceForm);
      const sync = syncProjectSupplier(
        invoiceForm.project_id,
        fields,
        projectSuppliers,
        partyBList as PartyBRow[],
      );

      if (sync.status === 'warning') {
        setSupplierSyncWarnings((prev) =>
          prev.includes(sync.message) ? prev : [...prev, sync.message],
        );
        return;
      }

      if (sync.status === 'matched') {
        setForm((f) => ({ ...f, supplier_id: sync.supplierId }));
        await addLog(
          logModule.INVOICE,
          logAction.UPDATE,
          `成本发票录入：自动关联项目乙方「${invoiceForm.seller_name.trim()}」`,
          { project_id: invoiceForm.project_id, supplier_id: sync.supplierId },
        );
        return;
      }

      if (sync.status !== 'skipped') return;

      const partyB =
        basePartyB ||
        matchPartyBInBase(partyBList as PartyBRow[], fields.seller_name, fields.seller_tax_id).partyB;
      const supplyCategory = mapPartyBTypeToSupplyCategory(partyB?.unit_type);
      const { bank_name, bank_account } = buildPartyBInsertFromSeller(fields);

      const { data, error } = await supabase
        .from('suppliers')
        .insert({
          project_id: invoiceForm.project_id,
          name: fields.seller_name.trim(),
          supply_category: supplyCategory,
          bank_account: bank_account || null,
          bank_name: bank_name || null,
          status: 'active',
        })
        .select()
        .maybeSingle();

      if (error) {
        setSupplierSyncWarnings((prev) => [
          ...prev,
          `自动添加项目乙方失败：${error.message}`,
        ]);
        await addLog(
          logModule.INVOICE,
          logAction.CREATE,
          `成本发票录入：自动添加项目乙方失败「${fields.seller_name.trim()}」`,
          { project_id: invoiceForm.project_id, error: error.message },
          'failed',
        );
        return;
      }

      if (data) {
        setProjectSuppliers((prev) => [...prev, data as Supplier]);
        setForm((f) => ({ ...f, supplier_id: data.id }));
        await addLog(
          logModule.INVOICE,
          logAction.CREATE,
          `成本发票录入：自动添加项目乙方「${data.name}」`,
          { project_id: invoiceForm.project_id, supplier_id: data.id },
        );
      }
    },
    [partyBList, projectSuppliers],
  );

  const handleOcrComplete = useCallback(
    async (completedForm: CostInvoiceForm, status: OcrUiStatus) => {
      if (status === 'failed' || !completedForm.seller_name?.trim()) return;

      const fields = sellerFieldsFromForm(completedForm);
      const match = matchPartyBInBase(partyBList as PartyBRow[], fields.seller_name, fields.seller_tax_id);
      const warnings: string[] = [];

      if (match.status === 'exact' && match.partyB) {
        setSupplierSyncWarnings([]);
        await addLog(
          logModule.BASE_DATA,
          logAction.VIEW,
          `成本发票OCR：销售方与基础数据乙方完全匹配「${match.partyB.unit_name}」`,
          { party_b_id: match.partyB.id, credit_code: match.partyB.credit_code },
        );
        if (completedForm.project_id) {
          await syncProjectSupplierForForm(completedForm, match.partyB);
        }
        return;
      }

      if (match.message) warnings.push(match.message);

      if (match.status === 'none') {
        const draft = buildPartyBInsertFromSeller(fields);
        setPartyBForm({
          unit_name: draft.unit_name,
          unit_type: draft.unit_type || DEFAULT_PARTY_B_UNIT_TYPE,
          phone: draft.phone || '',
          credit_code: draft.credit_code || '',
          bank_name: draft.bank_name || '',
          bank_account: draft.bank_account || '',
        });
        warnings.push('系统中未找到匹配的乙方单位，如需新增请点击「新增乙方单位」按钮');
      }

      setSupplierSyncWarnings(warnings);
    },
    [partyBList, syncProjectSupplierForForm],
  );

  const ocr = useInvoiceOcrForm({ setForm, onOcrComplete: handleOcrComplete });

  const onClose = useCallback(() => {
    try {
      if (ocr.ocrUiStatus === 'pending') {
        if (!window.confirm('识别正在进行中，确定要关闭吗？')) return;
      }
      setShowModal(false);
      setShowAddPartyB(false);
      setAddPartyBFromOcr(false);
      setEditingInvoice(null);
      setForm(initialCostInvoiceForm());
      ocr.resetOcrMeta();
      resetBodyInteractionLock();
    } catch (err) {
      console.error('[InvoiceEntry] onClose failed', err);
      setShowModal(false);
      setShowAddPartyB(false);
      resetBodyInteractionLock();
    }
  }, [ocr, setShowModal, setShowAddPartyB, setAddPartyBFromOcr, setEditingInvoice, setForm, resetBodyInteractionLock]);

  const handleProjectChange = useCallback(
    (projectId: string) => {
      setSupplierSyncWarnings([]);
      setForm((f) => {
        const next = { ...f, project_id: projectId, supplier_id: '' };
        if (projectId && next.seller_name?.trim()) {
          void syncProjectSupplierForForm(next);
        }
        return next;
      });
    },
    [syncProjectSupplierForForm],
  );

  async function handleAddPartyB() {
    if (!partyBForm.unit_name) {
      alert('请输入乙方单位名称');
      return;
    }
    const insertData = {
      unit_name: partyBForm.unit_name.trim(),
      unit_type: partyBForm.unit_type || DEFAULT_PARTY_B_UNIT_TYPE,
      phone: partyBForm.phone || null,
      credit_code: partyBForm.credit_code || null,
      bank_name: partyBForm.bank_name || null,
      bank_account: partyBForm.bank_account || null,
    };
    const { data, error } = await supabase.from('party_b').insert(insertData).select().maybeSingle();
    if (error) {
      alert('新增失败: ' + error.message);
      await addLog(
        logModule.BASE_DATA,
        logAction.CREATE,
        `成本发票录入：新增基础数据乙方失败「${partyBForm.unit_name}」`,
        insertData,
        'failed',
      );
      return;
    }
    if (data) {
      setPartyBList((prev) => [data as PartyB, ...prev]);
      await addLog(
        logModule.BASE_DATA,
        logAction.CREATE,
        `成本发票录入：新增基础数据乙方「${data.unit_name}」`,
        { party_b_id: data.id, ...insertData },
      );
      const nextForm = { ...form };
      if (form.project_id) {
        await syncProjectSupplierForForm(nextForm, data as PartyBRow);
      }
    }
    setShowAddPartyB(false);
    setAddPartyBFromOcr(false);
    setPartyBForm(initialPartyB);
    setPartyBSearch('');
  }

  const uploadSingleFile = useCallback(async (file: File): Promise<InvoiceAttachmentItem> => {
    if (file.size > COST_INVOICE_MAX_BYTES) throw new Error('文件大小不能超过12MB');
    const contentType = resolveInvoiceFileMime(file);
    if (!contentType) {
      throw new Error(
        `不支持的文件类型（浏览器报告 MIME：「${file.type || '空'}」）。请使用 JPG / PNG / PDF / OFD。`
      );
    }
    const buf = await file.arrayBuffer();
    const storageExt = storageExtensionForFile(file);
    const path = `invoices/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${storageExt}`;

    // Supabase Storage 对 MIME 类型限制严格，使用 file.type 或自动检测
    // 对于不支持的 MIME 类型，尝试使用原文件类型或省略 contentType
    let uploadOptions: {contentType?: string;upsert?: boolean;} = {};
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];

    if (allowedMimes.includes(contentType) || contentType.startsWith('image/')) {
      uploadOptions.contentType = contentType;
    }
    // 对于 OFD 等特殊格式，不指定 contentType，让 Supabase 自动检测

    const { error } = await supabase.storage.from('files').upload(path, new Uint8Array(buf), uploadOptions);
    if (error) throw new Error(error.message || '存储上传失败');
    const {
      data: { publicUrl }
    } = supabase.storage.from('files').getPublicUrl(path);
    return { url: publicUrl, filename: file.name, mime: contentType };
  }, []);

  const priceTaxMismatch = useMemo(() => {
    const { invoice_amount, amount_excluding_tax, tax_amount } = form;
    if (invoice_amount == null || amount_excluding_tax == null || tax_amount == null) return false;
    return Math.abs(amount_excluding_tax + tax_amount - invoice_amount) > 0.02;
  }, [form.invoice_amount, form.amount_excluding_tax, form.tax_amount]);

  const projectSuppliersList = useMemo(
    () => !form.project_id ? [] : projectSuppliers.filter((ps) => ps.project_id === form.project_id),
    [form.project_id, projectSuppliers]
  );

  const invoiceModalProjectOptions = useMemo(() => projectSelectOptions(projects), [projects]);

  const invoiceModalSupplierOptions = useMemo(() => {
    const emptyLabel = (() => {if (!form.project_id) {return (
          '请先选择项目');} else {if (
        projectSuppliersList.length === 0) {return (
            '该项目暂无乙方单位');} else {return (
            '选择乙方单位');}}})();
    return [
    { value: '', label: emptyLabel },
    ...projectSuppliersList.map((s) => ({ value: s.id, label: `${s.name} (${s.supply_category})` }))];

  }, [form.project_id, projectSuppliersList]);


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const missing: string[] = [];
    if (!form.project_id) missing.push('项目名称');
    if (!form.supplier_id) missing.push('开票单位');
    if (!form.invoice_number?.trim()) missing.push('发票编号');
    if (!form.invoice_amount || form.invoice_amount <= 0) missing.push('开票金额（价税合计）');
    if (!form.invoice_date) missing.push('开票日期');
    if (alertMissingRequiredFields(missing)) return;

    const persistOcrStatus = resolvePersistOcrStatus(
      ocr.ocrUiStatus,
      form.attachment_urls.length > 0,
    );

    const baseInvoiceData: Record<string, unknown> = {
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

    if (editingInvoice) {
      const paid = invoicePaidAmount(editingInvoice);
      const payment = costInvoicePaymentWritePayload(form.invoice_amount ?? 0, paid);
      const invoiceData = {
        ...baseInvoiceData,
        ...payment,
        payment_record_id: editingInvoice.payment_record_id
      };
      const { error } = await supabase.from('cost_invoices').update(invoiceData).eq('id', editingInvoice.id);
      if (error) {
        alert('保存失败: ' + error.message);
        return;
      }
      alert('保存成功');
    } else {
      const user = getStoredUser();
      const invoiceData = {
        ...baseInvoiceData,
        ...costInvoicePaymentWritePayload(form.invoice_amount ?? 0, 0),
        created_by: user.id || null,
      };
      const { error } = await supabase.from('cost_invoices').insert(invoiceData);
      if (error) {
        alert('新增失败: ' + error.message);
        return;
      }
      alert('保存成功');
    }

    if (form.project_id) localStorage.setItem('ciond_cost_invoice_last_project', form.project_id);
    onClose();
    fetchData();
  }

  function openCreateModal() {
    console.log('[InvoiceEntry] openCreateModal - 开始');
    setEditingInvoice(null);
    setForm(initialCostInvoiceForm());
    ocr.resetOcrMeta();
    setSupplierSyncWarnings([]);
    setAddPartyBFromOcr(false);
    setShowAddPartyB(false);
    console.log('[InvoiceEntry] openCreateModal - showAddPartyB 已设置为 false');
    const savedProject = localStorage.getItem('ciond_cost_invoice_last_project');
    if (savedProject) setForm((f) => ({ ...f, project_id: savedProject }));
    deferModalOpen(() => {
      console.log('[InvoiceEntry] openCreateModal - 打开主窗口');
      setShowModal(true);
    });
  }

  function openEditModal(inv: Invoice) {
    setEditingInvoice(inv);
    setShowAddPartyB(false);
    setAddPartyBFromOcr(false);
    const urls = normalizeAttachments(inv.attachment_urls);
    const ext = unpackExtendedRemark(inv.remark);
    setForm({
      ...initialCostInvoiceForm(),
      ...ext,
      project_id: inv.project_id,
      supplier_id: inv.supplier_id,
      invoice_type: inv.invoice_type || '普票',
      invoice_number: inv.invoice_number,
      invoice_amount: inv.invoice_amount,
      deductible_tax: inv.deductible_tax || undefined,
      invoice_date: inv.invoice_date || new Date().toISOString().split('T')[0],
      attachment_url: inv.attachment_url || urls[0]?.url || '',
      attachment_urls: (() => {if (urls.length) {return urls;} else {if (inv.attachment_url) {return [{ url: inv.attachment_url, filename: inv.attachment_url.split('/').pop() || '附件', mime: '' }];} else {return [];}}})(),
      invoice_code: inv.invoice_code || '',
      amount_excluding_tax: inv.amount_excluding_tax ?? undefined,
      tax_rate: inv.tax_rate ?? undefined,
      tax_amount: inv.tax_amount ?? undefined,
      goods_name: inv.goods_name || '',
      seller_name: inv.seller_name || '',
      seller_tax_id: inv.seller_tax_id || '',
      remark: ext.remark ?? inv.remark ?? '',
      ocr_invoice_type_label: inv.ocr_invoice_type_label || ''
    });
    ocr.setOcrUiStatus((inv.ocr_status as OcrUiStatus) || 'idle');
    deferModalOpen(() => setShowModal(true));
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-gray-800">成本发票录入</h3>
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openCreateModal();
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
          
          <FaPlus /> 录入发票
        </button>
      </div>

      <CostInvoiceList embedded />

      <UiModalOverlay
        open={showModal}
        onClose={onClose}
        panelClassName="bg-white rounded-xl p-4 sm:p-6 w-full max-w-[min(96vw,1400px)] max-h-[95vh] overflow-hidden shadow-xl"
      >
        <CostInvoiceEntryWorkspace
          fileUploadEnabled={invoiceModalInteractionReady}
          editing={!!editingInvoice}
          form={form}
          setForm={setForm}
          projectOptions={invoiceModalProjectOptions}
          supplierOptions={invoiceModalSupplierOptions}
          projectSuppliersEmpty={!!form.project_id && projectSuppliersList.length === 0}
          supplierSyncWarnings={supplierSyncWarnings}
          uploadSingleFile={uploadSingleFile}
          onSubmit={handleSubmit}
          onClose={onClose}
          priceTaxMismatch={priceTaxMismatch}
          ocr={ocr}
          onOcrComplete={handleOcrComplete}
          onProjectChange={handleProjectChange}
          onOpenAddPartyB={() => {
            const fields = sellerFieldsFromForm(form);
            const draft = buildPartyBInsertFromSeller(fields);
            setPartyBForm({
              unit_name: draft.unit_name || partyBForm.unit_name,
              unit_type: draft.unit_type || DEFAULT_PARTY_B_UNIT_TYPE,
              phone: draft.phone || '',
              credit_code: draft.credit_code || '',
              bank_name: draft.bank_name || '',
              bank_account: draft.bank_account || '',
            });
            setAddPartyBFromOcr(false);
            setShowAddPartyB(true);
          }}
        />
      </UiModalOverlay>

      <UiModalOverlay
        open={showAddPartyB}
        onClose={() => {
          setShowAddPartyB(false);
          setAddPartyBFromOcr(false);
        }}
        zIndex={60}
        panelClassName="bg-white rounded-xl p-6 w-full max-w-md border border-gray-200"
      >
        {addPartyBFromOcr && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
            基础数据库中没有此乙方单位，是否一并新增？确认前可修改下方信息。
          </p>
        )}
        <div className="mb-4">
          <h3 className="text-lg font-bold text-gray-800">新增乙方单位</h3>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-gray-500 text-sm mb-1">单位名称 *</label>
            <input
              value={partyBForm.unit_name}
              onChange={(e) => setPartyBForm({ ...partyBForm, unit_name: e.target.value })}
              className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
            />
          </div>
          <div>
            <label className="block text-gray-500 text-sm mb-1">单位类别</label>
            <SegmentedControl
              value={partyBForm.unit_type}
              onChange={(v) => setPartyBForm({ ...partyBForm, unit_type: v as any })}
              options={[
                { value: '劳务类', label: '劳务类' },
                { value: '材料类', label: '材料类' },
                { value: '专业分包', label: '专业分包' },
              ]}
              aria-label="单位类别"
            />
          </div>
          <div>
            <label className="block text-gray-500 text-sm mb-1">联系电话</label>
            <input
              value={partyBForm.phone}
              onChange={(e) => setPartyBForm({ ...partyBForm, phone: e.target.value })}
              className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
            />
          </div>
          <div>
            <label className="block text-gray-500 text-sm mb-1">社会信用代码</label>
            <input
              value={partyBForm.credit_code}
              onChange={(e) => setPartyBForm({ ...partyBForm, credit_code: e.target.value })}
              className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
            />
          </div>
          <div>
            <label className="block text-gray-500 text-sm mb-1">开户行</label>
            <input
              value={partyBForm.bank_name}
              onChange={(e) => setPartyBForm({ ...partyBForm, bank_name: e.target.value })}
              className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
            />
          </div>
          <div>
            <label className="block text-gray-500 text-sm mb-1">开户账号</label>
            <input
              value={partyBForm.bank_account}
              onChange={(e) => setPartyBForm({ ...partyBForm, bank_account: e.target.value })}
              className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <button type="button" onClick={() => setShowAddPartyB(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg">
            取消
          </button>
          <button type="button" onClick={handleAddPartyB} className="px-4 py-2 bg-blue-600 text-white rounded-lg">
            保存
          </button>
        </div>
      </UiModalOverlay>
    </motion.div>);

}
