import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPlus, FaEdit, FaTrash, FaSearch, FaTimes, FaCogs, FaList } from 'react-icons/fa';
import { SearchableSelect, SegmentedControl } from '../../components/ui';
import { projectSelectOptions } from '../../components/ui/options';
import { fetchMachineShiftRecords, createMachineShiftRecord, updateMachineShiftRecord, deleteMachineShiftRecord, fetchProjectOptions, fetchMachineOptions, fetchContractsByProject } from '../../services/machineShiftService';
import type { MachineShiftRecord } from '../../services/machineShiftService';

const mockProjects = [
  { id: '1', name: '星河湾小区工程' },
  { id: '2', name: '市政道路改造' },
  { id: '3', name: '商业综合体' },
];

const mockSuppliers = [
  { id: '1', name: '建筑机械租赁公司' },
  { id: '2', name: '设备供应商A' },
];

const mockEquipment = [
  { id: '1', code: 'EQ001', name: '挖掘机', spec: 'CAT320', unit: '台', projectId: '1', supplierId: '1', date: '2024-01-15', status: 'available', remark: '' },
  { id: '2', code: 'EQ002', name: '塔吊', spec: 'QTZ80', unit: '台', projectId: '2', supplierId: '2', date: '2024-02-01', status: 'available', remark: '' },
  { id: '3', code: 'EQ003', name: '混凝土泵车', spec: '37米', unit: '辆', projectId: '', supplierId: '1', date: '2024-01-20', status: 'repair', remark: '维修中' },
];

type TabType = 'list' | 'shift';

export default function EquipmentList() {
  const [activeTab, setActiveTab] = useState<TabType>('list');
  const [selectedProject, setSelectedProject] = useState('');
  const [searchText, setSearchText] = useState('');
  const [equipment, setEquipment] = useState(mockEquipment);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    code: '', name: '', spec: '', unit: '', projectId: '', supplierId: '', date: '', status: 'available', remark: ''
  });

  const [shiftRecords, setShiftRecords] = useState<MachineShiftRecord[]>([]);
  const [shiftLoading, setShiftLoading] = useState(false);
  const [shiftFilterProject, setShiftFilterProject] = useState('');
  const [shiftFilterDate, setShiftFilterDate] = useState('');
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [editShiftId, setEditShiftId] = useState<string | null>(null);
  const [shiftFormData, setShiftFormData] = useState({
    project_id: '',
    machine_id: '',
    rental_contract_id: '',
    record_date: new Date().toISOString().split('T')[0],
    shift_count: 1,
    cost_per_shift: 0,
    operator: '',
    remark: ''
  });
  const [projectOptions, setProjectOptions] = useState<{ value: string; label: string }[]>([]);
  const [machineOptions, setMachineOptions] = useState<{ value: string; label: string }[]>([]);
  const [contractOptions, setContractOptions] = useState<{ value: string; label: string }[]>([]);
  const [savingShift, setSavingShift] = useState(false);

  const filteredEquipment = equipment.filter(e => {
    const matchProject = !selectedProject || e.projectId === selectedProject;
    const matchSearch = !searchText || e.name.includes(searchText) || e.code.includes(searchText);
    return matchProject && matchSearch;
  });

  const filteredShiftRecords = shiftRecords.filter(r => {
    const matchProject = !shiftFilterProject || r.project_id === shiftFilterProject;
    const matchDate = !shiftFilterDate || r.record_date === shiftFilterDate;
    return matchProject && matchDate;
  });

  const totalShifts = filteredShiftRecords.reduce((sum, r) => sum + Number(r.shift_count), 0);
  const totalCosts = filteredShiftRecords.reduce((sum, r) => sum + Number(r.total_cost), 0);

  const loadShiftRecords = async () => {
    setShiftLoading(true);
    try {
      const filter: any = {};
      if (shiftFilterProject) filter.projectId = shiftFilterProject;
      if (shiftFilterDate) {
        filter.dateFrom = shiftFilterDate;
        filter.dateTo = shiftFilterDate;
      }
      const data = await fetchMachineShiftRecords(filter);
      setShiftRecords(data);
    } catch (err) {
      console.error('Failed to load shift records:', err);
    } finally {
      setShiftLoading(false);
    }
  };

  const loadProjectOptions = async () => {
    try {
      const options = await fetchProjectOptions();
      setProjectOptions(options);
    } catch (err) {
      console.error('Failed to load project options:', err);
    }
  };

  const loadMachineOptions = async (projectId?: string) => {
    try {
      const options = await fetchMachineOptions(projectId);
      setMachineOptions(options);
    } catch (err) {
      console.error('Failed to load machine options:', err);
    }
  };

  const loadContractOptions = async (projectId: string) => {
    try {
      const contracts = await fetchContractsByProject(projectId);
      setContractOptions(contracts);
    } catch (err) {
      console.error('Failed to load contract options:', err);
    }
  };

  const handleTabChange = async (tab: TabType) => {
    setActiveTab(tab);
    if (tab === 'shift') {
      await Promise.all([loadShiftRecords(), loadProjectOptions()]);
    }
  };

  const handleOpenModal = (item?: typeof mockEquipment[0]) => {
    if (item) {
      setEditId(item.id);
      setFormData({ ...item });
    } else {
      setEditId(null);
      setFormData({ code: `EQ${String(equipment.length + 1).padStart(3, '0')}`, name: '', spec: '', unit: '台', projectId: '', supplierId: '', date: '', status: 'available', remark: '' });
    }
    setShowModal(true);
  };

  const handleSave = () => {
    if (!formData.name || !formData.code) return;
    if (editId) {
      setEquipment(equipment.map(e => e.id === editId ? { ...formData, id: editId } : e));
    } else {
      setEquipment([...equipment, { ...formData, id: Date.now().toString() }]);
    }
    setShowModal(false);
  };

  const handleDelete = (id: string) => {
    setEquipment(equipment.filter(e => e.id !== id));
    setShowDeleteConfirm(null);
  };

  const handleProjectChange = async (projectId: string) => {
    setShiftFormData(prev => ({ ...prev, project_id: projectId, machine_id: '', rental_contract_id: '' }));
    if (projectId) {
      await Promise.all([loadMachineOptions(projectId), loadContractOptions(projectId)]);
    } else {
      setMachineOptions([]);
      setContractOptions([]);
    }
  };

  const handleMachineChange = async (machineId: string) => {
    setShiftFormData(prev => ({ ...prev, machine_id: machineId }));
    if (machineId) {
      const machine = machineOptions.find(m => m.value === machineId);
      if (machine) {
        setShiftFormData(prev => {
          if (prev.cost_per_shift === 0) {
            return prev;
          }
          return prev;
        });
      }
    }
  };

  const handleContractChange = (contractId: string) => {
    const contract = contractOptions.find(c => c.value === contractId);
    setShiftFormData(prev => ({
      ...prev,
      rental_contract_id: contractId,
      cost_per_shift: prev.cost_per_shift || 0
    }));
  };

  const handleOpenShiftModal = (record?: MachineShiftRecord) => {
    if (record) {
      setEditShiftId(record.id);
      setShiftFormData({
        project_id: record.project_id,
        machine_id: record.machine_id,
        rental_contract_id: '',
        record_date: record.record_date,
        shift_count: record.shift_count,
        cost_per_shift: record.cost_per_shift,
        operator: record.operator || '',
        remark: record.remark || ''
      });
      loadMachineOptions(record.project_id);
      loadContractOptions(record.project_id);
    } else {
      setEditShiftId(null);
      setShiftFormData({
        project_id: '',
        machine_id: '',
        rental_contract_id: '',
        record_date: new Date().toISOString().split('T')[0],
        shift_count: 1,
        cost_per_shift: 0,
        operator: '',
        remark: ''
      });
      setMachineOptions([]);
      setContractOptions([]);
    }
    setShowShiftModal(true);
  };

  const handleSaveShift = async () => {
    if (!shiftFormData.project_id) {
      alert('请选择项目');
      return;
    }
    if (!shiftFormData.machine_id) {
      alert('请选择机械');
      return;
    }
    if (!shiftFormData.shift_count || shiftFormData.shift_count <= 0) {
      alert('台班数必须大于0');
      return;
    }

    setSavingShift(true);
    try {
      const data = {
        project_id: shiftFormData.project_id,
        machine_id: shiftFormData.machine_id,
        rental_contract_id: shiftFormData.rental_contract_id || undefined,
        record_date: shiftFormData.record_date,
        shift_count: shiftFormData.shift_count,
        cost_per_shift: shiftFormData.cost_per_shift,
        total_cost: shiftFormData.shift_count * shiftFormData.cost_per_shift,
        operator: shiftFormData.operator || undefined,
        remark: shiftFormData.remark || undefined,
        status: 'draft'
      };

      if (editShiftId) {
        await updateMachineShiftRecord(editShiftId, data);
      } else {
        await createMachineShiftRecord(data);
      }

      setShowShiftModal(false);
      await loadShiftRecords();
    } catch (err: any) {
      alert(err.message || '保存失败');
    } finally {
      setSavingShift(false);
    }
  };

  const handleDeleteShift = async (id: string) => {
    if (!confirm('确定要删除该台班记录吗？')) return;
    try {
      await deleteMachineShiftRecord(id);
      await loadShiftRecords();
    } catch (err: any) {
      alert(err.message || '删除失败');
    }
  };

  const statusMap: Record<string, string> = { available: '可用', repair: '维修', scrapped: '报废' };
  const statusColor: Record<string, string> = { available: 'text-green-400', repair: 'text-yellow-400', scrapped: 'text-red-400' };
  const shiftStatusMap: Record<string, { label: string; color: string }> = {
    draft: { label: '草稿', color: 'text-gray-400' },
    pending: { label: '待审批', color: 'text-yellow-400' },
    confirmed: { label: '已确认', color: 'text-green-400' },
    rejected: { label: '已驳回', color: 'text-red-400' }
  };

  const projectFilterOptions = useMemo(
    () => projectSelectOptions(mockProjects.map(p => ({ id: p.id, name: p.name })), '全部项目'),
    [],
  );
  const formProjectOptions = useMemo(
    () => projectSelectOptions(mockProjects.map(p => ({ id: p.id, name: p.name })), '公司自有'),
    [],
  );
  const supplierOptions = useMemo(
    () => [{ value: '', label: '请选择' }, ...mockSuppliers.map(s => ({ value: s.id, label: s.name }))],
    [],
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h3 className="text-xl font-bold text-gray-800">机械管理</h3>
          <SegmentedControl
            value={activeTab}
            onChange={(v) => handleTabChange(v as TabType)}
            options={[
              { value: 'list', label: '机械台账' },
              { value: 'shift', label: '机械台班' },
            ]}
            metricsContext="page:equipment:tabs"
          />
        </div>
        {activeTab === 'list' && (
          <div className="flex items-center gap-4">
            <div className="min-w-[12rem]">
              <SearchableSelect
                value={selectedProject}
                onChange={setSelectedProject}
                options={projectFilterOptions}
                placeholder="全部项目"
                emptyLabel="全部项目"
                searchPlaceholder="搜索项目…"
                metricsContext="page:equipment_list:filter_project"
                className="min-w-[12rem]"
              />
            </div>
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input type="text" placeholder="搜索机械..." value={searchText} onChange={e => setSearchText(e.target.value)} className="pl-10 pr-4 py-2 bg-gray-50 border border-slate-600 text-gray-800 rounded-lg w-64" />
            </div>
            <button onClick={() => handleOpenModal()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-gray-800 rounded-lg">
              <FaPlus /> 新增机械
            </button>
          </div>
        )}
        {activeTab === 'shift' && (
          <div className="flex items-center gap-4">
            <div className="min-w-[12rem]">
              <SearchableSelect
                value={shiftFilterProject}
                onChange={(v) => { setShiftFilterProject(v); }}
                options={projectOptions}
                placeholder="全部项目"
                emptyLabel="全部项目"
                searchPlaceholder="搜索项目…"
                metricsContext="page:equipment_shift:filter_project"
                className="min-w-[12rem]"
              />
            </div>
            <input
              type="date"
              value={shiftFilterDate}
              onChange={e => setShiftFilterDate(e.target.value)}
              className="px-4 py-2 bg-gray-50 border border-slate-600 text-gray-800 rounded-lg"
            />
            <button onClick={() => { setShiftFilterProject(''); setShiftFilterDate(''); }} className="px-4 py-2 bg-gray-50 text-gray-800 rounded-lg hover:bg-gray-200">
              重置
            </button>
            <button onClick={() => loadShiftRecords()} className="px-4 py-2 bg-blue-600 text-gray-800 rounded-lg hover:bg-blue-700">
              刷新
            </button>
            <button onClick={() => handleOpenShiftModal()} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-gray-800 rounded-lg">
              <FaPlus /> 录入台班
            </button>
          </div>
        )}
      </div>

      {activeTab === 'list' && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-gray-700">
                <th className="px-4 py-3 text-left">机械编码</th>
                <th className="px-4 py-3 text-left">机械名称</th>
                <th className="px-4 py-3 text-left">规格型号</th>
                <th className="px-4 py-3 text-center">单位</th>
                <th className="px-4 py-3 text-left">所属项目</th>
                <th className="px-4 py-3 text-left">供应商</th>
                <th className="px-4 py-3 text-left">日期</th>
                <th className="px-4 py-3 text-center">状态</th>
                <th className="px-4 py-3 text-center">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredEquipment.map(e => (
                <tr key={e.id} className="border-t border-gray-200 text-gray-700 hover:bg-gray-50/50">
                  <td className="px-4 py-3">{e.code}</td>
                  <td className="px-4 py-3 text-gray-800 font-medium">{e.name}</td>
                  <td className="px-4 py-3">{e.spec}</td>
                  <td className="px-4 py-3 text-center">{e.unit}</td>
                  <td className="px-4 py-3">{mockProjects.find(p => p.id === e.projectId)?.name || '-'}</td>
                  <td className="px-4 py-3">{mockSuppliers.find(s => s.id === e.supplierId)?.name || '-'}</td>
                  <td className="px-4 py-3">{e.date}</td>
                  <td className={`px-4 py-3 text-center ${statusColor[e.status]}`}>{statusMap[e.status]}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => handleOpenModal(e)} className="p-2 text-blue-400 hover:bg-gray-500 rounded"><FaEdit /></button>
                      <button onClick={() => setShowDeleteConfirm(e.id)} className="p-2 text-red-400 hover:bg-gray-500 rounded"><FaTrash /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'shift' && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
              <div className="text-sm text-blue-600 font-medium">累计台班数</div>
              <div className="text-2xl font-bold text-blue-800 mt-1">{totalShifts.toFixed(1)} 台班</div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
              <div className="text-sm text-green-600 font-medium">累计台班费用</div>
              <div className="text-2xl font-bold text-green-800 mt-1">¥{totalCosts.toFixed(2)}</div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
              <div className="text-sm text-purple-600 font-medium">台班记录数</div>
              <div className="text-2xl font-bold text-purple-800 mt-1">{filteredShiftRecords.length} 条</div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-gray-700">
                  <th className="px-4 py-3 text-left">项目</th>
                  <th className="px-4 py-3 text-left">机械</th>
                  <th className="px-4 py-3 text-left">作业日期</th>
                  <th className="px-4 py-3 text-center">台班数</th>
                  <th className="px-4 py-3 text-right">单价</th>
                  <th className="px-4 py-3 text-right">总费用</th>
                  <th className="px-4 py-3 text-center">操作人</th>
                  <th className="px-4 py-3 text-center">状态</th>
                  <th className="px-4 py-3 text-center">操作</th>
                </tr>
              </thead>
              <tbody>
                {shiftLoading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-500">加载中...</td>
                  </tr>
                ) : filteredShiftRecords.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-500">暂无台班记录</td>
                  </tr>
                ) : (
                  filteredShiftRecords.map(r => (
                    <tr key={r.id} className="border-t border-gray-200 text-gray-700 hover:bg-gray-50/50">
                      <td className="px-4 py-3">{r.project_id}</td>
                      <td className="px-4 py-3 text-gray-800 font-medium">{r.machine_id}</td>
                      <td className="px-4 py-3">{r.record_date}</td>
                      <td className="px-4 py-3 text-center">{Number(r.shift_count).toFixed(1)}</td>
                      <td className="px-4 py-3 text-right">¥{Number(r.cost_per_shift).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-medium text-green-600">¥{Number(r.total_cost).toFixed(2)}</td>
                      <td className="px-4 py-3 text-center">{r.operator || '-'}</td>
                      <td className={`px-4 py-3 text-center ${shiftStatusMap[r.status]?.color || 'text-gray-400'}`}>
                        {shiftStatusMap[r.status]?.label || r.status}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => handleOpenShiftModal(r)} className="p-2 text-blue-400 hover:bg-gray-500 rounded"><FaEdit /></button>
                          <button onClick={() => handleDeleteShift(r.id)} className="p-2 text-red-400 hover:bg-gray-500 rounded"><FaTrash /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={(e) => { e.stopPropagation(); }}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white rounded-xl p-6 w-full max-w-lg border border-gray-200" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-gray-800">{editId ? '编辑机械' : '新增机械'}</h3>
                <button onClick={(e) => { e.stopPropagation(); }} className="text-gray-500 hover:text-gray-800"><FaTimes /></button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-500 text-sm mb-2">机械编码 *</label>
                    <input value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 text-gray-800 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-gray-500 text-sm mb-2">机械名称 *</label>
                    <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 text-gray-800 rounded-lg" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-500 text-sm mb-2">规格型号</label>
                    <input value={formData.spec} onChange={e => setFormData({ ...formData, spec: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 text-gray-800 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-gray-500 text-sm mb-2">单位</label>
                    <SegmentedControl
                      value={formData.unit}
                      onChange={u => setFormData({ ...formData, unit: u })}
                      options={[
                        { value: '台', label: '台' },
                        { value: '套', label: '套' },
                        { value: '辆', label: '辆' },
                      ]}
                      metricsContext="page:equipment_list:form_unit"
                      aria-label="单位"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-500 text-sm mb-2">所属项目</label>
                    <SearchableSelect
                      value={formData.projectId}
                      onChange={v => setFormData({ ...formData, projectId: v })}
                      options={formProjectOptions}
                      placeholder="公司自有"
                      emptyLabel="公司自有"
                      searchPlaceholder="搜索项目…"
                      metricsContext="page:equipment_list:form_project"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-500 text-sm mb-2">供应商</label>
                    <SearchableSelect
                      value={formData.supplierId}
                      onChange={v => setFormData({ ...formData, supplierId: v })}
                      options={supplierOptions}
                      placeholder="请选择"
                      emptyLabel="请选择"
                      searchPlaceholder="搜索供应商…"
                      metricsContext="page:equipment_list:form_supplier"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-500 text-sm mb-2">购买/租赁日期</label>
                    <input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 text-gray-800 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-gray-500 text-sm mb-2">状态</label>
                    <SegmentedControl
                      value={formData.status}
                      onChange={s => setFormData({ ...formData, status: s })}
                      options={[
                        { value: 'available', label: '可用' },
                        { value: 'repair', label: '维修' },
                        { value: 'scrapped', label: '报废' },
                      ]}
                      metricsContext="page:equipment_list:form_status"
                      aria-label="机械状态"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-gray-500 text-sm mb-2">备注</label>
                  <textarea value={formData.remark} onChange={e => setFormData({ ...formData, remark: e.target.value })} rows={2} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 text-gray-800 rounded-lg resize-none" />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={(e) => { e.stopPropagation(); }} className="px-4 py-2 bg-gray-50 text-gray-800 rounded-lg hover:bg-gray-500">取消</button>
                <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-gray-800 rounded-lg hover:bg-blue-700">保存</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white rounded-xl p-6 w-full max-w-sm border border-gray-200">
              <h4 className="text-lg font-bold text-gray-800 mb-2">确认删除</h4>
              <p className="text-gray-500 mb-6">确定要删除该机械吗？此操作不可恢复。</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowDeleteConfirm(null)} className="px-4 py-2 text-gray-500 hover:text-gray-800">取消</button>
                <button onClick={() => handleDelete(showDeleteConfirm)} className="bg-red-600 text-gray-800 px-4 py-2 rounded-lg">确认删除</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showShiftModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={(e) => { e.stopPropagation(); }}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white rounded-xl p-6 w-full max-w-lg border border-gray-200 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-gray-800">{editShiftId ? '编辑台班' : '录入台班'}</h3>
                <button onClick={(e) => { e.stopPropagation(); setShowShiftModal(false); }} className="text-gray-500 hover:text-gray-800"><FaTimes /></button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-500 text-sm mb-2">项目 *</label>
                    <SearchableSelect
                      value={shiftFormData.project_id}
                      onChange={handleProjectChange}
                      options={projectOptions}
                      placeholder="请选择项目"
                      emptyLabel="无项目"
                      searchPlaceholder="搜索项目…"
                      metricsContext="page:equipment_shift:form_project"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-500 text-sm mb-2">机械 *</label>
                    <SearchableSelect
                      value={shiftFormData.machine_id}
                      onChange={handleMachineChange}
                      options={machineOptions}
                      placeholder="请选择机械"
                      emptyLabel="无机械"
                      searchPlaceholder="搜索机械…"
                      metricsContext="page:equipment_shift:form_machine"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-500 text-sm mb-2">作业日期 *</label>
                    <input
                      type="date"
                      value={shiftFormData.record_date}
                      onChange={e => setShiftFormData({ ...shiftFormData, record_date: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 border border-slate-600 text-gray-800 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-500 text-sm mb-2">租赁合同</label>
                    <SearchableSelect
                      value={shiftFormData.rental_contract_id}
                      onChange={handleContractChange}
                      options={contractOptions}
                      placeholder="可不选"
                      emptyLabel="无合同"
                      searchPlaceholder="搜索合同…"
                      metricsContext="page:equipment_shift:form_contract"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-500 text-sm mb-2">台班数 *</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={shiftFormData.shift_count}
                      onChange={e => setShiftFormData({ ...shiftFormData, shift_count: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2 bg-gray-50 border border-slate-600 text-gray-800 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-500 text-sm mb-2">台班单价(元)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={shiftFormData.cost_per_shift}
                      onChange={e => setShiftFormData({ ...shiftFormData, cost_per_shift: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2 bg-gray-50 border border-slate-600 text-gray-800 rounded-lg"
                    />
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">总费用：</span>
                    <span className="text-lg font-bold text-green-600 ml-2">
                      ¥{(shiftFormData.shift_count * shiftFormData.cost_per_shift).toFixed(2)}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-gray-500 text-sm mb-2">操作人/司机</label>
                  <input
                    type="text"
                    value={shiftFormData.operator}
                    onChange={e => setShiftFormData({ ...shiftFormData, operator: e.target.value })}
                    placeholder="请输入操作人姓名"
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 text-gray-800 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-gray-500 text-sm mb-2">备注</label>
                  <textarea
                    value={shiftFormData.remark}
                    onChange={e => setShiftFormData({ ...shiftFormData, remark: e.target.value })}
                    rows={2}
                    placeholder="可选"
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 text-gray-800 rounded-lg resize-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={(e) => { e.stopPropagation(); setShowShiftModal(false); }} className="px-4 py-2 bg-gray-50 text-gray-800 rounded-lg hover:bg-gray-200">取消</button>
                <button onClick={handleSaveShift} disabled={savingShift} className="px-4 py-2 bg-green-600 text-gray-800 rounded-lg hover:bg-green-700 disabled:opacity-50">
                  {savingShift ? '保存中...' : '保存'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
