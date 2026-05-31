/**
 * 机械台班管理主页
 * 包含台班录入、列表、统计、数据穿透功能
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPlus, FaChartBar, FaTable, FaSearch, FaTimes, FaChevronLeft, FaChevronRight, FaCheck, FaEdit, FaTrash, FaCamera, FaPaperPlane } from 'react-icons/fa';
import { SegmentedControl } from '../../components/ui';
import { useCompanyScope } from '../../hooks/useCompanyScope';
import { useSubmitApprovalModal } from '../../hooks/useSubmitApprovalModal';
import { supabase } from '../../supabase/client';
import {
  fetchMachineShiftRecords,
  fetchProjectStatistics,
  fetchDrillDownRecords,
  createMachineShiftRecord,
  updateMachineShiftRecord,
  deleteMachineShiftRecord,
  uploadMachineShiftImage,
  fetchRentalContracts,
} from './api';
import DrillDownModal from './DrillDownModal';

interface MachineShiftRecord {
  id: string;
  project_id: string;
  project_name?: string;
  machine_id: string;
  machine_name?: string;
  machine_code?: string;
  rental_contract_id?: string;
  rental_contract_no?: string;
  record_date: string;
  shift_count: number;
  start_time?: string;
  end_time?: string;
  cost_per_shift?: number;
  total_cost: number;
  operator?: string;
  remark?: string;
  images?: string[];
  status: string;
  approval_id?: string;
  is_settled: boolean;
  created_by?: string;
  created_at: string;
}

interface MachineShiftFormData {
  project_id: string;
  machine_id: string;
  rental_contract_id?: string;
  record_date: string;
  shift_count: number;
  start_time?: string;
  end_time?: string;
  cost_per_shift?: number;
  operator?: string;
  remark?: string;
  images: string[];
}

interface ProjectOption {
  value: string;
  label: string;
}

interface MachineOption {
  value: string;
  label: string;
  code: string;
  default_shift_price?: number;
}

export default function MachineShift() {
  const { companyIds } = useCompanyScope();
  const { open: openApprovalModal, modal: approvalModal } = useSubmitApprovalModal();
  const [activeTab, setActiveTab] = useState<'list' | 'statistics'>('list');
  
  // 台班记录列表
  const [records, setRecords] = useState<MachineShiftRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  
  // 筛选条件
  const [searchKeyword, setSearchKeyword] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [machineFilter, setMachineFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  
  // 项目统计
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [projectStats, setProjectStats] = useState<any>(null);
  
  // 表单弹窗
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MachineShiftRecord | null>(null);
  const [formData, setFormData] = useState<MachineShiftFormData>({
    project_id: '',
    machine_id: '',
    record_date: new Date().toISOString().split('T')[0],
    shift_count: 1,
    images: [],
  });
  
  // 机械列表
  const [machines, setMachines] = useState<MachineOption[]>([]);
  
  // 合同列表
  const [contracts, setContracts] = useState<any[]>([]);
  
  // 穿透明窗
  const [showDrillDown, setShowDrillDown] = useState(false);
  const [drillDownData, setDrillDownData] = useState<{
    title: string;
    projectId?: string;
    machineId?: string;
    month?: string;
  }>({ title: '' });
  
  // 加载项目列表
  useEffect(() => {
    async function loadProjects() {
      if (companyIds.length === 0) return;
      
      const { data } = await supabase
        .from('projects')
        .select('id, name')
        .in('company_id', companyIds)
        .eq('status', 'active')
        .order('name');
      
      if (data && data.length > 0) {
        setProjects(data.map(p => ({ value: p.id, label: p.name })));
        setSelectedProjectId(data[0].id);
      }
    }
    loadProjects();
  }, [companyIds]);
  
  // 加载台班记录列表
  const loadRecords = async () => {
    setLoading(true);
    try {
      const filter = {
        projectId: projectFilter || undefined,
        machineId: machineFilter || undefined,
        status: statusFilter || undefined,
        dateFrom: dateFromFilter || undefined,
        dateTo: dateToFilter || undefined,
        keyword: searchKeyword || undefined,
        page,
        pageSize: 20,
      };
      
      const result = await fetchMachineShiftRecords(filter);
      setRecords(result.data);
      setTotalPages(result.totalPages);
      setTotal(result.total);
    } catch (err) {
      console.error('Failed to load records:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // 加载项目统计
  const loadProjectStats = async () => {
    if (!selectedProjectId) return;
    
    try {
      const stats = await fetchProjectStatistics(selectedProjectId);
      setProjectStats(stats);
    } catch (err) {
      console.error('Failed to load project stats:', err);
    }
  };
  
  // 初始化和筛选变化时重新加载
  useEffect(() => {
    if (activeTab === 'list') {
      loadRecords();
    } else if (activeTab === 'statistics' && selectedProjectId) {
      loadProjectStats();
    }
  }, [activeTab, page, projectFilter, machineFilter, statusFilter, dateFromFilter, dateToFilter, searchKeyword, selectedProjectId]);
  
  // 加载机械列表
  const loadMachines = async (projectId?: string) => {
    let query = supabase.from('machines').select('id, name, code, default_shift_price');
    
    if (projectId) {
      query = query.eq('current_project_id', projectId);
    }
    
    const { data } = await query;
    
    if (data) {
      setMachines(data.map(m => ({
        value: m.id,
        label: m.name,
        code: m.code || '',
        default_shift_price: m.default_shift_price,
      })));
    }
  };
  
  // 加载合同列表
  const loadContracts = async (projectId: string) => {
    try {
      const data = await fetchRentalContracts(projectId);
      setContracts(data);
    } catch (err) {
      setContracts([]);
    }
  };
  
  // 当选择项目时，加载相关机械和合同
  useEffect(() => {
    if (formData.project_id) {
      loadMachines(formData.project_id);
      loadContracts(formData.project_id);
    }
  }, [formData.project_id]);
  
  // 打开新增表单
  const openAddForm = () => {
    setEditingRecord(null);
    setFormData({
      project_id: selectedProjectId || '',
      machine_id: '',
      record_date: new Date().toISOString().split('T')[0],
      shift_count: 1,
      images: [],
    });
    setShowFormModal(true);
  };
  
  // 打开编辑表单
  const openEditForm = (record: MachineShiftRecord) => {
    setEditingRecord(record);
    setFormData({
      project_id: record.project_id,
      machine_id: record.machine_id,
      rental_contract_id: record.rental_contract_id,
      record_date: record.record_date,
      shift_count: record.shift_count,
      start_time: record.start_time,
      end_time: record.end_time,
      cost_per_shift: record.cost_per_shift,
      operator: record.operator,
      remark: record.remark,
      images: record.images || [],
    });
    loadMachines(record.project_id);
    loadContracts(record.project_id);
    setShowFormModal(true);
  };
  
  // 自动计算总费用
  const calculateTotalCost = () => {
    if (formData.cost_per_shift && formData.shift_count) {
      return formData.cost_per_shift * formData.shift_count;
    }
    return 0;
  };
  
  // 从合同带出单价
  const handleContractChange = (contractId: string) => {
    const contract = contracts.find(c => c.id === contractId);
    if (contract?.shift_price) {
      setFormData(prev => ({ ...prev, rental_contract_id: contractId, cost_per_shift: contract.shift_price }));
    } else {
      setFormData(prev => ({ ...prev, rental_contract_id: contractId }));
    }
  };
  
  // 从机械带出单价
  const handleMachineChange = (machineId: string) => {
    const machine = machines.find(m => m.value === machineId);
    if (machine?.default_shift_price && !formData.cost_per_shift) {
      setFormData(prev => ({ ...prev, machine_id: machineId, cost_per_shift: machine.default_shift_price }));
    } else {
      setFormData(prev => ({ ...prev, machine_id: machineId }));
    }
  };
  
  // 上传图片
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    try {
      const uploadedUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const url = await uploadMachineShiftImage(files[i]);
        uploadedUrls.push(url);
      }
      setFormData(prev => ({ ...prev, images: [...prev.images, ...uploadedUrls] }));
    } catch (err: any) {
      alert(err.message || '图片上传失败');
    }
  };
  
  // 删除图片
  const handleRemoveImage = (index: number) => {
    setFormData(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
  };
  
  // 保存记录
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.project_id) {
      alert('请选择项目');
      return;
    }
    if (!formData.machine_id) {
      alert('请选择机械');
      return;
    }
    if (!formData.shift_count || formData.shift_count <= 0) {
      alert('台班数必须大于0');
      return;
    }
    
    try {
      if (editingRecord) {
        await updateMachineShiftRecord(editingRecord.id, formData);
      } else {
        await createMachineShiftRecord(formData);
      }
      
      setShowFormModal(false);
      loadRecords();
      loadProjectStats();
    } catch (err: any) {
      alert(err.message || '保存失败');
    }
  };
  
  // 删除记录
  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除该台班记录吗？')) return;
    
    try {
      await deleteMachineShiftRecord(id);
      loadRecords();
      loadProjectStats();
    } catch (err: any) {
      alert(err.message || '删除失败');
    }
  };
  
  // 确认记录
  const handleConfirm = async (id: string) => {
    if (!confirm('确定要确认该台班记录吗？')) return;
    
    try {
      await updateMachineShiftRecord(id, { status: 'confirmed' });
      loadRecords();
      loadProjectStats();
    } catch (err: any) {
      alert(err.message || '确认失败');
    }
  };

  // 提交审批
  const handleSubmitApproval = async (record: MachineShiftRecord) => {
    const sourceName = `${record.project_name || '项目'} - ${record.machine_name || '机械'} - ${record.record_date} - ${record.shift_count}台班`;
    
    try {
      await openApprovalModal({
        sourceType: 'machine_shift',
        sourceId: record.id,
        sourceName,
        projectId: record.project_id,
        summaryRows: [
          { label: '项目', value: record.project_name || '-' },
          { label: '机械', value: record.machine_name || '-' },
          { label: '作业日期', value: record.record_date },
          { label: '台班数', value: `${record.shift_count} 台班` },
          { label: '总费用', value: `¥${record.total_cost.toFixed(2)}` },
        ],
      });
      loadRecords();
    } catch (err: any) {
      alert(err.message || '提交审批失败');
    }
  };

  // 打开穿透明窗
  const openDrillDown = (title: string, params: any) => {
    setDrillDownData({ title, ...params });
    setShowDrillDown(true);
  };
  
  const tabOptions = [
    { value: 'list', label: '台班列表' },
    { value: 'statistics', label: '项目统计' },
  ];
  
  const statusOptions = [
    { value: 'draft', label: '草稿', className: 'bg-gray-100 text-gray-800' },
    { value: 'pending', label: '待审批', className: 'bg-orange-100 text-orange-800' },
    { value: 'confirmed', label: '已确认', className: 'bg-green-100 text-green-800' },
    { value: 'rejected', label: '已拒绝', className: 'bg-red-100 text-red-800' },
  ];
  
  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">机械台班管理</h2>
        <div className="flex items-center gap-4">
          <SegmentedControl
            value={activeTab}
            onChange={(v) => setActiveTab(v as any)}
            options={tabOptions}
          />
          {activeTab === 'list' && (
            <button
              onClick={openAddForm}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <FaPlus />
              录入台班
            </button>
          )}
        </div>
      </div>

      {/* 项目选择器（统计页面） */}
      {activeTab === 'statistics' && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">选择项目：</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800 min-w-[300px]"
            >
              {projects.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* 统计卡片 */}
      {activeTab === 'statistics' && projectStats && (
        <div className="grid grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl border border-gray-200 p-6 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => openDrillDown('本月台班明细', { projectId: selectedProjectId, month: new Date().toISOString().slice(0, 7) })}
          >
            <div className="text-sm text-gray-500 mb-2">本月台班</div>
            <div className="text-2xl font-bold text-gray-800">
              {projectStats.month?.total_shifts?.toFixed(1) || 0} 台班
            </div>
            <div className="text-sm text-gray-500 mt-1">
              ¥{projectStats.month?.total_cost?.toFixed(2) || '0.00'}
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl border border-gray-200 p-6 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => openDrillDown('累计台班明细', { projectId: selectedProjectId })}
          >
            <div className="text-sm text-gray-500 mb-2">累计台班</div>
            <div className="text-2xl font-bold text-gray-800">
              {projectStats.total?.total_shifts?.toFixed(1) || 0} 台班
            </div>
            <div className="text-sm text-gray-500 mt-1">
              ¥{projectStats.total?.total_cost?.toFixed(2) || '0.00'}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl border border-gray-200 p-6"
          >
            <div className="text-sm text-gray-500 mb-2">机械数量</div>
            <div className="text-2xl font-bold text-gray-800">
              {projectStats.byMachine?.length || 0} 台
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-xl border border-gray-200 p-6"
          >
            <div className="text-sm text-gray-500 mb-2">本月机械使用</div>
            <div className="text-sm text-gray-800 space-y-1">
              {projectStats.byMachine?.slice(0, 3).map((m: any) => (
                <div key={m.machine_id} className="flex justify-between">
                  <span>{m.machine_name}</span>
                  <span className="font-medium">{m.total_shifts?.toFixed(1)} 台班</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}

      {/* 按机械分组（统计页面） */}
      {activeTab === 'statistics' && projectStats?.byMachine?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">按机械分组</h3>
          <div className="grid grid-cols-2 gap-4">
            {projectStats.byMachine.map((item: any, index: number) => (
              <motion.div
                key={item.machine_id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className="border border-gray-200 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => openDrillDown('机械使用明细', { projectId: selectedProjectId, machineId: item.machine_id })}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-gray-800">
                    {item.machine_name}
                  </div>
                  <div className="text-sm text-gray-500">
                    {item.machine_code || '无编码'}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-500">台班数</div>
                    <div className="text-lg font-bold text-blue-600">
                      {item.total_shifts?.toFixed(1)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">总费用</div>
                    <div className="text-lg font-bold text-green-600">
                      ¥{item.total_cost?.toFixed(2)}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* 台班列表 */}
      {activeTab === 'list' && (
        <>
          {/* 筛选栏 */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  placeholder="搜索项目、机械..."
                  value={searchKeyword}
                  onChange={(e) => { setSearchKeyword(e.target.value); setPage(1); }}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                />
              </div>
              
              <select
                value={projectFilter}
                onChange={(e) => { setProjectFilter(e.target.value); setPage(1); }}
                className="px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
              >
                <option value="">全部项目</option>
                {projects.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
              >
                <option value="">全部状态</option>
                {statusOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateFromFilter}
                  onChange={(e) => { setDateFromFilter(e.target.value); setPage(1); }}
                  className="px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  placeholder="开始日期"
                />
                <span className="text-gray-500">至</span>
                <input
                  type="date"
                  value={dateToFilter}
                  onChange={(e) => { setDateToFilter(e.target.value); setPage(1); }}
                  className="px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  placeholder="结束日期"
                />
              </div>
            </div>
          </div>

          {/* 列表 */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            {loading ? (
              <div className="text-center text-gray-500 py-12">加载中...</div>
            ) : records.length === 0 ? (
              <div className="text-center text-gray-500 py-12">暂无台班记录</div>
            ) : (
              <>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-500 text-sm">
                      <th className="text-left py-3 px-4">作业日期</th>
                      <th className="text-left py-3 px-4">项目</th>
                      <th className="text-left py-3 px-4">机械</th>
                      <th className="text-right py-3 px-4">台班数</th>
                      <th className="text-right py-3 px-4">单价</th>
                      <th className="text-right py-3 px-4">总费用</th>
                      <th className="text-center py-3 px-4">状态</th>
                      <th className="text-center py-3 px-4">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map(record => {
                      const statusInfo = statusOptions.find(s => s.value === record.status) || statusOptions[0];
                      return (
                        <tr key={record.id} className="border-b border-gray-200/50 hover:bg-gray-50/30">
                          <td className="py-3 px-4 text-gray-800">{record.record_date}</td>
                          <td className="py-3 px-4 text-gray-700">{record.project_name || '-'}</td>
                          <td className="py-3 px-4 text-gray-700">
                            <div>{record.machine_name || '-'}</div>
                            <div className="text-xs text-gray-500">{record.machine_code}</div>
                          </td>
                          <td className="py-3 px-4 text-right text-gray-800 font-medium">
                            {record.shift_count.toFixed(1)}
                          </td>
                          <td className="py-3 px-4 text-right text-gray-700">
                            {record.cost_per_shift ? `¥${record.cost_per_shift.toFixed(2)}` : '-'}
                          </td>
                          <td className="py-3 px-4 text-right text-gray-800 font-medium">
                            ¥{record.total_cost.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-1 rounded text-xs ${statusInfo.className}`}>
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-2">
                              {record.status === 'draft' && (
                                <>
                                  <button
                                    onClick={() => openEditForm(record)}
                                    className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg"
                                    title="编辑"
                                  >
                                    <FaEdit />
                                  </button>
                                  <button
                                    onClick={() => handleSubmitApproval(record)}
                                    className="p-2 text-purple-400 hover:bg-purple-500/20 rounded-lg"
                                    title="提交审批"
                                  >
                                    <FaPaperPlane />
                                  </button>
                                  <button
                                    onClick={() => handleConfirm(record.id)}
                                    className="p-2 text-green-400 hover:bg-green-500/20 rounded-lg"
                                    title="直接确认"
                                  >
                                    <FaCheck />
                                  </button>
                                </>
                              )}
                              {record.status === 'pending' && (
                                <span className="text-xs text-orange-500">审批中</span>
                              )}
                              <button
                                onClick={() => handleDelete(record.id)}
                                className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg"
                                title="删除"
                              >
                                <FaTrash />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* 分页 */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <button
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page === 1}
                      className="p-2 bg-gray-50 rounded disabled:opacity-50"
                    >
                      <FaChevronLeft className="w-3 h-3 text-gray-800" />
                    </button>
                    <span className="text-gray-500 text-sm">{page} / {totalPages}</span>
                    <button
                      onClick={() => setPage(Math.min(totalPages, page + 1))}
                      disabled={page >= totalPages}
                      className="p-2 bg-gray-50 rounded disabled:opacity-50"
                    >
                      <FaChevronRight className="w-3 h-3 text-gray-800" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* 台班录入表单弹窗 */}
      {showFormModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowFormModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-xl font-bold text-gray-800">
                {editingRecord ? '编辑台班记录' : '录入台班'}
              </h3>
              <button onClick={() => setShowFormModal(false)} className="text-gray-500 hover:text-gray-800">
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-2">项目 *</label>
                  <select
                    required
                    value={formData.project_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, project_id: e.target.value, machine_id: '', rental_contract_id: '' }))}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  >
                    <option value="">选择项目</option>
                    {projects.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">机械 *</label>
                  <select
                    required
                    value={formData.machine_id}
                    onChange={(e) => handleMachineChange(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  >
                    <option value="">选择机械</option>
                    {machines.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.code} - {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-2">作业日期 *</label>
                  <input
                    type="date"
                    required
                    value={formData.record_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, record_date: e.target.value }))}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">租赁合同</label>
                  <select
                    value={formData.rental_contract_id || ''}
                    onChange={(e) => handleContractChange(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  >
                    <option value="">选择合同（可选）</option>
                    {contracts.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.contract_no} - ¥{c.shift_price}/台班
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-2">台班数 *</label>
                  <input
                    type="number"
                    required
                    step="0.1"
                    min="0"
                    value={formData.shift_count}
                    onChange={(e) => setFormData(prev => ({ ...prev, shift_count: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">台班单价</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.cost_per_shift || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, cost_per_shift: parseFloat(e.target.value) || undefined }))}
                    placeholder="自动从合同或机械档案带出"
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-2">开始时间</label>
                  <input
                    type="time"
                    value={formData.start_time || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value || undefined }))}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">结束时间</label>
                  <input
                    type="time"
                    value={formData.end_time || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value || undefined }))}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-500 mb-2">操作人/司机</label>
                <input
                  type="text"
                  value={formData.operator || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, operator: e.target.value || undefined }))}
                  placeholder="输入操作人姓名"
                  className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                />
              </div>

              {/* 总费用展示 */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">总费用：</span>
                  <span className="text-2xl font-bold text-blue-600">¥{calculateTotalCost().toFixed(2)}</span>
                </div>
              </div>

              {/* 拍照凭证 */}
              <div>
                <label className="block text-sm text-gray-500 mb-2">拍照凭证</label>
                <div className="flex flex-wrap gap-2">
                  {formData.images.map((url, index) => (
                    <div key={index} className="relative w-20 h-20">
                      <img src={url} alt={`凭证${index + 1}`} className="w-full h-full object-cover rounded-lg" />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center"
                      >
                        <FaTimes className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <label className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50">
                    <FaCamera className="w-6 h-6 text-gray-400" />
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-500 mb-2">备注</label>
                <textarea
                  value={formData.remark || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, remark: e.target.value || undefined }))}
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  placeholder="输入备注信息"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  {editingRecord ? '更新' : '保存'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}

      {/* 穿透明窗 */}
      {showDrillDown && (
        <DrillDownModal
          title={drillDownData.title}
          projectId={drillDownData.projectId}
          machineId={drillDownData.machineId}
          month={drillDownData.month}
          onClose={() => setShowDrillDown(false)}
        />
      )}

      {/* 提交审批弹窗 */}
      {approvalModal}
    </motion.div>
  );
}
