import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaQrcode, 
  FaBox, 
  FaFileAlt, 
  FaArrowLeft, 
  FaCheck, 
  FaSearch,
  FaPlus,
  FaMinus,
  FaTimes,
  FaExclamationCircle
} from 'react-icons/fa';
import { supabase } from '../../supabase/client';

type ScanMode = 'inbound' | 'issue';
type ScanState = 'idle' | 'scanning' | 'success' | 'error';

interface ScanResult {
  type: 'material' | 'order' | 'asset';
  data: any;
}

interface InboundItem {
  material_id: string;
  name: string;
  code: string;
  unit: string;
  quantity: number;
  price: number;
}

interface IssueItem {
  material_id: string;
  name: string;
  code: string;
  unit: string;
  quantity: number;
  price: number;
  stock: number;
}

const MobileScanPage: React.FC = () => {
  const [scanMode, setScanMode] = useState<ScanMode>('inbound');
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState('');
  
  // 入库相关状态
  const [inboundItems, setInboundItems] = useState<InboundItem[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  
  // 领料相关状态
  const [issueItems, setIssueItems] = useState<IssueItem[]>([]);
  const [issueProject, setIssueProject] = useState('');
  const [issueWarehouse, setIssueWarehouse] = useState('');
  
  // 选项列表
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [materials, setMaterials] = useState<{ id: string; code: string; name: string; unit: string; default_price: number }[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  
  // 加载数据
  useEffect(() => {
    loadProjects();
    loadWarehouses();
    loadSuppliers();
    loadMaterials();
  }, []);
  
  useEffect(() => {
    if (issueWarehouse) {
      loadStock(issueWarehouse);
    }
  }, [issueWarehouse]);
  
  const loadProjects = async () => {
    const { data } = await supabase.from('projects').select('id, name');
    setProjects(data?.map(p => ({ id: p.id, name: p.name })) || []);
  };
  
  const loadWarehouses = async () => {
    const { data } = await supabase.from('warehouses').select('id, name');
    setWarehouses(data?.map(w => ({ id: w.id, name: w.name })) || []);
  };
  
  const loadSuppliers = async () => {
    const { data } = await supabase.from('party_b').select('id, name');
    setSuppliers(data?.map(s => ({ id: s.id, name: s.name })) || []);
  };
  
  const loadMaterials = async () => {
    const { data } = await supabase.from('materials').select('id, code, name, unit, default_price');
    setMaterials(data || []);
  };
  
  const loadStock = async (warehouseId: string) => {
    const { data } = await supabase
      .from('warehouse_stocks')
      .select('material_id, stock')
      .eq('warehouse_id', warehouseId);
    
    const map: Record<string, number> = {};
    data?.forEach(s => {
      map[s.material_id] = s.stock;
    });
    setStockMap(map);
  };
  
  // 模拟扫码
  const handleScan = () => {
    setScanState('scanning');
    setScanError('');
    
    setTimeout(() => {
      const randomIndex = Math.floor(Math.random() * materials.length);
      const material = materials[randomIndex];
      
      if (material) {
        setScanResult({
          type: 'material',
          data: material
        });
        setScanState('success');
        
        if (scanMode === 'inbound') {
          addInboundItem(material);
        } else {
          addIssueItem(material);
        }
      } else {
        setScanError('未识别到物资');
        setScanState('error');
      }
    }, 1500);
  };
  
  // 添加入库物资
  const addInboundItem = (material: typeof materials[0]) => {
    const existing = inboundItems.find(item => item.material_id === material.id);
    if (existing) {
      setInboundItems(prev => prev.map(item => 
        item.material_id === material.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setInboundItems(prev => [...prev, {
        material_id: material.id,
        name: material.name,
        code: material.code,
        unit: material.unit,
        quantity: 1,
        price: material.default_price || 0
      }]);
    }
  };
  
  // 添加领料物资
  const addIssueItem = (material: typeof materials[0]) => {
    const stock = stockMap[material.id] || 0;
    const existing = issueItems.find(item => item.material_id === material.id);
    
    if (existing) {
      if (existing.quantity < stock) {
        setIssueItems(prev => prev.map(item => 
          item.material_id === material.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        ));
      } else {
        setScanError('库存不足');
        setScanState('error');
      }
    } else {
      if (stock > 0) {
        setIssueItems(prev => [...prev, {
          material_id: material.id,
          name: material.name,
          code: material.code,
          unit: material.unit,
          quantity: 1,
          price: 0,
          stock
        }]);
      } else {
        setScanError('该物资库存为0');
        setScanState('error');
      }
    }
  };
  
  // 更新数量
  const updateInboundQuantity = (index: number, delta: number) => {
    setInboundItems(prev => prev.map((item, i) => 
      i === index 
        ? { ...item, quantity: Math.max(1, item.quantity + delta) }
        : item
    ));
  };
  
  const updateIssueQuantity = (index: number, delta: number) => {
    setIssueItems(prev => prev.map((item, i) => {
      if (i === index) {
        const newQty = Math.max(1, Math.min(item.stock, item.quantity + delta));
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };
  
  // 删除项目
  const removeInboundItem = (index: number) => {
    setInboundItems(prev => prev.filter((_, i) => i !== index));
  };
  
  const removeIssueItem = (index: number) => {
    setIssueItems(prev => prev.filter((_, i) => i !== index));
  };
  
  // 提交入库
  const submitInbound = async () => {
    if (!selectedProject) {
      alert('请选择项目');
      return;
    }
    if (!selectedWarehouse) {
      alert('请选择仓库');
      return;
    }
    if (!selectedSupplier) {
      alert('请选择供应商');
      return;
    }
    if (inboundItems.length === 0) {
      alert('请扫码添加物资');
      return;
    }
    
    try {
      const totalAmount = inboundItems.reduce((sum, item) => sum + item.quantity * item.price, 0);
      
      const { data: inbound } = await supabase
        .from('material_inbounds')
        .insert({
          inbound_no: generateInboundNo(),
          project_id: selectedProject,
          warehouse_id: selectedWarehouse,
          supplier_id: selectedSupplier,
          inbound_date: new Date().toISOString().split('T')[0],
          total_amount: totalAmount
        })
        .select()
        .single();
      
      const itemsData = inboundItems.map(item => ({
        inbound_id: inbound.id,
        material_id: item.material_id,
        unit: item.unit,
        quantity: item.quantity,
        price: item.price,
        tax_rate: 0
      }));
      
      await supabase.from('material_inbound_items').insert(itemsData);
      
      for (const item of inboundItems) {
        await supabase.rpc('update_material_stock', {
          p_material_id: item.material_id,
          p_quantity: item.quantity,
          p_warehouse_id: selectedWarehouse
        });
      }
      
      alert('入库成功');
      setInboundItems([]);
      setSelectedProject('');
      setSelectedWarehouse('');
      setSelectedSupplier('');
    } catch (err: any) {
      alert(err.message || '入库失败');
    }
  };
  
  // 提交领料
  const submitIssue = async () => {
    if (!issueProject) {
      alert('请选择项目');
      return;
    }
    if (!issueWarehouse) {
      alert('请选择仓库');
      return;
    }
    if (issueItems.length === 0) {
      alert('请扫码添加物资');
      return;
    }
    
    try {
      const totalAmount = issueItems.reduce((sum, item) => sum + item.quantity * item.price, 0);
      
      const { data: issue } = await supabase
        .from('material_issues')
        .insert({
          issue_no: generateIssueNo(),
          project_id: issueProject,
          warehouse_id: issueWarehouse,
          issue_date: new Date().toISOString().split('T')[0],
          total_amount: totalAmount
        })
        .select()
        .single();
      
      const itemsData = issueItems.map(item => ({
        issue_id: issue.id,
        material_id: item.material_id,
        unit: item.unit,
        quantity: item.quantity,
        price: item.price,
        tax_rate: 0
      }));
      
      await supabase.from('material_issue_items').insert(itemsData);
      
      for (const item of issueItems) {
        await supabase.rpc('update_material_stock', {
          p_material_id: item.material_id,
          p_quantity: -item.quantity,
          p_warehouse_id: issueWarehouse
        });
      }
      
      await supabase.from('project_costs').insert({
        project_id: issueProject,
        cost_type: 'material',
        amount: totalAmount,
        source_id: issue.id,
        source_type: 'issue'
      });
      
      alert('领料成功');
      setIssueItems([]);
      setIssueProject('');
      setIssueWarehouse('');
    } catch (err: any) {
      alert(err.message || '领料失败');
    }
  };
  
  // 生成编号
  const generateInboundNo = () => {
    const now = new Date();
    return `IN${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${Date.now().toString().slice(-4)}`;
  };
  
  const generateIssueNo = () => {
    const now = new Date();
    return `OU${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${Date.now().toString().slice(-4)}`;
  };
  
  // 计算总价
  const getInboundTotal = () => {
    return inboundItems.reduce((sum, item) => sum + item.quantity * item.price, 0);
  };
  
  const getIssueTotal = () => {
    return issueItems.reduce((sum, item) => sum + item.quantity * item.price, 0);
  };
  
  return (
    <div className="min-h-screen bg-gray-100">
      {/* 顶部导航 */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <button className="p-2 hover:bg-gray-100 rounded-lg">
            <FaArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <h1 className="text-lg font-bold text-gray-800">扫码{scanMode === 'inbound' ? '入库' : '领料'}</h1>
          <div className="w-10" />
        </div>
        
        {/* 模式切换 */}
        <div className="flex border-t border-gray-200">
          <button
            onClick={() => { setScanMode('inbound'); setInboundItems([]); }}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              scanMode === 'inbound' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-500'
            }`}
          >
            <FaBox className="inline-block mr-1" />
            入库
          </button>
          <button
            onClick={() => { setScanMode('issue'); setIssueItems([]); }}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              scanMode === 'issue' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-500'
            }`}
          >
            <FaFileAlt className="inline-block mr-1" />
            领料
          </button>
        </div>
      </header>
      
      <main className="p-4">
        {/* 入库模式 */}
        {scanMode === 'inbound' && (
          <div className="space-y-4">
            {/* 选择项目 */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <label className="block text-sm font-medium text-gray-700 mb-2">选择项目 *</label>
              <select
                value={selectedProject}
                onChange={e => setSelectedProject(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-800"
              >
                <option value="">请选择项目</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            
            {/* 选择仓库 */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <label className="block text-sm font-medium text-gray-700 mb-2">选择仓库 *</label>
              <select
                value={selectedWarehouse}
                onChange={e => setSelectedWarehouse(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-800"
              >
                <option value="">请选择仓库</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            
            {/* 选择供应商 */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <label className="block text-sm font-medium text-gray-700 mb-2">选择供应商 *</label>
              <select
                value={selectedSupplier}
                onChange={e => setSelectedSupplier(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-800"
              >
                <option value="">请选择供应商</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}
        
        {/* 领料模式 */}
        {scanMode === 'issue' && (
          <div className="space-y-4">
            {/* 选择项目 */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <label className="block text-sm font-medium text-gray-700 mb-2">选择项目 *</label>
              <select
                value={issueProject}
                onChange={e => setIssueProject(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-800"
              >
                <option value="">请选择项目</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            
            {/* 选择仓库 */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <label className="block text-sm font-medium text-gray-700 mb-2">选择仓库 *</label>
              <select
                value={issueWarehouse}
                onChange={e => setIssueWarehouse(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-800"
              >
                <option value="">请选择仓库</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}
        
        {/* 扫码区域 */}
        <div className="bg-white rounded-xl p-4 shadow-sm mt-4">
          <button
            onClick={handleScan}
            disabled={scanState === 'scanning'}
            className={`w-full py-8 rounded-xl border-2 border-dashed flex flex-col items-center justify-center transition-colors ${
              scanState === 'scanning' 
                ? 'border-blue-400 bg-blue-50' 
                : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
            }`}
          >
            <AnimatePresence mode="wait">
              {scanState === 'idle' && (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                >
                  <FaQrcode className="w-16 h-16 text-gray-400 mb-3" />
                  <span className="text-gray-600">点击扫码</span>
                </motion.div>
              )}
              
              {scanState === 'scanning' && (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                >
                  <div className="w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mb-3" />
                  <span className="text-blue-600">扫描中...</span>
                </motion.div>
              )}
              
              {scanState === 'success' && (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-3">
                    <FaCheck className="w-8 h-8 text-green-600" />
                  </div>
                  <span className="text-green-600">扫码成功</span>
                </motion.div>
              )}
              
              {scanState === 'error' && (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                >
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-3">
                    <FaExclamationCircle className="w-8 h-8 text-red-600" />
                  </div>
                  <span className="text-red-600">{scanError}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </button>
          
          {scanState === 'success' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-3 bg-green-50 rounded-lg"
            >
              <p className="text-green-700 text-sm">
                已添加: {scanResult?.data.code} - {scanResult?.data.name}
              </p>
            </motion.div>
          )}
        </div>
        
        {/* 物资列表 */}
        <div className="bg-white rounded-xl p-4 shadow-sm mt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-800">物资清单</h3>
            {scanMode === 'inbound' ? (
              <span className="text-sm text-gray-500">共 {inboundItems.length} 种</span>
            ) : (
              <span className="text-sm text-gray-500">共 {issueItems.length} 种</span>
            )}
          </div>
          
          {scanMode === 'inbound' && inboundItems.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <FaBox className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>暂无物资，扫码添加</p>
            </div>
          )}
          
          {scanMode === 'issue' && issueItems.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <FaFileAlt className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>暂无物资，扫码添加</p>
            </div>
          )}
          
          {/* 入库物资列表 */}
          {scanMode === 'inbound' && inboundItems.length > 0 && (
            <div className="space-y-3">
              {inboundItems.map((item, index) => (
                <motion.div
                  key={item.material_id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{item.code} - {item.name}</p>
                    <p className="text-sm text-gray-500">¥{item.price}/{item.unit}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateInboundQuantity(index, -1)}
                      className="w-8 h-8 bg-white border border-gray-200 rounded-full flex items-center justify-center hover:bg-gray-100"
                    >
                      <FaMinus className="w-4 h-4 text-gray-600" />
                    </button>
                    <span className="w-8 text-center font-medium">{item.quantity}</span>
                    <button
                      onClick={() => updateInboundQuantity(index, 1)}
                      className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center hover:bg-blue-600"
                    >
                      <FaPlus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => removeInboundItem(index)}
                      className="w-8 h-8 text-gray-400 hover:text-red-500"
                    >
                      <FaTimes className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
              
              <div className="border-t border-gray-200 pt-3 mt-3 flex justify-between items-center">
                <span className="text-gray-600">合计金额</span>
                <span className="text-xl font-bold text-blue-600">¥{getInboundTotal().toFixed(2)}</span>
              </div>
            </div>
          )}
          
          {/* 领料物资列表 */}
          {scanMode === 'issue' && issueItems.length > 0 && (
            <div className="space-y-3">
              {issueItems.map((item, index) => (
                <motion.div
                  key={item.material_id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{item.code} - {item.name}</p>
                    <p className="text-sm text-gray-500">库存: {item.stock}{item.unit}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateIssueQuantity(index, -1)}
                      className="w-8 h-8 bg-white border border-gray-200 rounded-full flex items-center justify-center hover:bg-gray-100"
                    >
                      <FaMinus className="w-4 h-4 text-gray-600" />
                    </button>
                    <span className="w-8 text-center font-medium">{item.quantity}</span>
                    <button
                      onClick={() => updateIssueQuantity(index, 1)}
                      disabled={item.quantity >= item.stock}
                      className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center hover:bg-blue-600 disabled:opacity-50"
                    >
                      <FaPlus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => removeIssueItem(index)}
                      className="w-8 h-8 text-gray-400 hover:text-red-500"
                    >
                      <FaTimes className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
              
              <div className="border-t border-gray-200 pt-3 mt-3 flex justify-between items-center">
                <span className="text-gray-600">合计金额</span>
                <span className="text-xl font-bold text-blue-600">¥{getIssueTotal().toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
        
        {/* 提交按钮 */}
        <button
          onClick={scanMode === 'inbound' ? submitInbound : submitIssue}
          disabled={
            (scanMode === 'inbound' && (!selectedProject || !selectedWarehouse || !selectedSupplier || inboundItems.length === 0)) ||
            (scanMode === 'issue' && (!issueProject || !issueWarehouse || issueItems.length === 0))
          }
          className={`w-full py-4 rounded-xl font-medium text-white mt-4 transition-colors ${
            (scanMode === 'inbound' && (selectedProject && selectedWarehouse && selectedSupplier && inboundItems.length > 0)) ||
            (scanMode === 'issue' && (issueProject && issueWarehouse && issueItems.length > 0))
              ? 'bg-blue-600 hover:bg-blue-700'
              : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          {scanMode === 'inbound' ? '确认入库' : '确认领料'}
        </button>
      </main>
    </div>
  );
};

export default MobileScanPage;
