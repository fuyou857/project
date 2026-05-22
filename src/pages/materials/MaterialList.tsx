import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaSearch, FaPlus, FaUpload, FaEdit, FaTrash, FaTimes, FaCheck } from 'react-icons/fa';
import { SearchableSelect } from '../../components/ui';
import { projectSelectOptions } from '../../components/ui/options';

const mockProjects = [
  { id: '1', name: '星河湾小区工程' },
  { id: '2', name: '市政道路改造' },
  { id: '3', name: '商业综合体' },
];

type MaterialRow = {
  id: string;
  code: string;
  name: string;
  spec: string;
  unit: string;
  bidQty: number;
  bidPrice: number;
  receivedQty: number;
};

const mockMaterials: MaterialRow[] = [
  { id: '1', code: 'MAT001', name: '螺纹钢筋', spec: 'Φ12mm', unit: '吨', bidQty: 100, bidPrice: 4500, receivedQty: 60 },
  { id: '2', code: 'MAT002', name: '水泥', spec: '42.5#', unit: '吨', bidQty: 200, bidPrice: 380, receivedQty: 150 },
  { id: '3', code: 'MAT003', name: '砂子', spec: '中粗', unit: 'm³', bidQty: 500, bidPrice: 120, receivedQty: 200 },
];

export default function MaterialList() {
  const [selectedProject, setSelectedProject] = useState('');
  const [searchText, setSearchText] = useState('');
  const [materials, setMaterials] = useState<MaterialRow[]>(mockMaterials);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [importData, setImportData] = useState<any[]>([]);
  const [newMaterial, setNewMaterial] = useState<{ code: string; name: string; spec: string; unit: string; bidQty: number | null; bidPrice: number }>({ code: '', name: '', spec: '', unit: '', bidQty: null, bidPrice: 0 });

  const isSuperAdmin = () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.role === 'super_admin' || user.role_ids?.includes('super_admin');
  };

  const projectOptions = useMemo(() => projectSelectOptions(mockProjects, '选择项目'), []);

  const filteredMaterials = materials.filter(m =>
    m.name.toLowerCase().includes(searchText.toLowerCase()) ||
    m.code.toLowerCase().includes(searchText.toLowerCase())
  );

  const handleImport = () => {
    if (!selectedProject) {
      alert('请先选择项目');
      return;
    }
    const mockData = [
      { code: 'MAT004', name: '木板', spec: '18mm', unit: '张', bidQty: 500, bidPrice: 85 },
      { code: 'MAT005', name: '油漆', spec: '白色', unit: '桶', bidQty: 100, bidPrice: 280 },
    ];
    setImportData(mockData);
    setShowImportModal(true);
  };

  const handleConfirmImport = () => {
    const newItems = importData.map((item, idx) => ({
      ...item,
      id: Date.now().toString() + idx,
      receivedQty: 0,
    }));
    setMaterials([...materials, ...newItems]);
    setShowImportModal(false);
    setImportData([]);
  };

  const handleAdd = () => {
    if (!newMaterial.code || !newMaterial.name) {
      alert('请填写物料编码和名称');
      return;
    }
    if (materials.some(m => m.code === newMaterial.code)) {
      alert('物料编码已存在');
      return;
    }
    const item: MaterialRow = { ...newMaterial, bidQty: newMaterial.bidQty ?? 0, id: Date.now().toString(), receivedQty: 0 };
    setMaterials([...materials, item]);
    setShowAddModal(false);
    setNewMaterial({ code: '', name: '', spec: '', unit: '', bidQty: null, bidPrice: 0 });
  };

  const handleDelete = (id: string) => {
    const material = materials.find(m => m.id === id);
    if (material && material.receivedQty > 0) {
      alert('该物料已有入库记录，无法删除');
      setShowDeleteConfirm(null);
      return;
    }
    setMaterials(materials.filter(m => m.id !== id));
    setShowDeleteConfirm(null);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-800">物资清单</h3>
        <div className="flex items-center gap-4">
          <div className="min-w-[12rem]">
            <SearchableSelect
              value={selectedProject}
              onChange={setSelectedProject}
              options={projectOptions}
              placeholder="选择项目"
              searchPlaceholder="搜索项目…"
            />
          </div>
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="搜索物料..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="bg-gray-50 text-gray-800 pl-10 pr-4 py-2 rounded-lg border border-slate-600 w-64"
            />
          </div>
          <button onClick={handleImport} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-gray-800 px-4 py-2 rounded-lg">
            <FaUpload /> 导入Excel
          </button>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-gray-800 px-4 py-2 rounded-lg">
            <FaPlus /> 手动添加
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-gray-700">
              <th className="px-4 py-3 text-left">物料编码</th>
              <th className="px-4 py-3 text-left">物料名称</th>
              <th className="px-4 py-3 text-left">规格型号</th>
              <th className="px-4 py-3 text-center">单位</th>
              <th className="px-4 py-3 text-right">投标数量</th>
              <th className="px-4 py-3 text-right">投标单价</th>
              <th className="px-4 py-3 text-right">预算合价</th>
              <th className="px-4 py-3 text-right">已入库</th>
              <th className="px-4 py-3 text-right">剩余采购量</th>
              <th className="px-4 py-3 text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredMaterials.map(m => (
              <tr key={m.id} className="border-t border-gray-200 text-gray-700 hover:bg-gray-50/50">
                <td className="px-4 py-3">{m.code}</td>
                <td className="px-4 py-3 text-gray-800 font-medium">{m.name}</td>
                <td className="px-4 py-3">{m.spec}</td>
                <td className="px-4 py-3 text-center">{m.unit}</td>
                <td className="px-4 py-3 text-right">{m.bidQty}</td>
                <td className="px-4 py-3 text-right">¥{m.bidPrice.toFixed(2)}</td>
                <td className="px-4 py-3 text-right text-yellow-400">¥{(m.bidQty * m.bidPrice).toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-green-400">{m.receivedQty}</td>
                <td className="px-4 py-3 text-right text-blue-400">{m.bidQty - m.receivedQty}</td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button className="p-2 text-blue-400 hover:bg-gray-500 rounded"><FaEdit /></button>
                    {isSuperAdmin() && <button onClick={() => setShowDeleteConfirm(m.id)} className="p-2 text-red-400 hover:bg-gray-500 rounded"><FaTrash /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {showImportModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white rounded-xl p-6 w-full max-w-2xl border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-bold text-gray-800">导入预览</h4>
                <button onClick={() => setShowImportModal(false)} className="text-gray-500 hover:text-gray-800"><FaTimes /></button>
              </div>
              <div className="max-h-80 overflow-y-auto mb-4">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 text-gray-700">
                      <th className="px-3 py-2 text-left">物料编码</th>
                      <th className="px-3 py-2 text-left">物料名称</th>
                      <th className="px-3 py-2 text-left">规格型号</th>
                      <th className="px-3 py-2 text-center">单位</th>
                      <th className="px-3 py-2 text-right">投标数量</th>
                      <th className="px-3 py-2 text-right">投标单价</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importData.map((item, idx) => (
                      <tr key={idx} className="border-t border-gray-200 text-gray-700">
                        <td className="px-3 py-2">{item.code}</td>
                        <td className="px-3 py-2 text-gray-800">{item.name}</td>
                        <td className="px-3 py-2">{item.spec}</td>
                        <td className="px-3 py-2 text-center">{item.unit}</td>
                        <td className="px-3 py-2 text-right">{item.bidQty}</td>
                        <td className="px-3 py-2 text-right">¥{item.bidPrice}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowImportModal(false)} className="px-4 py-2 text-gray-500 hover:text-gray-800">取消</button>
                <button onClick={handleConfirmImport} className="flex items-center gap-2 bg-blue-600 text-gray-800 px-4 py-2 rounded-lg"><FaCheck /> 确认导入</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAddModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white rounded-xl p-6 w-full max-w-md border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-bold text-gray-800">手动添加物料</h4>
                <button onClick={() => setShowAddModal(false)} className="text-gray-500 hover:text-gray-800"><FaTimes /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-500 mb-1">物料编码 *</label>
                  <input value={newMaterial.code} onChange={(e) => setNewMaterial({...newMaterial, code: e.target.value})} className="w-full bg-gray-50 text-gray-800 px-3 py-2 rounded-lg border border-slate-600" />
                </div>
                <div>
                  <label className="block text-gray-500 mb-1">物料名称 *</label>
                  <input value={newMaterial.name} onChange={(e) => setNewMaterial({...newMaterial, name: e.target.value})} className="w-full bg-gray-50 text-gray-800 px-3 py-2 rounded-lg border border-slate-600" />
                </div>
                <div>
                  <label className="block text-gray-500 mb-1">规格型号</label>
                  <input value={newMaterial.spec} onChange={(e) => setNewMaterial({...newMaterial, spec: e.target.value})} className="w-full bg-gray-50 text-gray-800 px-3 py-2 rounded-lg border border-slate-600" />
                </div>
                <div>
                  <label className="block text-gray-500 mb-1">单位</label>
                  <input value={newMaterial.unit} onChange={(e) => setNewMaterial({...newMaterial, unit: e.target.value})} className="w-full bg-gray-50 text-gray-800 px-3 py-2 rounded-lg border border-slate-600" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-500 mb-1">投标数量</label>
                    <input type="number" value={newMaterial.bidQty ?? ''} onChange={(e) => setNewMaterial({...newMaterial, bidQty: e.target.value === '' ? null : Number(e.target.value)})} className="w-full bg-gray-50 text-gray-800 px-3 py-2 rounded-lg border border-slate-600" />
                  </div>
                  <div>
                    <label className="block text-gray-500 mb-1">投标单价</label>
                    <input type="number" value={newMaterial.bidPrice} onChange={(e) => setNewMaterial({...newMaterial, bidPrice: Number(e.target.value)})} className="w-full bg-gray-50 text-gray-800 px-3 py-2 rounded-lg border border-slate-600" />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-gray-500 hover:text-gray-800">取消</button>
                <button onClick={handleAdd} className="flex items-center gap-2 bg-green-600 text-gray-800 px-4 py-2 rounded-lg"><FaPlus /> 保存</button>
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
              <p className="text-gray-500 mb-6">确定要删除该物料吗？此操作不可恢复。</p>
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
