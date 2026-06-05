import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SearchableSelect } from '../../components/ui';
import { useProjectsForSelect } from '../../hooks/useProjectsForSelect';
import { FaPlus, FaEdit, FaTrash, FaSearch, FaFileUpload, FaTimes, FaFilter } from 'react-icons/fa';

const PROJECT_SEARCH_PROPS = {
  searchThreshold: 1 as const,
  searchPlaceholder: '搜索项目名称或编号…',
};

const mockEquipment = [
  { id: '1', code: 'EQ001', name: '挖掘机' },
  { id: '2', code: 'EQ002', name: '塔吊' },
  { id: '3', code: 'EQ003', name: '混凝土泵车' },
];

type EquipmentReportRow = {
  id: string;
  projectId: string;
  equipmentId: string;
  date: string;
  shiftCount: number;
  unitPrice: number;
  total: number;
  operator: string;
  attachments: string[];
  createdAt: string;
};

const mockReports: EquipmentReportRow[] = [
  { id: '1', projectId: '1', equipmentId: '1', date: '2024-03-15', shiftCount: 2, unitPrice: 1500, total: 3000, operator: '张三', attachments: ['确认表1.pdf'], createdAt: '2024-03-15 10:30' },
  { id: '2', projectId: '1', equipmentId: '2', date: '2024-03-14', shiftCount: 1, unitPrice: 2000, total: 2000, operator: '李四', attachments: [], createdAt: '2024-03-14 16:20' },
  { id: '3', projectId: '2', equipmentId: '3', date: '2024-03-13', shiftCount: 3, unitPrice: 1800, total: 5400, operator: '王五', attachments: ['确认表2.jpg'], createdAt: '2024-03-13 09:15' },
];

type EquipmentFormState = {
  projectId: string;
  equipmentId: string;
  date: string;
  shiftCount: number | null;
  unitPrice: number | null;
  remark: string;
  attachments: string[];
};

export default function EquipmentReport() {
  const { filterOptions: projectFilterOptions, projects, getProjectName } = useProjectsForSelect({
    filterEmptyLabel: '全部项目',
  });
  const [selectedProject, setSelectedProject] = useState('');
  const [searchText, setSearchText] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [reports, setReports] = useState<EquipmentReportRow[]>(mockReports);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState<EquipmentFormState>({
    projectId: '', equipmentId: '', date: new Date().toISOString().split('T')[0], shiftCount: null, unitPrice: null, remark: '', attachments: [],
  });

  const filteredReports = reports.filter(r => {
    const matchProject = !selectedProject || r.projectId === selectedProject;
    const matchSearch = !searchText || mockEquipment.find(e => e.id === r.equipmentId)?.name.includes(searchText);
    const matchDateStart = !dateRange.start || r.date >= dateRange.start;
    const matchDateEnd = !dateRange.end || r.date <= dateRange.end;
    return matchProject && matchSearch && matchDateStart && matchDateEnd;
  });

  const handleOpenModal = (item?: EquipmentReportRow) => {
    if (item) {
      setEditId(item.id);
      setFormData({ projectId: item.projectId, equipmentId: item.equipmentId, date: item.date, shiftCount: item.shiftCount, unitPrice: item.unitPrice, remark: '', attachments: item.attachments || [] });
    } else {
      setEditId(null);
      setFormData({ projectId: '', equipmentId: '', date: new Date().toISOString().split('T')[0], shiftCount: null, unitPrice: null, remark: '', attachments: [] });
    }
    setShowModal(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const names = Array.from(files).map(f => f.name);
    setFormData({ ...formData, attachments: [...formData.attachments, ...names].slice(0, 5) });
  };

  const handleSave = () => {
    if (!formData.projectId || !formData.equipmentId || formData.shiftCount == null || formData.unitPrice == null) return;
    const total = formData.shiftCount * formData.unitPrice;
    const row: Omit<EquipmentReportRow, 'id' | 'createdAt'> = {
      projectId: formData.projectId,
      equipmentId: formData.equipmentId,
      date: formData.date,
      shiftCount: formData.shiftCount,
      unitPrice: formData.unitPrice,
      total,
      operator: '当前用户',
      attachments: formData.attachments,
    };
    if (editId) {
      setReports(
        reports.map(r =>
          r.id === editId ? { ...row, id: editId, createdAt: r.createdAt } : r
        )
      );
    } else {
      setReports([{ ...row, id: Date.now().toString(), createdAt: new Date().toLocaleString() }, ...reports]);
    }
    setShowModal(false);
  };

  const handleDelete = (id: string) => {
    setReports(reports.filter(r => r.id !== id));
    setShowDeleteConfirm(null);
  };

  const totalAmount = filteredReports.reduce((sum, r) => sum + r.total, 0);

  const formProjectOptions = useMemo(
    () => projects.map(p => ({
      value: p.id,
      label: p.project_code ? `[${p.project_code}] ${p.name}` : p.name,
    })),
    [projects],
  );
  const equipmentOptions = useMemo(
    () => mockEquipment.map(e => ({ value: e.id, label: e.name })),
    [],
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-800">台班上报表</h3>
        <button onClick={() => handleOpenModal()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-gray-800 rounded-lg">
          <FaPlus /> 新增上报
        </button>
      </div>

      <div className="flex gap-4 mb-6 items-center">
        <div className="min-w-[12rem]">
          <SearchableSelect
            value={selectedProject}
            onChange={setSelectedProject}
            options={projectFilterOptions}
            placeholder="全部项目"
            emptyLabel="全部项目"
            {...PROJECT_SEARCH_PROPS}
            metricsContext="page:equipment_report:filter_project"
          />
        </div>
        <div className="flex-1 relative">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input type="text" placeholder="搜索机械名称..." value={searchText} onChange={e => setSearchText(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-slate-600 text-gray-800 rounded-lg" />
        </div>
        <button onClick={() => setShowFilter(!showFilter)} className={`flex items-center gap-2 px-4 py-2 rounded-lg ${showFilter ? 'bg-blue-600' : 'bg-gray-50'} text-gray-800`}>
          <FaFilter /> 筛选
        </button>
      </div>

      {showFilter && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4 p-4 bg-gray-50/50 rounded-lg">
          <div className="flex items-center gap-4">
            <span className="text-gray-500">使用日期:</span>
            <input type="date" value={dateRange.start} onChange={e => setDateRange({ ...dateRange, start: e.target.value })} className="px-3 py-2 bg-gray-50 border border-slate-600 text-gray-800 rounded-lg" />
            <span className="text-gray-500">至</span>
            <input type="date" value={dateRange.end} onChange={e => setDateRange({ ...dateRange, end: e.target.value })} className="px-3 py-2 bg-gray-50 border border-slate-600 text-gray-800 rounded-lg" />
          </div>
        </motion.div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-gray-700">
              <th className="px-4 py-3 text-left">项目</th>
              <th className="px-4 py-3 text-left">机械名称</th>
              <th className="px-4 py-3 text-left">使用日期</th>
              <th className="px-4 py-3 text-right">台班数</th>
              <th className="px-4 py-3 text-right">单价</th>
              <th className="px-4 py-3 text-right">总金额</th>
              <th className="px-4 py-3 text-center">确认表</th>
              <th className="px-4 py-3 text-left">操作人</th>
              <th className="px-4 py-3 text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredReports.map(r => (
              <tr key={r.id} className="border-t border-gray-200 text-gray-700 hover:bg-gray-50/50">
                <td className="px-4 py-3">{getProjectName(r.projectId)}</td>
                <td className="px-4 py-3 text-gray-800 font-medium">{mockEquipment.find(e => e.id === r.equipmentId)?.name}</td>
                <td className="px-4 py-3">{r.date}</td>
                <td className="px-4 py-3 text-right">{r.shiftCount}</td>
                <td className="px-4 py-3 text-right">¥{r.unitPrice}</td>
                <td className="px-4 py-3 text-right text-yellow-400">¥{r.total.toLocaleString()}</td>
                <td className="px-4 py-3 text-center">{r.attachments.length > 0 ? `${r.attachments.length}个` : '-'}</td>
                <td className="px-4 py-3">{r.operator}</td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={() => handleOpenModal(r)} className="p-2 text-blue-400 hover:bg-gray-500 rounded"><FaEdit /></button>
                    <button onClick={() => setShowDeleteConfirm(r.id)} className="p-2 text-red-400 hover:bg-gray-500 rounded"><FaTrash /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredReports.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 flex justify-end">
            <span className="text-gray-800 font-medium">合计: <span className="text-yellow-400">¥{totalAmount.toLocaleString()}</span></span>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={(e) => { e.stopPropagation(); }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl p-6 w-full max-w-lg border border-gray-200" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-gray-800">{editId ? '编辑上报' : '新增上报'}</h3>
                <button onClick={(e) => { e.stopPropagation(); }} className="text-gray-500 hover:text-gray-800"><FaTimes /></button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-500 text-sm mb-2">项目名称 *</label>
                    <SearchableSelect
                      required
                      allowEmpty={false}
                      value={formData.projectId}
                      onChange={v => setFormData({ ...formData, projectId: v })}
                      options={formProjectOptions}
                      placeholder="请选择"
                      {...PROJECT_SEARCH_PROPS}
                      metricsContext="page:equipment_report:form_project"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-500 text-sm mb-2">机械名称 *</label>
                    <SearchableSelect
                      required
                      allowEmpty={false}
                      value={formData.equipmentId}
                      onChange={v => setFormData({ ...formData, equipmentId: v })}
                      options={equipmentOptions}
                      placeholder="请选择"
                      searchPlaceholder="搜索机械…"
                      metricsContext="page:equipment_report:form_equipment"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-500 text-sm mb-2">使用日期 *</label>
                    <input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 text-gray-800 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-gray-500 text-sm mb-2">台班数量 *</label>
                    <input type="number" value={formData.shiftCount || ''} onChange={e => setFormData({ ...formData, shiftCount: Number(e.target.value) })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 text-gray-800 rounded-lg" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-500 text-sm mb-2">单价(元)</label>
                    <input type="number" value={formData.unitPrice || ''} onChange={e => setFormData({ ...formData, unitPrice: Number(e.target.value) })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 text-gray-800 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-gray-500 text-sm mb-2">总金额</label>
                    <div className="w-full px-4 py-2 bg-gray-500 text-gray-800 rounded-lg">¥{((formData.shiftCount ?? 0) * (formData.unitPrice ?? 0)).toLocaleString()}</div>
                  </div>
                </div>
                <div>
                  <label className="block text-gray-500 text-sm mb-2">台班确认表 (最多5张)</label>
                  <label className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg cursor-pointer hover:bg-gray-500 relative">
                    <FaFileUpload className="text-gray-500" />
                    <span className="text-gray-500 text-sm">上传附件</span>
                    <input type="file" multiple accept="image/*,.pdf" onChange={handleFileUpload} className="ui-file-input-overlay" data-file-upload-field="true" />
                  </label>
                  {formData.attachments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {formData.attachments.map((name, idx) => (
                        <span key={idx} className="text-xs bg-gray-500 px-2 py-1 rounded text-gray-700">{name}</span>
                      ))}
                    </div>
                  )}
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl p-6 w-full max-w-sm border border-gray-200">
              <h4 className="text-lg font-bold text-gray-800 mb-2">确认删除</h4>
              <p className="text-gray-500 mb-6">确定要删除该上报记录吗？</p>
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
