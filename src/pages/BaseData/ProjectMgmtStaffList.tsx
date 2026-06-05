import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  FaPlus,
  FaEdit,
  FaTrash,
  FaSearch,
  FaTimes,
  FaChevronLeft,
  FaChevronRight,
  FaUpload,
  FaEye,
  FaDownload,
  FaExclamationTriangle,
  FaChartBar,
  FaUsers,
} from 'react-icons/fa';
import { supabase } from '../../supabase/client';
import { PAGE_SIZE } from '../../constants';
import { useApp } from '../../stores';
import { SearchableSelect } from '../../components/ui';
import { projectSelectOptions } from '../../components/ui/options';

type TabKey = 'staff' | 'salary' | 'arrears';

interface ResumeFile {
  url: string;
  file_name: string;
  uploaded_at: string;
}

interface StaffRow {
  id: string;
  company_id: string | null;
  party_b_id: string;
  project_id: string | null;
  full_name: string;
  gender: string | null;
  id_card: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  position_title: string | null;
  hire_date: string | null;
  resume_files: ResumeFile[] | unknown;
  remark: string | null;
  created_at?: string | null;
}

interface SalaryRecordRow {
  id: string;
  staff_id: string;
  project_id: string | null;
  salary_month: string;
  amount_payable: number;
  amount_paid: number;
  paid_date: string | null;
  remark: string | null;
}

interface PartyBOption {
  id: string;
  unit_name: string | null;
}

interface ProjectOption {
  id: string;
  name: string | null;
}

const initialForm = {
  party_b_id: '',
  project_id: '',
  full_name: '',
  gender: '',
  id_card: '',
  phone: '',
  email: '',
  address: '',
  position_title: '',
  hire_date: '',
  remark: '',
};

function parseResumeFiles(raw: unknown): ResumeFile[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as ResumeFile[];
  return [];
}

export default function ProjectMgmtStaffList() {
  const { currentCompany, companies } = useApp();

  const getCompanyIds = useCallback((): string[] => {
    if (!currentCompany) return [];
    const ids = new Set<string>([currentCompany.id]);
    companies.forEach(c => {
      if (c.parent_id === currentCompany.id) ids.add(c.id);
    });
    return Array.from(ids);
  }, [currentCompany, companies]);

  const [tab, setTab] = useState<TabKey>('staff');

  const [list, setList] = useState<StaffRow[]>([]);
  /** 当前公司下全部人员（用于下拉、工资姓名解析、拖欠展示） */
  const [allStaff, setAllStaff] = useState<StaffRow[]>([]);
  const [partyBList, setPartyBList] = useState<PartyBOption[]>([]);
  const [projectList, setProjectList] = useState<ProjectOption[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [resumeFiles, setResumeFiles] = useState<ResumeFile[]>([]);
  const [uploadingResume, setUploadingResume] = useState(false);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [salaryRecords, setSalaryRecords] = useState<SalaryRecordRow[]>([]);
  const [salaryFilterProject, setSalaryFilterProject] = useState('');
  const [salaryMonthStart, setSalaryMonthStart] = useState('');
  const [salaryMonthEnd, setSalaryMonthEnd] = useState('');
  const [salarySearchName, setSalarySearchName] = useState('');

  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [salaryEditingId, setSalaryEditingId] = useState<string | null>(null);
  const [salaryForm, setSalaryForm] = useState({
    staff_id: '',
    project_id: '',
    salary_month: '',
    amount_payable: '',
    amount_paid: '',
    paid_date: '',
    remark: '',
  });

  const partyBMap = useMemo(() => {
    const m = new Map<string, string>();
    partyBList.forEach(p => m.set(p.id, p.unit_name || ''));
    return m;
  }, [partyBList]);

  const projectMap = useMemo(() => {
    const m = new Map<string, string>();
    projectList.forEach(p => m.set(p.id, p.name || ''));
    return m;
  }, [projectList]);

  const staffMap = useMemo(() => {
    const m = new Map<string, StaffRow>();
    allStaff.forEach(s => m.set(s.id, s));
    return m;
  }, [allStaff]);

  useEffect(() => {
    async function loadRefs() {
      const { data: pb } = await supabase.from('party_b').select('id, unit_name').order('unit_name');
      if (pb) setPartyBList(pb as PartyBOption[]);

      if (!currentCompany) {
        setProjectList([]);
        return;
      }
      const ids = new Set<string>([currentCompany.id]);
      companies.forEach(c => {
        if (c.parent_id === currentCompany.id) ids.add(c.id);
      });
      const companyIds = Array.from(ids);
      if (companyIds.length === 0) {
        setProjectList([]);
        return;
      }
      const { data: pr } = await supabase
        .from('projects')
        .select('id, name')
        .in('company_id', companyIds)
        .order('name');
      if (pr) setProjectList(pr as ProjectOption[]);
    }
    loadRefs();
  }, [currentCompany, companies]);

  const loadAllStaff = useCallback(async () => {
    const companyIds = getCompanyIds();
    if (companyIds.length === 0) {
      setAllStaff([]);
      return;
    }
    const { data } = await supabase
      .from('project_mgmt_staff')
      .select('*')
      .in('company_id', companyIds)
      .order('full_name', { ascending: true });
    if (data) setAllStaff(data as StaffRow[]);
  }, [getCompanyIds]);

  useEffect(() => {
    if (!currentCompany) return;
    loadAllStaff();
  }, [currentCompany, companies, loadAllStaff]);

  useEffect(() => {
    if (tab === 'staff') fetchStaff();
  }, [page, search, tab, currentCompany, companies]);

  useEffect(() => {
    if (tab === 'salary' || tab === 'arrears') {
      fetchSalaryRecords();
    }
  }, [tab, salaryFilterProject, salaryMonthStart, salaryMonthEnd]);

  async function fetchStaff() {
    const companyIds = getCompanyIds();
    if (!currentCompany || companyIds.length === 0) {
      setList([]);
      setTotal(0);
      return;
    }
    const offset = (page - 1) * PAGE_SIZE;
    let query = supabase
      .from('project_mgmt_staff')
      .select('*', { count: 'exact' })
      .in('company_id', companyIds)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (search.trim()) {
      query = query.ilike('full_name', `%${search.trim()}%`);
    }

    const res = await query;
    if (res.data) setList(res.data as StaffRow[]);
    if (res.count != null) setTotal(res.count);
  }

  async function fetchSalaryRecords() {
    const companyIds = getCompanyIds();
    if (companyIds.length === 0) {
      setSalaryRecords([]);
      return;
    }

    const { data: staffIdsRows } = await supabase
      .from('project_mgmt_staff')
      .select('id')
      .in('company_id', companyIds);
    const allowedIds = new Set((staffIdsRows || []).map(r => r.id));
    if (allowedIds.size === 0) {
      setSalaryRecords([]);
      return;
    }

    let q = supabase
      .from('project_mgmt_staff_salary_records')
      .select('*')
      .in('staff_id', [...allowedIds])
      .order('salary_month', { ascending: false });

    const forStatsOnly = tab !== 'arrears';
    if (forStatsOnly) {
      if (salaryFilterProject) {
        q = q.eq('project_id', salaryFilterProject);
      }
      if (salaryMonthStart) {
        q = q.gte('salary_month', salaryMonthStart + '-01');
      }
      if (salaryMonthEnd) {
        const [y, m] = salaryMonthEnd.split('-').map(Number);
        const lastDay = new Date(y, m, 0).getDate();
        q = q.lte('salary_month', `${salaryMonthEnd}-${String(lastDay).padStart(2, '0')}`);
      }
    }

    const { data } = await q;
    let rows = (data || []) as SalaryRecordRow[];

    if (salarySearchName.trim() && tab === 'salary') {
      const nameLower = salarySearchName.trim().toLowerCase();
      rows = rows.filter(r => {
        const st = allStaff.find(x => x.id === r.staff_id);
        return st?.full_name?.toLowerCase().includes(nameLower);
      });
    }

    setSalaryRecords(rows);
  }

  useEffect(() => {
    if (tab === 'salary') fetchSalaryRecords();
  }, [salarySearchName, allStaff]);

  function openAdd() {
    setForm(initialForm);
    setResumeFiles([]);
    setEditingId(null);
    setShowModal(true);
  }

  function openEdit(row: StaffRow) {
    setEditingId(row.id);
    setForm({
      party_b_id: row.party_b_id,
      project_id: row.project_id || '',
      full_name: row.full_name,
      gender: row.gender || '',
      id_card: row.id_card || '',
      phone: row.phone || '',
      email: row.email || '',
      address: row.address || '',
      position_title: row.position_title || '',
      hire_date: row.hire_date || '',
      remark: row.remark || '',
    });
    setResumeFiles(parseResumeFiles(row.resume_files));
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name?.trim()) {
      alert('请填写姓名');
      return;
    }
    if (!form.party_b_id) {
      alert('请选择所属乙方单位');
      return;
    }
    const companyIds = getCompanyIds();
    const payload = {
      company_id: currentCompany?.id ?? null,
      party_b_id: form.party_b_id,
      project_id: form.project_id || null,
      full_name: form.full_name.trim(),
      gender: form.gender || null,
      id_card: form.id_card || null,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      position_title: form.position_title || null,
      hire_date: form.hire_date || null,
      resume_files: resumeFiles,
      remark: form.remark || null,
    };

    if (editingId) {
      await supabase.from('project_mgmt_staff').update(payload).eq('id', editingId);
    } else {
      if (!currentCompany?.id) {
        alert('请先选择当前公司');
        return;
      }
      await supabase.from('project_mgmt_staff').insert({
        ...payload,
        company_id: currentCompany.id,
      });
    }

    setShowModal(false);
    setForm(initialForm);
    setResumeFiles([]);
    setEditingId(null);
    await loadAllStaff();
    fetchStaff();
    fetchSalaryRecords();
  }

  async function handleDelete(id: string) {
    if (!confirm('确定删除该管理人员记录吗？关联的工资记录将一并删除。')) return;
    await supabase.from('project_mgmt_staff').delete().eq('id', id);
    await loadAllStaff();
    fetchStaff();
    fetchSalaryRecords();
  }

  async function handleResumeUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      alert('文件大小不能超过15MB');
      return;
    }
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowed.includes(file.type)) {
      alert('支持 jpg、png、pdf、doc、docx');
      return;
    }
    setUploadingResume(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const ext = file.name.split('.').pop() || 'pdf';
        const path = `project_mgmt_staff/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
        const { error } = await supabase.storage
          .from('files')
          .upload(path, Uint8Array.from(atob(base64), c => c.charCodeAt(0)), { contentType: file.type });
        if (error) throw error;
        const {
          data: { publicUrl },
        } = supabase.storage.from('files').getPublicUrl(path);
        setResumeFiles(prev => [
          ...prev,
          {
            url: publicUrl,
            file_name: file.name,
            uploaded_at: new Date().toISOString(),
          },
        ]);
        setUploadingResume(false);
      };
    } catch {
      alert('上传失败');
      setUploadingResume(false);
    }
    e.target.value = '';
  }

  function removeResume(url: string) {
    setResumeFiles(prev => prev.filter(r => r.url !== url));
  }

  function openSalaryModal(prefill?: SalaryRecordRow) {
    if (prefill) {
      setSalaryEditingId(prefill.id);
      setSalaryForm({
        staff_id: prefill.staff_id,
        project_id: prefill.project_id || '',
        salary_month: prefill.salary_month.slice(0, 7),
        amount_payable: String(prefill.amount_payable),
        amount_paid: String(prefill.amount_paid),
        paid_date: prefill.paid_date || '',
        remark: prefill.remark || '',
      });
    } else {
      setSalaryEditingId(null);
      setSalaryForm({
        staff_id: '',
        project_id: '',
        salary_month: '',
        amount_payable: '',
        amount_paid: '',
        paid_date: '',
        remark: '',
      });
    }
    setShowSalaryModal(true);
  }

  async function submitSalary(e: React.FormEvent) {
    e.preventDefault();
    if (!salaryForm.staff_id) {
      alert('请选择人员');
      return;
    }
    if (!salaryForm.salary_month) {
      alert('请选择薪资所属月份');
      return;
    }
    const payable = parseFloat(salaryForm.amount_payable || '0');
    const paid = parseFloat(salaryForm.amount_paid || '0');
    const monthDate = salaryForm.salary_month + '-01';

    const payload = {
      staff_id: salaryForm.staff_id,
      project_id: salaryForm.project_id || null,
      salary_month: monthDate,
      amount_payable: payable,
      amount_paid: paid,
      paid_date: salaryForm.paid_date || null,
      remark: salaryForm.remark || null,
    };

    if (salaryEditingId) {
      await supabase.from('project_mgmt_staff_salary_records').update(payload).eq('id', salaryEditingId);
    } else {
      await supabase.from('project_mgmt_staff_salary_records').insert(payload);
    }
    setShowSalaryModal(false);
    fetchSalaryRecords();
  }

  async function deleteSalaryRecord(id: string) {
    if (!confirm('确定删除该条工资记录？')) return;
    await supabase.from('project_mgmt_staff_salary_records').delete().eq('id', id);
    fetchSalaryRecords();
  }

  const salaryStats = useMemo(() => {
    let payable = 0;
    let paid = 0;
    salaryRecords.forEach(r => {
      payable += Number(r.amount_payable);
      paid += Number(r.amount_paid);
    });
    return {
      payable,
      paid,
      unpaid: Math.max(0, payable - paid),
    };
  }, [salaryRecords]);

  const arrearsRows = useMemo(() => {
    const byStaff = new Map<
      string,
      { arrears: number; firstMonth: string | null }
    >();

    salaryRecords.forEach(rec => {
      const gap = Number(rec.amount_payable) - Number(rec.amount_paid);
      if (gap <= 0) return;
      const sid = rec.staff_id;
      const monthKey = (rec.salary_month || '').slice(0, 10);
      const prev = byStaff.get(sid);
      if (!prev) {
        byStaff.set(sid, { arrears: gap, firstMonth: monthKey || null });
      } else {
        prev.arrears += gap;
        if (monthKey && (!prev.firstMonth || monthKey < prev.firstMonth)) {
          prev.firstMonth = monthKey;
        }
      }
    });

    const rows: {
      staffId: string;
      name: string;
      projectLabel: string;
      partyBLabel: string;
      arrears: number;
      daysOverdue: number;
    }[] = [];

    byStaff.forEach((v, staffId) => {
      const st = allStaff.find(s => s.id === staffId);
      const first = v.firstMonth ? new Date(v.firstMonth + 'T12:00:00') : new Date();
      const days = Math.max(0, Math.floor((Date.now() - first.getTime()) / (86400000)));
      rows.push({
        staffId,
        name: st?.full_name || '（未找到人员档案）',
        projectLabel: st?.project_id ? projectMap.get(st.project_id) || '—' : '—',
        partyBLabel: st?.party_b_id ? partyBMap.get(st.party_b_id) || '—' : '—',
        arrears: v.arrears,
        daysOverdue: days,
      });
    });

    return rows.sort((a, b) => b.arrears - a.arrears);
  }, [salaryRecords, allStaff, projectMap, partyBMap]);

  const salaryFilterProjectOptions = useMemo(
    () => projectSelectOptions(projectList.map(p => ({ id: p.id, name: p.name ?? '' })), '全部项目'),
    [projectList],
  );
  const staffPartyBOptions = useMemo(
    () => [{ value: '', label: '请选择' }, ...partyBList.map(p => ({ value: p.id, label: p.unit_name ?? '' }))],
    [partyBList],
  );
  const staffFormProjectOptions = useMemo(
    () => [{ value: '', label: '未分配 / 待定' }, ...projectList.map(p => ({ value: p.id, label: p.name ?? '' }))],
    [projectList],
  );
  const salaryModalStaffOptions = useMemo(
    () => [{ value: '', label: '请选择' }, ...allStaff.map(s => ({ value: s.id, label: s.full_name ?? '' }))],
    [allStaff],
  );
  const salaryModalProjectOptions = useMemo(
    () => [{ value: '', label: '与人员档案一致 / 不指定' }, ...projectList.map(p => ({ value: p.id, label: p.name ?? '' }))],
    [projectList],
  );

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const tabBtn = (k: TabKey, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      onClick={() => setTab(k)}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
        tab === k ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  if (!currentCompany) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
        请先选择公司后再管理项目部人员
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-4">
        {tabBtn('staff', '人员管理', <FaUsers className="w-4 h-4" />)}
        {tabBtn('salary', '工资发放统计', <FaChartBar className="w-4 h-4" />)}
        {tabBtn('arrears', '拖欠跟踪', <FaExclamationTriangle className="w-4 h-4" />)}
      </div>

      {tab === 'staff' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="搜索姓名"
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
              />
            </div>
            <button
              type="button"
              onClick={openAdd}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              <FaPlus /> 新增人员
            </button>
          </div>

          {list.length === 0 ? (
            <div className="text-center text-gray-500 py-12">暂无项目部管理人员</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500 text-sm">
                    <th className="text-left py-3 px-3">姓名</th>
                    <th className="text-left py-3 px-3">乙方单位</th>
                    <th className="text-left py-3 px-3">当前项目</th>
                    <th className="text-left py-3 px-3">岗位</th>
                    <th className="text-left py-3 px-3">手机</th>
                    <th className="text-center py-3 px-3">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map(row => (
                    <motion.tr
                      key={row.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-b border-gray-200/50 hover:bg-gray-50/50"
                    >
                      <td className="py-3 px-3 text-gray-800 font-medium">{row.full_name}</td>
                      <td className="py-3 px-3 text-gray-700">{partyBMap.get(row.party_b_id) || '—'}</td>
                      <td className="py-3 px-3 text-gray-700">
                        {row.project_id ? projectMap.get(row.project_id) || '—' : '—'}
                      </td>
                      <td className="py-3 px-3 text-gray-700">{row.position_title || '—'}</td>
                      <td className="py-3 px-3 text-gray-700">{row.phone || '—'}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                          >
                            <FaEdit />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(row.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
              {total > PAGE_SIZE && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <button
                    type="button"
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                    className="p-2 bg-gray-50 rounded disabled:opacity-50"
                  >
                    <FaChevronLeft className="w-3 h-3 text-gray-800" />
                  </button>
                  <span className="text-gray-500 text-sm">
                    {page} / {totalPages || 1}
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                    className="p-2 bg-gray-50 rounded disabled:opacity-50"
                  >
                    <FaChevronRight className="w-3 h-3 text-gray-800" />
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {tab === 'salary' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-sm text-gray-500 mb-1">项目筛选</label>
              <SearchableSelect
                value={salaryFilterProject}
                onChange={setSalaryFilterProject}
                options={salaryFilterProjectOptions}
                placeholder="全部项目"
                emptyLabel="全部项目"
                searchPlaceholder="搜索项目…"
                metricsContext="page:project_mgmt_staff:salary_filter_project"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">起始月份</label>
              <input
                type="month"
                value={salaryMonthStart}
                onChange={e => setSalaryMonthStart(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">截止月份</label>
              <input
                type="month"
                value={salaryMonthEnd}
                onChange={e => setSalaryMonthEnd(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">姓名</label>
              <input
                type="text"
                placeholder="筛选姓名"
                value={salarySearchName}
                onChange={e => setSalarySearchName(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => fetchSalaryRecords()}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-800 text-sm"
            >
              应用筛选
            </button>
            <button
              type="button"
              onClick={() => openSalaryModal()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm flex items-center gap-2"
            >
              <FaPlus /> 登记工资发放
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-gray-200 p-4 bg-gray-50">
              <div className="text-sm text-gray-500">应发合计（当前筛选）</div>
              <div className="text-xl font-semibold text-gray-900 mt-1">
                ¥{salaryStats.payable.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 p-4 bg-gray-50">
              <div className="text-sm text-gray-500">实发合计</div>
              <div className="text-xl font-semibold text-green-700 mt-1">
                ¥{salaryStats.paid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="rounded-lg border border-amber-200 p-4 bg-amber-50">
              <div className="text-sm text-amber-800">差额（应发−实发）</div>
              <div className="text-xl font-semibold text-amber-900 mt-1">
                ¥{salaryStats.unpaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {salaryRecords.length === 0 ? (
            <div className="text-center text-gray-500 py-8">暂无工资记录</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px]">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500 text-sm">
                    <th className="text-left py-3 px-2">薪资月份</th>
                    <th className="text-left py-3 px-2">姓名</th>
                    <th className="text-left py-3 px-2">项目</th>
                    <th className="text-right py-3 px-2">应发</th>
                    <th className="text-right py-3 px-2">实发</th>
                    <th className="text-left py-3 px-2">发放日期</th>
                    <th className="text-center py-3 px-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {salaryRecords.map(rec => {
                    const st = staffMap.get(rec.staff_id);
                    const diff = Number(rec.amount_payable) - Number(rec.amount_paid);
                    return (
                      <tr key={rec.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-2 text-gray-800">{rec.salary_month.slice(0, 7)}</td>
                        <td className="py-2 px-2">{st?.full_name || '—'}</td>
                        <td className="py-2 px-2">
                          {rec.project_id ? projectMap.get(rec.project_id) || '—' : '—'}
                        </td>
                        <td className="py-2 px-2 text-right">{Number(rec.amount_payable).toFixed(2)}</td>
                        <td className="py-2 px-2 text-right">{Number(rec.amount_paid).toFixed(2)}</td>
                        <td className="py-2 px-2 text-gray-600">{rec.paid_date || '—'}</td>
                        <td className="py-2 px-2">
                          <div className="flex justify-center gap-2">
                            {diff > 0 && (
                              <span className="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                                欠 {diff.toFixed(2)}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => openSalaryModal(rec)}
                              className="text-blue-600 hover:underline text-sm"
                            >
                              编辑
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteSalaryRecord(rec.id)}
                              className="text-red-600 hover:underline text-sm"
                            >
                              删除
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'arrears' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            以下根据工资记录自动汇总：单条记录中「应发 &gt; 实发」的差额计入拖欠；拖欠时长自最早存在差额的薪资月份起算至今。
          </p>
          {arrearsRows.length === 0 ? (
            <div className="text-center text-gray-500 py-12 border border-dashed border-gray-200 rounded-lg">
              当前无拖欠记录
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500 text-sm">
                    <th className="text-left py-3 px-3">姓名</th>
                    <th className="text-left py-3 px-3">乙方单位</th>
                    <th className="text-left py-3 px-3">当前项目</th>
                    <th className="text-right py-3 px-3">拖欠金额</th>
                    <th className="text-right py-3 px-3">拖欠时长（天）</th>
                  </tr>
                </thead>
                <tbody>
                  {arrearsRows.map(row => (
                    <tr key={row.staffId} className="border-b border-red-100 bg-red-50/40">
                      <td className="py-3 px-3 font-medium text-gray-900">{row.name}</td>
                      <td className="py-3 px-3">{row.partyBLabel}</td>
                      <td className="py-3 px-3">{row.projectLabel}</td>
                      <td className="py-3 px-3 text-right font-semibold text-red-700">
                        ¥{row.arrears.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-right text-amber-800">{row.daysOverdue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        >
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="bg-white rounded-xl p-6 w-full max-w-3xl max-h-[92vh] overflow-y-auto border border-gray-200 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-800">
                {editingId ? '编辑项目部管理人员' : '新增项目部管理人员'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  setForm(initialForm);
                  setResumeFiles([]);
                  setEditingId(null);
                }}
                className="text-gray-500 hover:text-gray-800"
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">个人基本信息</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-500 mb-2">姓名 *</label>
                    <input
                      required
                      value={form.full_name}
                      onChange={e => setForm({ ...form, full_name: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-2">性别</label>
                    <SearchableSelect
                      value={form.gender}
                      onChange={v => setForm({ ...form, gender: v })}
                      options={[
                        { value: '', label: '未登记' },
                        { value: '男', label: '男' },
                        { value: '女', label: '女' },
                      ]}
                      placeholder="未登记"
                      emptyLabel="未登记"
                      searchThreshold={10}
                      metricsContext="page:project_mgmt_staff:form_gender"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-2">身份证号</label>
                    <input
                      value={form.id_card}
                      onChange={e => setForm({ ...form, id_card: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-2">入职日期</label>
                    <input
                      type="date"
                      value={form.hire_date}
                      onChange={e => setForm({ ...form, hire_date: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">联系方式</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-500 mb-2">手机</label>
                    <input
                      value={form.phone}
                      onChange={e => setForm({ ...form, phone: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-2">电子邮箱</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={e => setForm({ ...form, email: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm text-gray-500 mb-2">联系地址</label>
                    <input
                      value={form.address}
                      onChange={e => setForm({ ...form, address: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">任职与项目归属</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-500 mb-2">所属乙方单位 *</label>
                    <SearchableSelect
                      required
                      value={form.party_b_id}
                      onChange={v => setForm({ ...form, party_b_id: v })}
                      options={staffPartyBOptions}
                      placeholder="请选择"
                      emptyLabel="请选择"
                      searchPlaceholder="搜索乙方单位…"
                      metricsContext="page:project_mgmt_staff:form_party_b"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-2">当前所在项目</label>
                    <SearchableSelect
                      value={form.project_id}
                      onChange={v => setForm({ ...form, project_id: v })}
                      options={staffFormProjectOptions}
                      placeholder="未分配 / 待定"
                      emptyLabel="未分配 / 待定"
                      searchPlaceholder="搜索项目…"
                      metricsContext="page:project_mgmt_staff:form_project"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm text-gray-500 mb-2">岗位职务</label>
                    <input
                      value={form.position_title}
                      onChange={e => setForm({ ...form, position_title: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                      placeholder="如：项目经理、施工员"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">简历附件</h4>
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer text-sm text-gray-800 mb-3 relative">
                  <FaUpload />
                  {uploadingResume ? '上传中…' : '上传简历（pdf / word / 图片）'}
                  <input type="file" className="ui-file-input-overlay" data-file-upload-field="true" accept=".pdf,.doc,.docx,image/*" onChange={handleResumeUpload} disabled={uploadingResume} />
                </label>
                <ul className="space-y-2">
                  {resumeFiles.map(f => (
                    <li key={f.url} className="flex items-center justify-between gap-2 py-2 px-3 bg-gray-50 rounded-lg border border-gray-200">
                      <span className="text-sm text-gray-700 truncate">{f.file_name}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 flex items-center gap-1 text-sm">
                          <FaEye /> 查看
                        </a>
                        <a href={f.url} download className="text-green-600">
                          <FaDownload />
                        </a>
                        <button type="button" onClick={() => removeResume(f.url)} className="text-red-600 text-sm">
                          移除
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <label className="block text-sm text-gray-500 mb-2">备注</label>
                <textarea
                  value={form.remark}
                  onChange={e => setForm({ ...form, remark: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setForm(initialForm);
                    setResumeFiles([]);
                    setEditingId(null);
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg"
                >
                  取消
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg">
                  保存
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}

      {showSalaryModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
        >
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="bg-white rounded-xl p-6 w-full max-w-lg border border-gray-200 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">{salaryEditingId ? '编辑工资记录' : '登记工资发放'}</h3>
              <button
                type="button"
                onClick={() => setShowSalaryModal(false)}
                className="text-gray-500 hover:text-gray-800"
              >
                <FaTimes />
              </button>
            </div>
            <form onSubmit={submitSalary} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-500 mb-2">人员 *</label>
                <SearchableSelect
                  required
                  disabled={!!salaryEditingId}
                  value={salaryForm.staff_id}
                  onChange={v => setSalaryForm({ ...salaryForm, staff_id: v })}
                  options={salaryModalStaffOptions}
                  placeholder="请选择"
                  emptyLabel="请选择"
                  searchPlaceholder="搜索人员…"
                  metricsContext="page:project_mgmt_staff:salary_form_staff"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-2">项目</label>
                <SearchableSelect
                  value={salaryForm.project_id}
                  onChange={v => setSalaryForm({ ...salaryForm, project_id: v })}
                  options={salaryModalProjectOptions}
                  placeholder="与人员档案一致 / 不指定"
                  emptyLabel="与人员档案一致 / 不指定"
                  searchPlaceholder="搜索项目…"
                  metricsContext="page:project_mgmt_staff:salary_form_project"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-2">薪资所属月份 *</label>
                <input
                  required
                  type="month"
                  value={salaryForm.salary_month}
                  onChange={e => setSalaryForm({ ...salaryForm, salary_month: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-2">应发金额</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={salaryForm.amount_payable}
                    onChange={e => setSalaryForm({ ...salaryForm, amount_payable: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">实发金额</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={salaryForm.amount_paid}
                    onChange={e => setSalaryForm({ ...salaryForm, amount_paid: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-2">发放日期</label>
                <input
                  type="date"
                  value={salaryForm.paid_date}
                  onChange={e => setSalaryForm({ ...salaryForm, paid_date: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-2">备注</label>
                <textarea
                  value={salaryForm.remark}
                  onChange={e => setSalaryForm({ ...salaryForm, remark: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowSalaryModal(false)} className="px-4 py-2 bg-gray-200 rounded-lg">
                  取消
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg">
                  保存
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
