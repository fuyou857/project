import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPlus, FaEdit, FaTrash, FaSearch, FaTimes } from 'react-icons/fa';
import { SearchableSelect, SegmentedControl } from '../../components/ui';
import { projectSelectOptions } from '../../components/ui/options';

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

export default function EquipmentList() {
  const [selectedProject, setSelectedProject] = useState('');
  const [searchText, setSearchText] = useState('');
  const [equipment, setEquipment] = useState(mockEquipment);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    code: '', name: '', spec: '', unit: '', projectId: '', supplierId: '', date: '', status: 'available', remark: ''
  });

  const filteredEquipment = equipment.filter(e => {
    const matchProject = !selectedProject || e.projectId === selectedProject;
    const matchSearch = !searchText || e.name.includes(searchText) || e.code.includes(searchText);
    return matchProject && matchSearch;
  });

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

  const statusMap: Record<string, string> = { available: '可用', repair: '维修', scrapped: '报废' };
  const statusColor: Record<string, string> = { available: 'text-green-400', repair: 'text-yellow-400', scrapped: 'text-red-400' };

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
        <h3 className="text-xl font-bold text-gray-800">机械台账</h3>
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
      </div>

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
    </div>
  );
}
