import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPlus, FaSearch, FaTrash, FaChartLine, FaFileUpload, FaTimes, FaFilter, FaCheckCircle } from 'react-icons/fa';
import { supabase } from '../../supabase/client';
import { SearchableSelect } from '../../components/ui';
import { projectSelectOptions } from '../../components/ui/options';

const mockProjects = [
  { id: '1', name: '星河湾小区工程' },
  { id: '2', name: '市政道路改造' },
  { id: '3', name: '商业综合体' },
];

const mockMaterials = [
  { id: '1', code: 'MAT001', name: '螺纹钢筋', spec: 'Φ12', unit: '吨', bidQty: 100, bidPrice: 4500, receivedQty: 60 },
  { id: '2', code: 'MAT002', name: '水泥', spec: '42.5', unit: '吨', bidQty: 200, bidPrice: 380, receivedQty: 120 },
  { id: '3', code: 'MAT003', name: '砂子', spec: '中粗', unit: 'm³', bidQty: 500, bidPrice: 120, receivedQty: 300 },
];

type InboundRecordRow = {
  id: string;
  date: string;
  materialName: string;
  spec: string;
  qty: number;
  price: number;
  attachments: string[];
};

const mockInboundRecords: InboundRecordRow[] = [
  { id: '1', date: '2024-03-15', materialName: '螺纹钢筋', spec: 'Φ12', qty: 30, price: 4450, attachments: [] },
  { id: '2', date: '2024-03-14', materialName: '水泥', spec: '42.5', qty: 50, price: 375, attachments: [] },
];

export default function MaterialInbound() {
  const [selectedProject, setSelectedProject] = useState('');
  const [searchText, setSearchText] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPriceDiffModal, setShowPriceDiffModal] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [deleteId, setDeleteId] = useState('');
  const [saving, setSaving] = useState(false);
  const [materials, setMaterials] = useState(mockMaterials);
  const [inboundRecords, setInboundRecords] = useState<InboundRecordRow[]>(mockInboundRecords);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});
  const [formData, setFormData] = useState({
    materialId: '',
    qty: null as number | null,
    price: null as number | null,
    date: new Date().toISOString().split('T')[0],
    remark: '',
    attachments: [] as string[],
  });

  const isSuperAdmin = () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.role === 'super_admin' || user.role_ids?.includes('super_admin');
  };

  const filteredMaterials = materials.filter(m =>
    m.name.includes(searchText) || m.code.includes(searchText)
  );

  const filteredRecords = inboundRecords.filter(r => {
    if (dateRange.start && r.date < dateRange.start) return false;
    if (dateRange.end && r.date > dateRange.end) return false;
    return true;
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const uploaded: string[] = [];
    for (let i = 0; i < Math.min(files.length, 5); i++) {
      const file = files[i];
      uploaded.push(file.name);
    }
    setFormData({ ...formData, attachments: [...formData.attachments, ...uploaded] });
  };

  const validateForm = () => {
    const errors: {[key: string]: string} = {};
    const material = materials.find(m => m.id === formData.materialId);
    
    if (!formData.materialId) errors.materialId = '请选择物料';
    if (!formData.qty || formData.qty <= 0) errors.qty = '请输入入库数量';
    if (!formData.price || formData.price <= 0) errors.price = '请输入采购单价';
    if (material && formData.qty && formData.qty > (material.bidQty - material.receivedQty)) {
      errors.qty = `入库数量不能超过剩余数量 ${material.bidQty - material.receivedQty}`;
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveInbound = async () => {
    if (!validateForm()) return;
    
    const material = materials.find(m => m.id === formData.materialId);
    if (!material || !formData.qty || !formData.price) return;
    
    setSaving(true);
    
    const newRecord = {
      id: String(Date.now()),
      date: formData.date,
      materialName: material.name,
      spec: material.spec,
      qty: formData.qty,
      price: formData.price,
      attachments: formData.attachments,
    };
    setInboundRecords([newRecord, ...inboundRecords]);
    setMaterials(materials.map(m => 
      m.id === material.id 
        ? { ...m, receivedQty: m.receivedQty + (formData.qty ?? 0) }
        : m
    ));
    
    setShowAddModal(false);
    setFormData({ materialId: '', qty: null, price: null, date: new Date().toISOString().split('T')[0], remark: '', attachments: [] as string[] });
    setFormErrors({});
    setSaving(false);
    
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 2000);
  };

  const handleDeleteClick = (id: string) => {
    setDeleteId(id);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    const record = inboundRecords.find(r => r.id === deleteId);
    if (record) {
      setMaterials(materials.map(m =>
        m.name === record.materialName
          ? { ...m, receivedQty: Math.max(0, m.receivedQty - record.qty) }
          : m
      ));
    }
    setInboundRecords(inboundRecords.filter(r => r.id !== deleteId));
    setShowDeleteConfirm(false);
    setDeleteId('');
    
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 2000);
  };

  const priceDiffData = materials.map(m => {
    const records = inboundRecords.filter(r => r.materialName === m.name);
    const avgPrice = records.length ? records.reduce((sum, r) => sum + r.price, 0) / records.length : m.bidPrice;
    return { ...m, avgPrice, diff: avgPrice - m.bidPrice };
  });

  const projectFilterOptions = useMemo(
    () => projectSelectOptions(mockProjects.map(p => ({ id: p.id, name: p.name })), '选择项目'),
    [],
  );

  const materialSelectOptions = useMemo(
    () =>
      filteredMaterials.map(m => ({
        value: m.id,
        label: `${m.code} - ${m.name} (剩余:${m.bidQty - m.receivedQty})`,
      })),
    [filteredMaterials],
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">物资入库</h2>
        <div className="flex gap-3">
          <button onClick={() => setShowPriceDiffModal(true)} className="flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-500 text-gray-800 rounded-lg transition-colors">
            <FaChartLine /> 价差分析
          </button>
          <button onClick={() => setShowAddModal(true)} disabled={!selectedProject} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-gray-800 rounded-lg disabled:opacity-50 transition-colors">
            <FaPlus /> 添加入库
          </button>
        </div>
      </div>

      <div className="flex gap-4 mb-6 items-center">
        <div className="min-w-[12rem]">
          <SearchableSelect
            value={selectedProject}
            onChange={setSelectedProject}
            options={projectFilterOptions}
            placeholder="选择项目"
            emptyLabel="选择项目"
            searchPlaceholder="搜索项目…"
            metricsContext="page:material_inbound:filter_project"
          />
        </div>
        <div className="flex-1 relative">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input type="text" value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="搜索物料编码/名称" className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-slate-600 text-gray-800 rounded-lg" />
        </div>
        <button onClick={() => setShowFilter(!showFilter)} className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${showFilter ? 'bg-blue-600' : 'bg-gray-50'} text-gray-800`}>
          <FaFilter /> 筛选
        </button>
      </div>

      {showFilter && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mb-4 p-4 bg-gray-50/50 rounded-lg">
          <div className="flex items-center gap-4">
            <span className="text-gray-500">入库时间:</span>
            <input type="date" value={dateRange.start} onChange={e => setDateRange({ ...dateRange, start: e.target.value })} className="px-3 py-2 bg-gray-50 border border-slate-600 text-gray-800 rounded-lg" />
            <span className="text-gray-500">至</span>
            <input type="date" value={dateRange.end} onChange={e => setDateRange({ ...dateRange, end: e.target.value })} className="px-3 py-2 bg-gray-50 border border-slate-600 text-gray-800 rounded-lg" />
          </div>
        </motion.div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-gray-500 text-sm border-b border-gray-200">
              <th className="pb-3 font-medium">入库时间</th>
              <th className="pb-3 font-medium">物料名称</th>
              <th className="pb-3 font-medium">规格型号</th>
              <th className="pb-3 font-medium">入库数量</th>
              <th className="pb-3 font-medium">采购单价</th>
              <th className="pb-3 font-medium">小票附件</th>
              <th className="pb-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map(record => (
              <motion.tr key={record.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-b border-gray-200/50 text-gray-800 hover:bg-gray-50/30 transition-colors">
                <td className="py-4">{record.date}</td>
                <td className="py-4">{record.materialName}</td>
                <td className="py-4">{record.spec}</td>
                <td className="py-4">{record.qty}</td>
                <td className="py-4">¥{record.price}</td>
                <td className="py-4">{record.attachments.length > 0 ? `${record.attachments.length}个` : '-'}</td>
                <td className="py-4">
                  {isSuperAdmin() && <button onClick={() => handleDeleteClick(record.id)} className="text-red-400 hover:text-red-300 p-2 hover:bg-red-500/20 rounded-lg transition-colors"><FaTrash /></button>}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {showAddModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowAddModal(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white rounded-xl p-6 w-full max-w-lg border border-gray-200" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-gray-800">添加入库记录</h3>
                <button onClick={() => setShowAddModal(false)} className="text-gray-500 hover:text-gray-800"><FaTimes /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-500 text-sm mb-2">选择物料 *</label>
                  <SearchableSelect
                    value={formData.materialId}
                    onChange={v => {
                      setFormData({ ...formData, materialId: v });
                      setFormErrors({ ...formErrors, materialId: '' });
                    }}
                    options={materialSelectOptions}
                    placeholder="请选择物料"
                    emptyLabel="请选择物料"
                    searchPlaceholder="搜索物料…"
                    metricsContext="page:material_inbound:form_material"
                    className={formErrors.materialId ? 'ring-2 ring-red-500/40 rounded-lg' : ''}
                  />
                  {formErrors.materialId && <p className="text-red-400 text-xs mt-1">{formErrors.materialId}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-500 text-sm mb-2">入库数量 *</label>
                    <input type="number" value={formData.qty || ''} onChange={e => { setFormData({ ...formData, qty: Number(e.target.value) }); setFormErrors({ ...formErrors, qty: '' }); }} className={`w-full px-4 py-2 bg-gray-50 border rounded-lg text-gray-800 ${formErrors.qty ? 'border-red-500' : 'border-slate-600'}`} />
                    {formErrors.qty && <p className="text-red-400 text-xs mt-1">{formErrors.qty}</p>}
                  </div>
                  <div>
                    <label className="block text-gray-500 text-sm mb-2">采购单价 *</label>
                    <input type="number" value={formData.price || ''} onChange={e => { setFormData({ ...formData, price: Number(e.target.value) }); setFormErrors({ ...formErrors, price: '' }); }} className={`w-full px-4 py-2 bg-gray-50 border rounded-lg text-gray-800 ${formErrors.price ? 'border-red-500' : 'border-slate-600'}`} />
                    {formErrors.price && <p className="text-red-400 text-xs mt-1">{formErrors.price}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-500 text-sm mb-2">入库日期</label>
                    <input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 text-gray-800 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-gray-500 text-sm mb-2">进货小票 (最多5张)</label>
                    <label className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg cursor-pointer hover:bg-gray-500 transition-colors">
                      <FaFileUpload className="text-gray-500" />
                      <span className="text-gray-500 text-sm">上传附件</span>
                      <input type="file" multiple accept="image/*,.pdf" onChange={handleFileUpload} className="hidden" />
                    </label>
                    {formData.attachments.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {formData.attachments.map((name, idx) => (
                          <span key={idx} className="text-xs bg-gray-500 px-2 py-1 rounded text-gray-700">{name}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-gray-500 text-sm mb-2">备注</label>
                  <textarea value={formData.remark} onChange={e => setFormData({ ...formData, remark: e.target.value })} rows={2} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 text-gray-800 rounded-lg resize-none" />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setShowAddModal(false)} className="px-4 py-2 bg-gray-50 text-gray-800 rounded-lg hover:bg-gray-500 transition-colors">取消</button>
                <button onClick={handleSaveInbound} disabled={saving} className="px-4 py-2 bg-blue-600 text-gray-800 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2">
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPriceDiffModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowPriceDiffModal(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white rounded-xl p-6 w-full max-w-2xl border border-gray-200" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-gray-800">价差分析</h3>
                <button onClick={() => setShowPriceDiffModal(false)} className="text-gray-500 hover:text-gray-800"><FaTimes /></button>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="text-left text-gray-500 text-sm border-b border-gray-200">
                    <th className="pb-3">物料名称</th>
                    <th className="pb-3">投标单价</th>
                    <th className="pb-3">入库均价</th>
                    <th className="pb-3">价差</th>
                  </tr>
                </thead>
                <tbody>
                  {priceDiffData.map(item => (
                    <tr key={item.id} className="border-b border-gray-200/50 text-gray-800">
                      <td className="py-3">{item.name}</td>
                      <td className="py-3">¥{item.bidPrice}</td>
                      <td className="py-3">¥{item.avgPrice.toFixed(2)}</td>
                      <td className={`py-3 ${item.diff > 0 ? 'text-red-400' : 'text-green-400'}`}>{item.diff > 0 ? '+' : ''}¥{item.diff.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowDeleteConfirm(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white rounded-xl p-6 w-full max-w-sm border border-gray-200" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-gray-800 mb-4">确认删除</h3>
              <p className="text-gray-500 mb-6">确定要删除这条入库记录吗？删除后将恢复物料的剩余数量。</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 bg-gray-50 text-gray-800 rounded-lg hover:bg-gray-500 transition-colors">取消</button>
                <button onClick={handleConfirmDelete} className="px-4 py-2 bg-red-600 text-gray-800 rounded-lg hover:bg-red-700 transition-colors">确认删除</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSuccessToast && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="fixed bottom-6 right-6 bg-green-600 text-gray-800 px-6 py-3 rounded-lg flex items-center gap-2 shadow-lg z-50">
            <FaCheckCircle /> 操作成功
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
