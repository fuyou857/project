
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaPlus,
  FaEdit,
  FaTrash,
  FaSearch,
  FaTimes,
  FaChevronLeft,
  FaChevronRight,
  FaList,
  FaArchive,
  FaChartBar,
  FaCheck,
  FaCheckCircle,
  FaExclamationCircle,
  FaEye
} from 'react-icons/fa';
import { SegmentedControl } from '../../components/ui';
import { supabase } from '../../supabase/client';
import type {
  Machine,
  MachineCategory,
  MachineShift,
  MachineFormData,
  ShiftFormData
} from './types';
import { machineApi } from './api';

const PAGE_SIZE = 20;

type TabType = 'machines' | 'categories' | 'shifts' | 'statistics';

const MachineManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('machines');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // 机械档案相关
  const [machines, setMachines] = useState<Machine[]>([]);
  const [machineSearch, setMachineSearch] = useState('');
  const [machineStatusFilter, setMachineStatusFilter] = useState('');
  const [machineCategoryFilter, setMachineCategoryFilter] = useState('');

  // 分类管理相关
  const [categories, setCategories] = useState<MachineCategory[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MachineCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', code: '', remark: '' });

  // 台班记录相关
  const [shifts, setShifts] = useState<MachineShift[]>([]);
  const [shiftSearch, setShiftSearch] = useState('');
  const [shiftStatusFilter, setShiftStatusFilter] = useState('');
  const [shiftProjectFilter, setShiftProjectFilter] = useState('');

  // 表单模态框
  const [showMachineModal, setShowMachineModal] = useState(false);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [machineForm, setMachineForm] = useState<MachineFormData>({
    code: '',
    name: '',
    category_id: '',
    purchase_date: new Date().toISOString().split('T')[0],
    purchase_price: 0,
    rental_mode: 'own',
    unit: '台班'
  });

  const [showShiftModal, setShowShiftModal] = useState(false);
  const [editingShift, setEditingShift] = useState<MachineShift | null>(null);
  const [shiftForm, setShiftForm] = useState<ShiftFormData>({
    project_id: '',
    machine_id: '',
    record_date: new Date().toISOString().split('T')[0],
    shift_count: 1,
    images: []
  });

  // 下钻模态框
  const [showDrillDownModal, setShowDrillDownModal] = useState(false);
  const [drillDownData, setDrillDownData] = useState<any>(null);
  const [drillDownTitle, setDrillDownTitle] = useState('');

  // 选项数据
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [statistics, setStatistics] = useState<any>(null);

  // 加载机械列表
  const loadMachines = async () => {
    setLoading(true);
    try {
      const result = await machineApi.getMachines({
        keyword: machineSearch,
        category_id: machineCategoryFilter || undefined,
        status: machineStatusFilter || undefined,
        page,
        page_size: PAGE_SIZE
      });
      setMachines(result.data);
      setTotal(result.total);
    } catch (err) {
      console.error('加载机械列表失败:', err);
    } finally {
      setLoading(false);
    }
  };

  // 加载分类列表
  const loadCategories = async () => {
    try {
      const data = await machineApi.getCategories();
      setCategories(data);
    } catch (err) {
      console.error('加载分类失败:', err);
    }
  };

  // 加载台班列表
  const loadShifts = async () => {
    setLoading(true);
    try {
      const result = await machineApi.getShifts({
        keyword: shiftSearch,
        project_id: shiftProjectFilter || undefined,
        status: shiftStatusFilter || undefined,
        page,
        page_size: PAGE_SIZE
      });
      setShifts(result.data);
      setTotal(result.total);
    } catch (err) {
      console.error('加载台班列表失败:', err);
    } finally {
      setLoading(false);
    }
  };

  // 加载项目列表
  const loadProjects = async () => {
    const { data } = await supabase.from('projects').select('id, name');
    setProjects(data?.map(p => ({ id: p.id, name: p.name })) || []);
  };

  // 加载统计数据
  const loadStatistics = async () => {
    try {
      const stats = await machineApi.getStatistics();
      setStatistics(stats);
    } catch (err) {
      console.error('加载统计数据失败:', err);
    }
  };

  // 初始化
  useEffect(() => {
    loadCategories();
    loadProjects();
  }, []);

  // 根据标签加载对应数据
  useEffect(() => {
    if (activeTab === 'machines') {
      loadMachines();
    } else if (activeTab === 'categories') {
      loadCategories();
    } else if (activeTab === 'shifts') {
      loadShifts();
    } else if (activeTab === 'statistics') {
      loadStatistics();
    }
  }, [activeTab, page, machineSearch, machineStatusFilter, machineCategoryFilter, shiftSearch, shiftStatusFilter, shiftProjectFilter]);

  // 机械操作
  const openAddMachine = async () => {
    const code = await machineApi.generateMachineCode();
    setEditingMachine(null);
    setMachineForm({
      code,
      name: '',
      category_id: '',
      purchase_date: new Date().toISOString().split('T')[0],
      purchase_price: 0,
      rental_mode: 'own',
      unit: '台班'
    });
    setShowMachineModal(true);
  };

  const openEditMachine = async (machine: Machine) => {
    setEditingMachine(machine);
    setMachineForm({
      code: machine.code,
      name: machine.name,
      specification: machine.specification || undefined,
      category_id: machine.category_id,
      model: machine.model || undefined,
      brand: machine.brand || undefined,
      purchase_date: machine.purchase_date,
      purchase_price: machine.purchase_price,
      rental_mode: machine.rental_mode,
      unit: machine.unit,
      location: machine.location || undefined,
      remark: machine.remark || undefined
    });
    setShowMachineModal(true);
  };

  const saveMachine = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingMachine) {
        await machineApi.updateMachine(editingMachine.id, machineForm);
      } else {
        await machineApi.createMachine(machineForm);
      }
      setShowMachineModal(false);
      loadMachines();
    } catch (err: any) {
      alert(err.message || '保存失败');
    }
  };

  const deleteMachine = async (id: string) => {
    if (!confirm('确定要删除该机械吗？')) return;
    try {
      await machineApi.deleteMachine(id);
      loadMachines();
    } catch (err: any) {
      alert(err.message || '删除失败');
    }
  };

  // 台班操作
  const openAddShift = () => {
    setEditingShift(null);
    setShiftForm({
      project_id: '',
      machine_id: '',
      record_date: new Date().toISOString().split('T')[0],
      shift_count: 1,
      images: []
    });
    setShowShiftModal(true);
  };

  const openEditShift = (shift: MachineShift) => {
    setEditingShift(shift);
    setShiftForm({
      project_id: shift.project_id,
      machine_id: shift.machine_id,
      rental_contract_id: shift.rental_contract_id || undefined,
      record_date: shift.record_date,
      shift_count: shift.shift_count,
      start_time: shift.start_time || undefined,
      end_time: shift.end_time || undefined,
      cost_per_shift: shift.cost_per_shift || undefined,
      operator: shift.operator || undefined,
      work_content: shift.work_content || undefined,
      images: shift.images,
      remark: shift.remark || undefined
    });
    setShowShiftModal(true);
  };

  const saveShift = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingShift) {
        await machineApi.updateShift(editingShift.id, shiftForm);
      } else {
        await machineApi.createShift(shiftForm);
      }
      setShowShiftModal(false);
      loadShifts();
    } catch (err: any) {
      alert(err.message || '保存失败');
    }
  };

  const deleteShift = async (id: string) => {
    if (!confirm('确定要删除该台班记录吗？')) return;
    try {
      await machineApi.deleteShift(id);
      loadShifts();
    } catch (err: any) {
      alert(err.message || '删除失败');
    }
  };

  const submitForApproval = async (id: string) => {
    if (!confirm('确定要提交审批吗？')) return;
    try {
      await machineApi.submitForApproval(id);
      loadShifts();
    } catch (err: any) {
      alert(err.message || '提交失败');
    }
  };

  // 数据下钻
  const openDrillDown = (data: any, title: string) => {
    setDrillDownData(data);
    setDrillDownTitle(title);
    setShowDrillDownModal(true);
  };

  // 状态显示
  const getStatusDisplay = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      available: { label: '可用', className: 'bg-green-100 text-green-800' },
      in_use: { label: '使用中', className: 'bg-blue-100 text-blue-800' },
      maintenance: { label: '维护中', className: 'bg-yellow-100 text-yellow-800' },
      out_of_service: { label: '停用', className: 'bg-red-100 text-red-800' },
      draft: { label: '草稿', className: 'bg-gray-100 text-gray-800' },
      pending: { label: '待审批', className: 'bg-orange-100 text-orange-800' },
      confirmed: { label: '已确认', className: 'bg-green-100 text-green-800' },
      rejected: { label: '已拒绝', className: 'bg-red-100 text-red-800' }
    };
    return statusMap[status] || { label: status, className: 'bg-gray-100 text-gray-800' };
  };

  const tabOptions = [
    { value: 'machines', label: '机械档案' },
    { value: 'categories', label: '分类管理' },
    { value: 'shifts', label: '台班记录' },
    { value: 'statistics', label: '统计分析' }
  ];

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-6 space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">机械管理</h1>
          <p className="text-gray-500 mt-1">管理机械档案和台班记录</p>
        </div>
        <div className="flex items-center gap-4">
          <SegmentedControl
            value={activeTab}
            onChange={(v) => setActiveTab(v as TabType)}
            options={tabOptions}
          />
          {(activeTab === 'machines' || activeTab === 'shifts') && (
            <button
              onClick={activeTab === 'machines' ? openAddMachine : openAddShift}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              <FaPlus />
              {activeTab === 'machines' ? '添加机械' : '录入台班'}
            </button>
          )}
        </div>
      </div>

      {/* 机械档案 */}
      {activeTab === 'machines' && (
        <>
          {/* 过滤栏 */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  placeholder="搜索机械编号、名称..."
                  value={machineSearch}
                  onChange={(e) => { setMachineSearch(e.target.value); setPage(1); }}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                />
              </div>
              <select
                value={machineCategoryFilter}
                onChange={(e) => { setMachineCategoryFilter(e.target.value); setPage(1); }}
                className="px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
              >
                <option value="">全部分类</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <select
                value={machineStatusFilter}
                onChange={(e) => { setMachineStatusFilter(e.target.value); setPage(1); }}
                className="px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
              >
                <option value="">全部状态</option>
                <option value="available">可用</option>
                <option value="in_use">使用中</option>
                <option value="maintenance">维护中</option>
                <option value="out_of_service">停用</option>
              </select>
            </div>
          </div>

          {/* 机械列表 */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            {loading ? (
              <div className="text-center text-gray-500 py-12">加载中...</div>
            ) : machines.length === 0 ? (
              <div className="text-center text-gray-500 py-12">暂无机械档案</div>
            ) : (
              <>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-500 text-sm">
                      <th className="text-left py-3 px-4">机械编号</th>
                      <th className="text-left py-3 px-4">机械名称</th>
                      <th className="text-left py-3 px-4">分类</th>
                      <th className="text-right py-3 px-4">购置价格</th>
                      <th className="text-center py-3 px-4">状态</th>
                      <th className="text-left py-3 px-4">当前项目</th>
                      <th className="text-center py-3 px-4">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {machines.map(machine => {
                      const statusInfo = getStatusDisplay(machine.status);
                      return (
                        <motion.tr
                          key={machine.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="border-b border-gray-200/50 hover:bg-gray-50/30"
                        >
                          <td className="py-3 px-4 text-gray-800 font-mono font-medium">{machine.code}</td>
                          <td className="py-3 px-4 text-gray-700">{machine.name}</td>
                          <td className="py-3 px-4 text-gray-700">{machine.category_name || '-'}</td>
                          <td className="py-3 px-4 text-right text-gray-800 font-medium">
                            ¥{machine.purchase_price.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-1 rounded text-xs ${statusInfo.className}`}>
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-gray-700">{machine.current_project_name || '-'}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => openEditMachine(machine)}
                                className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg"
                                title="编辑"
                              >
                                <FaEdit />
                              </button>
                              <button
                                onClick={() => deleteMachine(machine.id)}
                                className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg"
                                title="删除"
                              >
                                <FaTrash />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>

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

      {/* 分类管理 */}
      {activeTab === 'categories' && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-800">机械分类</h3>
            <button
              onClick={() => {
                setEditingCategory(null);
                setCategoryForm({ name: '', code: '', remark: '' });
                setShowCategoryModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              <FaPlus /> 新增分类
            </button>
          </div>

          {categories.length === 0 ? (
            <div className="text-center text-gray-500 py-12">暂无分类</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 text-sm">
                  <th className="text-left py-3 px-4">分类名称</th>
                  <th className="text-left py-3 px-4">分类编码</th>
                  <th className="text-left py-3 px-4">备注</th>
                  <th className="text-center py-3 px-4">操作</th>
                </tr>
              </thead>
              <tbody>
                {categories.map(category => (
                  <tr key={category.id} className="border-b border-gray-200/50 hover:bg-gray-50/30">
                    <td className="py-3 px-4 text-gray-800 font-medium">{category.name}</td>
                    <td className="py-3 px-4 text-gray-700 font-mono">{category.code}</td>
                    <td className="py-3 px-4 text-gray-700">{category.remark || '-'}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            setEditingCategory(category);
                            setCategoryForm({ name: category.name, code: category.code, remark: category.remark || '' });
                            setShowCategoryModal(true);
                          }}
                          className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg"
                        >
                          <FaEdit />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('确定要删除该分类吗？')) {
                              machineApi.deleteCategory(category.id).then(() => loadCategories());
                            }
                          }}
                          className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 台班记录 */}
      {activeTab === 'shifts' && (
        <>
          {/* 过滤栏 */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  placeholder="搜索机械编号、名称..."
                  value={shiftSearch}
                  onChange={(e) => { setShiftSearch(e.target.value); setPage(1); }}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                />
              </div>
              <select
                value={shiftProjectFilter}
                onChange={(e) => { setShiftProjectFilter(e.target.value); setPage(1); }}
                className="px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
              >
                <option value="">全部项目</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <select
                value={shiftStatusFilter}
                onChange={(e) => { setShiftStatusFilter(e.target.value); setPage(1); }}
                className="px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
              >
                <option value="">全部状态</option>
                <option value="draft">草稿</option>
                <option value="pending">待审批</option>
                <option value="confirmed">已确认</option>
                <option value="rejected">已拒绝</option>
              </select>
            </div>
          </div>

          {/* 台班列表 */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            {loading ? (
              <div className="text-center text-gray-500 py-12">加载中...</div>
            ) : shifts.length === 0 ? (
              <div className="text-center text-gray-500 py-12">暂无台班记录</div>
            ) : (
              <>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-500 text-sm">
                      <th className="text-left py-3 px-4">记录日期</th>
                      <th className="text-left py-3 px-4">机械</th>
                      <th className="text-left py-3 px-4">项目</th>
                      <th className="text-right py-3 px-4">台班数</th>
                      <th className="text-right py-3 px-4">费用</th>
                      <th className="text-center py-3 px-4">状态</th>
                      <th className="text-center py-3 px-4">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shifts.map(shift => {
                      const statusInfo = getStatusDisplay(shift.status);
                      return (
                        <motion.tr
                          key={shift.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="border-b border-gray-200/50 hover:bg-gray-50/30"
                        >
                          <td className="py-3 px-4 text-gray-800">{shift.record_date}</td>
                          <td className="py-3 px-4 text-gray-700">
                            {shift.machine_code} - {shift.machine_name}
                          </td>
                          <td className="py-3 px-4 text-gray-700">{shift.project_name || '-'}</td>
                          <td className="py-3 px-4 text-right text-gray-800 font-medium">
                            {shift.shift_count}
                          </td>
                          <td className="py-3 px-4 text-right text-gray-800 font-medium">
                            ¥{shift.total_cost.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-1 rounded text-xs ${statusInfo.className}`}>
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => openEditShift(shift)}
                                className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg"
                                title="编辑"
                              >
                                <FaEdit />
                              </button>
                              {shift.status === 'draft' && (
                                <button
                                  onClick={() => submitForApproval(shift.id)}
                                  className="p-2 text-green-400 hover:bg-green-500/20 rounded-lg"
                                  title="提交审批"
                                >
                                  <FaCheck />
                                </button>
                              )}
                              <button
                                onClick={() => deleteShift(shift.id)}
                                className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg"
                                title="删除"
                              >
                                <FaTrash />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>

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

      {/* 统计分析 */}
      {activeTab === 'statistics' && statistics && (
        <div className="space-y-6">
          {/* 概览卡片 */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="text-sm text-gray-500 mb-2">总台班数</div>
              <div className="text-2xl font-bold text-gray-800">
                {statistics.summary?.total_shifts?.toFixed(1) || 0} 台班
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="text-sm text-gray-500 mb-2">总费用</div>
              <div className="text-2xl font-bold text-blue-600">
                ¥{(statistics.summary?.total_cost || 0).toLocaleString()}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="text-sm text-gray-500 mb-2">使用机械数</div>
              <div className="text-2xl font-bold text-gray-800">
                {statistics.summary?.machine_count || 0} 台
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="text-sm text-gray-500 mb-2">涉及项目数</div>
              <div className="text-2xl font-bold text-green-600">
                {statistics.by_project?.length || 0} 个
              </div>
            </div>
          </div>

          {/* 按项目统计 */}
          {statistics.by_project?.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">按项目统计</h3>
              <div className="space-y-3">
                {statistics.by_project.map((item: any) => (
                  <motion.div
                    key={item.project_id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
                    onClick={() => openDrillDown({ type: 'project', id: item.project_id }, '项目详情')}
                  >
                    <div>
                      <div className="font-medium text-gray-800">
                        {projects.find(p => p.id === item.project_id)?.name || '未知项目'}
                      </div>
                    </div>
                    <div className="flex items-center gap-8">
                      <div className="text-right">
                        <div className="text-sm text-gray-500">台班数</div>
                        <div className="text-lg font-bold text-blue-600">
                          {item.total_shifts.toFixed(1)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-500">费用</div>
                        <div className="text-lg font-bold text-green-600">
                          ¥{item.total_cost.toLocaleString()}
                        </div>
                      </div>
                      <FaEye className="text-gray-400" />
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* 按机械统计 */}
          {statistics.by_machine?.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">按机械统计</h3>
              <div className="grid grid-cols-2 gap-4">
                {statistics.by_machine.map((item: any) => {
                  const machine = machines.find(m => m.id === item.machine_id);
                  return (
                    <motion.div
                      key={item.machine_id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
                      onClick={() => openDrillDown({ type: 'machine', id: item.machine_id }, '机械详情')}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium text-gray-800">
                          {machine?.name || '未知机械'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {machine?.code || ''}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm text-gray-500">台班数</div>
                          <div className="text-lg font-bold text-blue-600">
                            {item.total_shifts.toFixed(1)}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500">费用</div>
                          <div className="text-lg font-bold text-green-600">
                            ¥{item.total_cost.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 机械表单模态框 */}
      {showMachineModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowMachineModal(false)}
        >
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-xl font-bold text-gray-800">
                {editingMachine ? '编辑机械' : '添加机械'}
              </h3>
              <button onClick={() => setShowMachineModal(false)} className="text-gray-500 hover:text-gray-800">
                <FaTimes />
              </button>
            </div>

            <form onSubmit={saveMachine} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-2">机械编号 *</label>
                  <input
                    type="text"
                    required
                    value={machineForm.code}
                    onChange={(e) => setMachineForm({ ...machineForm, code: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">机械名称 *</label>
                  <input
                    type="text"
                    required
                    value={machineForm.name}
                    onChange={(e) => setMachineForm({ ...machineForm, name: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-2">分类 *</label>
                  <select
                    required
                    value={machineForm.category_id}
                    onChange={(e) => setMachineForm({ ...machineForm, category_id: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  >
                    <option value="">选择分类</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">租赁方式 *</label>
                  <select
                    required
                    value={machineForm.rental_mode}
                    onChange={(e) => setMachineForm({ ...machineForm, rental_mode: e.target.value as 'own' | 'rental' })}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  >
                    <option value="own">自有</option>
                    <option value="rental">租赁</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-2">购置日期 *</label>
                  <input
                    type="date"
                    required
                    value={machineForm.purchase_date}
                    onChange={(e) => setMachineForm({ ...machineForm, purchase_date: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">购置价格 *</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    value={machineForm.purchase_price}
                    onChange={(e) => setMachineForm({ ...machineForm, purchase_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-2">规格型号</label>
                  <input
                    type="text"
                    value={machineForm.specification || ''}
                    onChange={(e) => setMachineForm({ ...machineForm, specification: e.target.value || undefined })}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">品牌</label>
                  <input
                    type="text"
                    value={machineForm.brand || ''}
                    onChange={(e) => setMachineForm({ ...machineForm, brand: e.target.value || undefined })}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-500 mb-2">备注</label>
                <textarea
                  value={machineForm.remark || ''}
                  onChange={(e) => setMachineForm({ ...machineForm, remark: e.target.value || undefined })}
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowMachineModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  {editingMachine ? '更新' : '添加'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}

      {/* 分类表单模态框 */}
      {showCategoryModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowCategoryModal(false)}
        >
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="bg-white rounded-xl w-full max-w-md border border-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-xl font-bold text-gray-800">
                {editingCategory ? '编辑分类' : '添加分类'}
              </h3>
              <button onClick={() => setShowCategoryModal(false)} className="text-gray-500 hover:text-gray-800">
                <FaTimes />
              </button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                if (editingCategory) {
                  await machineApi.updateCategory(editingCategory.id, categoryForm);
                } else {
                  await machineApi.createCategory({ ...categoryForm, parent_id: null, sort_order: categories.length });
                }
                setShowCategoryModal(false);
                loadCategories();
              } catch (err: any) {
                alert(err.message || '保存失败');
              }
            }} className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-gray-500 mb-2">分类名称 *</label>
                <input
                  type="text"
                  required
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-2">分类编码</label>
                <input
                  type="text"
                  value={categoryForm.code}
                  onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-2">备注</label>
                <textarea
                  value={categoryForm.remark}
                  onChange={(e) => setCategoryForm({ ...categoryForm, remark: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  {editingCategory ? '更新' : '添加'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}

      {/* 下钻模态框 */}
      {showDrillDownModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowDrillDownModal(false)}
        >
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="bg-white rounded-xl w-full max-w-3xl max-h-[80vh] overflow-y-auto border border-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-xl font-bold text-gray-800">{drillDownTitle}</h3>
              <button onClick={() => setShowDrillDownModal(false)} className="text-gray-500 hover:text-gray-800">
                <FaTimes />
              </button>
            </div>

            <div className="p-4">
              {drillDownData ? (
                <div className="text-gray-600">
                  <p className="mb-4">数据下钻功能正在完善中...</p>
                  <pre className="bg-gray-50 p-4 rounded-lg overflow-auto text-sm">
                    {JSON.stringify(drillDownData, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">暂无数据</div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default MachineManagement;
