import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPlus, FaFileExcel, FaDownload, FaUpload, FaTimes, FaCheck, FaExclamationTriangle } from 'react-icons/fa';
import { supabase } from '../../supabase/client';
import { useApp } from '../../stores';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { PAGE_SIZE } from '../../constants';
import {
  Project,
  PartyA,
  ProjectFormData,
  ProjectErrors,
  getInitialForm,
  getStatusLabel,
} from './types';
import ProjectList from './ProjectList';
import ProjectForm from './ProjectForm';
import type { ProjectMemberUserOption } from './ProjectForm';
import { addLog, logModule, logAction } from '../../services/logService';
import { getUsers } from '../../services/userService';
import { useSingleToast } from '../../hooks/useSingleToast';
import SingleToastBanner from '../../components/ui/SingleToastBanner';

interface ImportRow {
  rowIndex: number;
  data: any;
  error?: string;
  selected?: boolean;
}

interface ImportPreview {
  rows: ImportRow[];
  errors: string[];
  totalValid: number;
  totalInvalid: number;
}

export default function Projects() {
  const { currentCompany } = useApp();
  const [data, setData] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProjectFormData | null>(null);
  const [form, setForm] = useState<ProjectFormData>(getInitialForm());
  const [errors, setErrors] = useState<ProjectErrors>({});
  const { toast, showToast } = useSingleToast();
  const [saving, setSaving] = useState(false);
  const [partyAList, setPartyAList] = useState<PartyA[]>([]);
  const [memberUserOptions, setMemberUserOptions] = useState<ProjectMemberUserOption[]>([]);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isSuperAdmin = () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.role === 'super_admin' || (user.role_ids && user.role_ids.includes('super_admin'));
  };

  const getCompanyIds = () => {
    if (!currentCompany) return [];
    const isParent = !currentCompany.parent_id || currentCompany.parent_id === '0';
    if (isParent) {
      return (currentCompany as any).child_companies?.map((c: any) => c.id) || [currentCompany.id];
    }
    return [currentCompany.id];
  };

  useEffect(() => {
    fetchPartyAList();
  }, [currentCompany]);

  useEffect(() => {
    const companyIds = getCompanyIds();
    void getUsers()
      .then(users => {
        const filtered = users.filter(u => !u.company_id || companyIds.includes(u.company_id));
        setMemberUserOptions(
          filtered.map(u => ({ id: u.id, real_name: u.real_name, email: u.email }))
        );
      })
      .catch(() => setMemberUserOptions([]));
  }, [currentCompany]);

  useEffect(() => {
    fetchData();
  }, [page, search, currentCompany]);

  async function fetchPartyAList() {
    const companyIds = getCompanyIds();
    // party_a表可能没有company_id字段，通过projects表的party_a_id进行连接查询
    const { data: partyAData } = await supabase.from('projects')
      .select('party_a_id, party_a!inner(id, name)')
      .in('company_id', companyIds)
      .order('party_a.name');
    if (partyAData) {
      // 去重并提取party_a数据
      const uniquePartyA = Array.from(new Map(
        partyAData.map(item => [item.party_a.id, item.party_a])
      )).map(([_, partyA]) => partyA);
      setPartyAList(uniquePartyA as PartyA[]);
    }
  }

  async function fetchData() {
    if (!currentCompany) return;
    const companyIds = getCompanyIds();
    let query = supabase
      .from('projects')
      .select('*', { count: 'exact' })
      .in('company_id', companyIds)
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    if (search) {
      query = query.or(`name.ilike.%${search}%,project_code.ilike.%${search}%,project_manager.ilike.%${search}%`);
    }

    const { data: result, count } = await query;
    if (result) {
      const mapped = result.map(item => ({
        ...item,
        name: item.name || '',
        bid_amount: item.bid_amount || 0,
        duration: item.duration || '',
        start_date: item.start_date || '',
        end_date: item.end_date || '',
        project_manager: item.project_manager || '',
        status: item.status || 'not_started',
      }));
      setData(mapped as Project[]);
    }
    if (count !== undefined && count !== null) setTotal(count);
  }

  function openAdd() {
    setEditing(null);
    setForm(getInitialForm());
    setErrors({});
    setShowModal(true);
  }

  async function openEdit(item: Project) {
    setEditing(item as ProjectFormData);
    let memberIds: string[] = [];
    if (item.id) {
      const { data: pm } = await supabase.from('project_members').select('user_id').eq('project_id', item.id);
      memberIds = pm?.map(r => r.user_id as string) ?? [];
    }
    setForm({
      id: item.id,
      project_code: item.project_code ?? null,
      name: item.name ?? null,
      bid_amount: item.bid_amount ?? undefined,
      duration: item.duration ? Number(item.duration) : null,
      start_date: item.start_date ?? null,
      end_date: item.end_date ?? null,
      tender_method: item.tender_method ?? 'public_tender',
      management_fee_rate: item.management_fee_rate ?? undefined,
      cost_ticket_rate: item.cost_ticket_rate ?? undefined,
      management_fee_amount: item.management_fee_amount ?? undefined,
      tax_rate: item.tax_rate ?? undefined,
      project_manager: item.project_manager ?? null,
      manager_phone: item.manager_phone ?? null,
      manager_id_card_url: item.manager_id_card_url ?? null,
      party_a_id: item.party_a_id ?? null,
      party_a_contact: item.party_a_contact ?? null,
      stamp_person: item.stamp_person ?? null,
      stamp_person_phone: item.stamp_person_phone ?? null,
      stamp_authorization_url: item.stamp_authorization_url ?? null,
      status: item.status ?? 'not_started',
      member_user_ids: memberIds,
    });
    setErrors({});
    setShowModal(true);
  }

  function confirmDelete(id: string) {
    setDeleteId(id);
    setShowDelete(true);
  }

  function handleCloseModal() {
    if (confirm('确定要关闭吗？')) {
      setShowModal(false);
      setEditing(null);
      setForm(getInitialForm());
      setErrors({});
    }
  }

  function validateForm(): boolean {
    const newErrors: ProjectErrors = {};
    if (!form.project_code?.trim()) newErrors.project_code = '请输入项目编号';
    if (!form.name?.trim()) newErrors.name = '请输入项目名称';
    if (!form.bid_amount) newErrors.bid_amount = '请输入项目金额';
    if (!form.duration) newErrors.duration = '请输入项目工期';
    if (!form.start_date) newErrors.start_date = '请选择开工时间';
    if (!form.end_date) newErrors.end_date = '请选择竣工时间';
    if (!form.tax_rate) newErrors.tax_rate = '请输入综合税率';
    if (!form.project_manager?.trim()) newErrors.project_manager = '请输入项目负责人';
    if (!form.manager_phone?.trim()) newErrors.manager_phone = '请输入负责人电话';
    if (!form.manager_id_card_url?.trim()) newErrors.manager_id_card_url = '请上传负责人身份证';
    if (!form.party_a_id) newErrors.party_a_id = '请选择建设单位';
    if (!form.stamp_person?.trim()) newErrors.stamp_person = '请输入盖章人';
    if (!form.stamp_person_phone?.trim()) newErrors.stamp_person_phone = '请输入盖章人电话';
    if (!form.stamp_authorization_url?.trim()) newErrors.stamp_authorization_url = '请上传委托书';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateForm()) return;
    setSaving(true);

    const companyIds = getCompanyIds();
    const data: Record<string, any> = {
      project_code: form.project_code || '',
      name: form.name || '',
      bid_amount: form.bid_amount ?? null,
      duration: form.duration ? String(form.duration) : null,
      start_date: form.start_date || '',
      end_date: form.end_date || '',
      tender_method: form.tender_method || 'public_tender',
      management_fee_rate: form.management_fee_rate ?? null,
      cost_ticket_rate: form.cost_ticket_rate ?? null,
      management_fee_amount: form.management_fee_amount ?? null,
      tax_rate: form.tax_rate ?? null,
      project_manager: form.project_manager || '',
      manager_phone: form.manager_phone || '',
      manager_id_card_url: form.manager_id_card_url || '',
      party_a_id: form.party_a_id || null,
      party_a_contact: form.party_a_contact || '',
      stamp_person: form.stamp_person || '',
      stamp_person_phone: form.stamp_person_phone || '',
      stamp_authorization_url: form.stamp_authorization_url || '',
      status: form.status || 'not_started',
      company_id: companyIds[0],
    };

    try {
      let projectId = editing?.id;
      if (editing?.id) {
        const { error } = await supabase.from('projects').update(data as any).eq('id', editing.id);
        if (error) throw error;
        showToast('success', '项目更新成功');
        addLog(logModule.PROJECT, logAction.UPDATE, `编辑项目: ${form.name || form.project_code}`, { project_code: form.project_code, name: form.name });
      } else {
        const { data: inserted, error } = await supabase.from('projects').insert(data as any).select('id').single();
        if (error) throw error;
        projectId = inserted.id;
        showToast('success', '项目创建成功');
        addLog(logModule.PROJECT, logAction.CREATE, `新增项目: ${form.name || form.project_code}`, { project_code: form.project_code, name: form.name });
      }

      if (projectId) {
        await syncAttachmentsToProjectAttachments(projectId);
        await supabase.from('project_members').delete().eq('project_id', projectId);
        const mids = form.member_user_ids || [];
        if (mids.length > 0) {
          const { error: pmErr } = await supabase
            .from('project_members')
            .insert(mids.map(uid => ({ project_id: projectId, user_id: uid })));
          if (pmErr) {
            console.error(pmErr);
            showToast('error', '项目已保存，但成员关联失败：' + pmErr.message);
          }
        }
      }

      setShowModal(false);
      fetchData();
    } catch (err: any) {
      showToast('error', err.message || '保存失败');
      addLog(logModule.PROJECT, editing?.id ? logAction.UPDATE : logAction.CREATE, `项目操作失败: ${form.name || form.project_code}`, { project_code: form.project_code, name: form.name }, 'failed');
    } finally {
      setSaving(false);
    }
  }

  async function syncAttachmentsToProjectAttachments(projectId: string) {
    if (form.manager_id_card_url) {
      const existingAttachment = await supabase
        .from('project_attachments')
        .select('id')
        .eq('project_id', projectId)
        .eq('attachment_type', 'manager_id_card')
        .maybeSingle();

      const urlParts = form.manager_id_card_url.split('/');
      const fileName = urlParts[urlParts.length - 1].split('?')[0];

      if (existingAttachment.data) {
        await supabase
          .from('project_attachments')
          .update({ file_name: fileName, file_url: form.manager_id_card_url })
          .eq('id', existingAttachment.data.id);
      } else {
        await supabase
          .from('project_attachments')
          .insert({
            project_id: projectId,
            attachment_type: 'manager_id_card',
            file_name: fileName,
            file_url: form.manager_id_card_url,
          });
      }
    }

    if (form.stamp_authorization_url) {
      const existingAttachment = await supabase
        .from('project_attachments')
        .select('id')
        .eq('project_id', projectId)
        .eq('attachment_type', 'stamp_authorization')
        .maybeSingle();

      const urlParts = form.stamp_authorization_url.split('/');
      const fileName = urlParts[urlParts.length - 1].split('?')[0];

      if (existingAttachment.data) {
        await supabase
          .from('project_attachments')
          .update({ file_name: fileName, file_url: form.stamp_authorization_url })
          .eq('id', existingAttachment.data.id);
      } else {
        await supabase
          .from('project_attachments')
          .insert({
            project_id: projectId,
            attachment_type: 'stamp_authorization',
            file_name: fileName,
            file_url: form.stamp_authorization_url,
          });
      }
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      const deletedProject = data.find(p => p.id === deleteId);
      await supabase.from('projects').delete().eq('id', deleteId);
      showToast('success', '删除成功');
      addLog(logModule.PROJECT, logAction.DELETE, `删除项目: ${deletedProject?.name || deletedProject?.project_code || deleteId}`, { project_id: deleteId, name: deletedProject?.name, project_code: deletedProject?.project_code });
      setShowDelete(false);
      setDeleteId(null);
      fetchData();
    } catch (err: any) {
      showToast('error', err.message || '删除失败');
      addLog(logModule.PROJECT, logAction.DELETE, `删除项目失败: ${deleteId}`, { project_id: deleteId }, 'failed');
    }
  }

  async function handleManagerIdCardUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !currentCompany) return;
    if (file.size > 10 * 1024 * 1024) {
      showToast('error', '文件大小不能超过10MB');
      return;
    }
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      showToast('error', '仅支持 jpg, jpeg, png, gif, pdf 格式');
      return;
    }
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const ext = file.name.split('.').pop();
        const path = `${currentCompany.id}/manager_id_cards/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;
        const { error } = await supabase.storage.from('files').upload(path, Uint8Array.from(atob(base64), c => c.charCodeAt(0)), { contentType: file.type });
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from('files').getPublicUrl(path);
        setForm({ ...form, manager_id_card_url: publicUrl });
        showToast('success', '上传成功');
      };
    } catch (err: any) {
      showToast('error', '上传失败：' + (err.message || ''));
    }
  }

  async function handleStampAuthUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !currentCompany) return;
    if (file.size > 10 * 1024 * 1024) {
      showToast('error', '文件大小不能超过10MB');
      return;
    }
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      showToast('error', '仅支持 jpg, jpeg, png, gif, pdf 格式');
      return;
    }
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const ext = file.name.split('.').pop();
        const path = `${currentCompany.id}/stamp_auth/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;
        const { error } = await supabase.storage.from('files').upload(path, Uint8Array.from(atob(base64), c => c.charCodeAt(0)), { contentType: file.type });
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from('files').getPublicUrl(path);
        setForm({ ...form, stamp_authorization_url: publicUrl });
        showToast('success', '上传成功');
      };
    } catch (err: any) {
      showToast('error', '上传失败：' + (err.message || ''));
    }
  }

  function downloadTemplate() {
    const template = [{
      项目编号: '',
      项目名称: '',
      项目金额: '',
      '工期（天）': '',
      开工时间: '',
      合同竣工时间: '',
      招标方式: '公开招标/直签合同',
      管理费比例: '',
      成本票比例: '',
      综合税率: '',
      项目负责人: '',
      负责人电话: '',
      建设单位: '',
      状态: '未开工/进行中/已完工',
    }];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '项目模板');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf]), '项目导入模板.xlsx');
  }

  function validateImportRow(row: any, rowIndex: number, partyAMap: Map<string, string>): string | null {
    const errors: string[] = [];
    if (!row.项目名称 || row.项目名称.toString().trim() === '') {
      errors.push('项目名称不能为空');
    }
    if (!row.项目编号 || row.项目编号.toString().trim() === '') {
      errors.push('项目编号不能为空');
    }
    if (row.项目金额 && isNaN(Number(row.项目金额))) {
      errors.push('项目金额必须是数字');
    }
    if (row.负责人电话 && !/^1\d{10}$/.test(row.负责人电话.toString())) {
      errors.push('负责人电话格式不正确');
    }
    if (row.招标方式 && !['公开招标', '直签合同'].includes(row.招标方式)) {
      errors.push('招标方式必须是"公开招标"或"直签合同"');
    }
    if (row.状态 && !['未开工', '进行中', '已完工'].includes(row.状态)) {
      errors.push('状态必须是"未开工"、"进行中"或"已完工"');
    }
    if (row.建设单位 && !partyAMap.has(row.建设单位)) {
      errors.push('建设单位不存在');
    }
    return errors.length > 0 ? errors.join('; ') : null;
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !currentCompany) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(sheet) as any[];
        
        if (jsonData.length === 0) {
          showToast('error', 'Excel文件为空');
          return;
        }
        
        const companyIds = getCompanyIds();
        // party_a表可能没有company_id字段，通过projects表的party_a_id进行连接查询
        const { data: partyAData } = await supabase.from('projects')
          .select('party_a_id, party_a!inner(id, name)')
          .in('company_id', companyIds)
          .order('party_a.name');
        // 去重并提取party_a数据
        const uniquePartyA = Array.from(new Map(
          partyAData?.map(item => [item.party_a.id, item.party_a]) || []
        )).map(([_, partyA]) => partyA);
        const partyAMap = new Map((uniquePartyA || []).map(p => [p.name, p.id]));
        
        const previewRows: ImportRow[] = [];
        const allErrors: string[] = [];
        
        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i];
          const rowError = validateImportRow(row, i + 1, partyAMap);
          previewRows.push({
            rowIndex: i + 1,
            data: row,
            error: rowError || undefined,
            selected: !rowError,
          });
          if (rowError) {
            allErrors.push(`第${i + 1}行: ${rowError}`);
          }
        }
        
        const validCount = previewRows.filter(r => !r.error).length;
        const invalidCount = previewRows.filter(r => r.error).length;
        
        setImportPreview({
          rows: previewRows,
          errors: allErrors,
          totalValid: validCount,
          totalInvalid: invalidCount,
        });
        setShowImportPreview(true);
      } catch (err: any) {
        showToast('error', '解析Excel失败：' + (err.message || ''));
      }
    };
    reader.readAsBinaryString(file);
    if (e.target) e.target.value = '';
  }

  async function confirmImport() {
    if (!importPreview || !currentCompany) return;
    setImporting(true);
    const companyIds = getCompanyIds();
    const { data: partyAData } = await supabase.from('party_a').select('id, name').in('company_id', companyIds);
    const partyAMap = new Map((partyAData || []).map(p => [p.name, p.id]));
    
    const validRows = importPreview.rows.filter(r => r.selected && !r.error);
    let successCount = 0;
    let errorCount = 0;
    
    for (const row of validRows) {
      try {
        const tenderMethod = row.data.招标方式 === '公开招标' ? 'public_tender' : 'direct_contract';
        const statusMap: Record<string, string> = { '未开工': 'not_started', '进行中': 'in_progress', '已完工': 'completed' };
        
        await supabase.from('projects').insert({
          project_code: row.data.项目编号 || '',
          name: row.data.项目名称 || '',
          bid_amount: Number(row.data.项目金额) || 0,
          duration: String(row.data['工期（天）'] || ''),
          start_date: row.data.开工时间 || '',
          end_date: row.data.合同竣工时间 || '',
          tender_method: tenderMethod,
          management_fee_rate: row.data.管理费比例 ? Number(row.data.管理费比例) : null,
          cost_ticket_rate: row.data.成本票比例 ? Number(row.data.成本票比例) : null,
          tax_rate: row.data.综合税率 ? Number(row.data.综合税率) : null,
          project_manager: row.data.项目负责人 || '',
          manager_phone: row.data.负责人电话 || '',
          party_a_id: row.data.建设单位 ? partyAMap.get(row.data.建设单位) || null : null,
          status: statusMap[row.data.状态 || '未开工'] || 'not_started',
          company_id: companyIds[0],
        } as any);
        successCount++;
      } catch (err) {
        errorCount++;
      }
    }
    
    setShowImportPreview(false);
    setImportPreview(null);
    setImporting(false);
    
    if (errorCount > 0) {
      showToast('error', `导入完成：成功${successCount}条，失败${errorCount}条`);
    } else {
      showToast('success', `成功导入 ${successCount} 条数据`);
    }
    fetchData();
  }

  function toggleImportRow(rowIndex: number) {
    if (!importPreview) return;
    const updatedRows = importPreview.rows.map(r => 
      r.rowIndex === rowIndex ? { ...r, selected: !r.selected } : r
    );
    const validCount = updatedRows.filter(r => !r.error && r.selected).length;
    const invalidCount = updatedRows.filter(r => r.error).length;
    setImportPreview({ ...importPreview, rows: updatedRows, totalValid: validCount, totalInvalid: invalidCount });
  }

  function toggleImportAll() {
    if (!importPreview) return;
    const allSelected = importPreview.rows.every(r => r.selected);
    const updatedRows = importPreview.rows.map(r => ({ ...r, selected: !allSelected && !r.error }));
    const validCount = updatedRows.filter(r => !r.error && r.selected).length;
    const invalidCount = updatedRows.filter(r => r.error).length;
    setImportPreview({ ...importPreview, rows: updatedRows, totalValid: validCount, totalInvalid: invalidCount });
  }

  async function handleExport() {
    if (!currentCompany) return;
    const companyIds = getCompanyIds();
    const { data: allData } = await supabase
      .from('projects')
      .select('*, party_a:party_a(name)')
      .in('company_id', companyIds);
    if (!allData || !allData.length) { showToast('error', '没有可导出的数据'); return; }

    const rows = allData.map((p: any) => ({
      项目编号: (p.project_code || ''),
      项目名称: p.name,
      项目金额: p.bid_amount,
      '工期（天）': p.duration,
      开工时间: p.start_date,
      合同竣工时间: p.end_date,
      招标方式: (p.tender_method === 'public_tender' ? '公开招标' : '直签合同'),
      项目负责人: p.project_manager,
      负责人电话: (p.manager_phone || ''),
      状态: getStatusLabel(p.status),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '项目列表');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), '项目列表.xlsx');
    showToast('success', '导出成功');
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      {toast && <SingleToastBanner type={toast.type} message={toast.message} />}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h3 className="text-xl font-bold text-gray-800">项目管理</h3>
        <div className="flex flex-wrap gap-2">
          <input
            type="file"
            ref={fileInputRef}
            accept=".xlsx,.xls"
            onChange={handleImport}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-gray-800 rounded-lg text-sm"
          >
            <FaUpload /> <span className="hidden sm:inline">导入Excel</span>
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-gray-800 rounded-lg text-sm"
          >
            <FaFileExcel /> <span className="hidden sm:inline">导出Excel</span>
          </button>
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 px-3 py-2 bg-gray-600 hover:bg-gray-700 text-gray-800 rounded-lg text-sm"
          >
            <FaDownload /> <span className="hidden sm:inline">下载模板</span>
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-gray-800 rounded-lg text-sm"
          >
            <FaPlus /> <span className="hidden sm:inline">新增项目</span>
          </button>
        </div>
      </div>

      <ProjectList
        data={data}
        total={total}
        page={page}
        search={search}
        onSearchChange={setSearch}
        onPageChange={setPage}
        onEdit={openEdit}
        onDelete={confirmDelete}
        isSuperAdmin={isSuperAdmin()}
      />

      <AnimatePresence>
        {showModal && (
          <ProjectForm
            show={showModal}
            editing={editing}
            form={form}
            errors={errors}
            partyAList={partyAList}
            memberUserOptions={memberUserOptions}
            saving={saving}
            onClose={handleCloseModal}
            onChange={setForm}
            onErrorsChange={setErrors}
            onSubmit={handleSubmit}
            onManagerIdCardUpload={handleManagerIdCardUpload}
            onStampAuthUpload={handleStampAuthUpload}
            onPartyARefresh={fetchPartyAList}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4"
            onClick={() => setShowDelete(false)}
          >
            <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-xl font-bold text-gray-800 mb-4">确认删除</h3>
                <p className="text-gray-600 mb-6">确定要删除该项目吗？此操作不可恢复。</p>
                <div className="flex flex-col sm:flex-row justify-end gap-3">
                  <button
                    onClick={() => setShowDelete(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleDelete}
                    className="px-4 py-2 bg-red-600 text-gray-800 rounded-lg hover:bg-red-700"
                  >
                    确认删除
                  </button>
                </div>
              </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showImportPreview && importPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4"
            onClick={() => setShowImportPreview(false)}
          >
            <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                className="bg-white rounded-xl p-6 w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">导入预览</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      <span className="text-green-600">✓ 有效 {importPreview.totalValid} 条</span>
                      <span className="mx-2">|</span>
                      <span className="text-red-500">✗ 无效 {importPreview.totalInvalid} 条</span>
                    </p>
                  </div>
                  <button onClick={() => setShowImportPreview(false)} className="text-gray-400 hover:text-gray-600">
                    <FaTimes />
                  </button>
                </div>
                
                {importPreview.errors.length > 0 && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg max-h-24 overflow-y-auto">
                    <p className="text-red-600 text-sm font-medium mb-1">错误列表：</p>
                    {importPreview.errors.map((err, i) => (
                      <p key={i} className="text-red-500 text-xs">{err}</p>
                    ))}
                  </div>
                )}
                
                <div className="flex-1 overflow-auto mb-4 border border-gray-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left">
                          <input
                            type="checkbox"
                            checked={importPreview.rows.length > 0 && importPreview.rows.every(r => r.selected)}
                            onChange={toggleImportAll}
                            className="w-4 h-4"
                          />
                        </th>
                        <th className="px-3 py-2 text-left text-gray-600">行号</th>
                        <th className="px-3 py-2 text-left text-gray-600">项目编号</th>
                        <th className="px-3 py-2 text-left text-gray-600">项目名称</th>
                        <th className="px-3 py-2 text-left text-gray-600">项目金额</th>
                        <th className="px-3 py-2 text-left text-gray-600">工期</th>
                        <th className="px-3 py-2 text-left text-gray-600">状态</th>
                        <th className="px-3 py-2 text-left text-gray-600">错误</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.rows.slice(0, 50).map((row) => (
                        <tr key={row.rowIndex} className={"border-t border-gray-100 " + (row.error ? 'bg-red-50' : '')}>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={row.selected}
                              onChange={() => toggleImportRow(row.rowIndex)}
                              disabled={!!row.error}
                              className="w-4 h-4"
                            />
                          </td>
                          <td className="px-3 py-2 text-gray-500">{row.rowIndex}</td>
                          <td className="px-3 py-2 text-gray-700">{(row.data.项目编号 || '-')}</td>
                          <td className="px-3 py-2 text-gray-700">{(row.data.项目名称 || '-')}</td>
                          <td className="px-3 py-2 text-gray-700">{row.data.项目金额 || '-'}</td>
                          <td className="px-3 py-2 text-gray-700">{(row.data['工期（天）'] || '-')}</td>
                          <td className="px-3 py-2">
                            <span className={"px-2 py-0.5 rounded text-xs " + (row.data.状态 ? 'bg-blue-600 text-gray-800' : 'bg-gray-200 text-gray-500')}>
                              {row.data.状态 || '未定义'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-red-500 text-xs max-w-48 truncate">{row.error || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {importPreview.rows.length > 50 && (
                    <p className="text-center text-gray-500 text-sm py-2">显示前50条，共{importPreview.rows.length}条</p>
                  )}
                </div>
                
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowImportPreview(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    取消
                  </button>
                  <button
                    onClick={confirmImport}
                    disabled={importing || importPreview.totalValid === 0}
                    className="px-4 py-2 bg-blue-600 text-gray-800 rounded-lg disabled:opacity-50 hover:bg-blue-700"
                  >
                    {importing ? '导入中...' : `导入 (${importPreview.totalValid})`}
                  </button>
                </div>
              </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
