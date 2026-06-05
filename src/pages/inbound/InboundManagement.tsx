import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  FaPlus, FaEdit, FaTrash, FaSearch, FaTimes, 
  FaChevronLeft, FaChevronRight, FaWarehouse,
  FaCheck
} from 'react-icons/fa';
import { supabase } from '../../supabase/client';
import type { MaterialInbound, InboundFormData, InboundItemForm } from './types';
import { inboundApi } from './api';

const PAGE_SIZE = 20;

const InboundManagement: React.FC = () => {
  // 列表状态
  const [inbounds, setInbounds] = useState<MaterialInbound[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  
  // 表单状态
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingInbound, setEditingInbound] = useState<MaterialInbound | null>(null);
  const [form, setForm] = useState<InboundFormData>({
    inbound_no: '',
    project_id: '',
    warehouse_id: '',
    supplier_id: '',
    inbound_date: new Date().toISOString().split('T')[0],
    items: [{ material_id: '', unit: '个', quantity: 1, price: 0, tax_rate: 0 }]
  });
  
  // 选项列表
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [materials, setMaterials] = useState<{ id: string; code: string; name: string; unit: string; default_price: number }[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<{ id: string; order_no: string; supplier_name: string }[]>([]);
  
  // 加载入库单列表
  const loadInbounds = async () => {
    setLoading(true);
    try {
      const result = await inboundApi.getInbounds({
        keyword: search,
        project_id: projectFilter || undefined,
        warehouse_id: '',
        status: statusFilter || undefined,
        page,
        page_size: PAGE_SIZE
      });
      setInbounds(result.data);
      setTotal(result.total);
    } catch (err) {
      console.error('加载入库单失败', err);
    } finally {
      setLoading(false);
    }
  };
  
  // 加载项目列表
  const loadProjects = async () => {
    const { data } = await supabase.from('projects').select('id, name');
    setProjects(data?.map(p => ({ id: p.id, name: p.name })) || []);
  };
  
  // 加载仓库列表
  const loadWarehouses = async () => {
    const { data } = await supabase.from('warehouses').select('id, name');
    setWarehouses(data?.map(w => ({ id: w.id, name: w.name })) || []);
  };
  
  // 加载供应商列表
  const loadSuppliers = async () => {
    const { data } = await supabase.from('party_b').select('id, name');
    setSuppliers(data?.map(s => ({ id: s.id, name: s.name })) || []);
  };
  
  // 加载物资列表
  const loadMaterials = async () => {
    const { data } = await supabase.from('materials').select('id, code, name, unit, default_price');
    setMaterials(data || []);
  };
  
  // 加载采购订单
  const loadPurchaseOrders = async (projectId?: string) => {
    try {
      const data = await inboundApi.getPurchaseOrders(projectId);
      setPurchaseOrders(data);
    } catch (err) {
      setPurchaseOrders([]);
    }
  };
  
  useEffect(() => {
    loadInbounds();
    loadProjects();
    loadWarehouses();
    loadSuppliers();
    loadMaterials();
  }, [page, search, statusFilter, projectFilter]);
  
  useEffect(() => {
    loadPurchaseOrders(form.project_id || undefined);
  }, [form.project_id]);
  
  // 搜索处理
  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };
  
  // 打开新增弹窗
  const openAdd = async () => {
    const inboundNo = await inboundApi.generateInboundNo();
    setEditingInbound(null);
    setForm({
      inbound_no: inboundNo,
      project_id: '',
      warehouse_id: '',
      supplier_id: '',
      inbound_date: new Date().toISOString().split('T')[0],
      items: [{ material_id: '', unit: '个', quantity: 1, price: 0, tax_rate: 0 }]
    });
    setPurchaseOrders([]);
    setShowFormModal(true);
  };
  
  // 打开编辑弹窗
  const openEdit = async (inbound: MaterialInbound) => {
    setEditingInbound(inbound);
    const items = await inboundApi.getInboundItems(inbound.id);
    
    setForm({
      inbound_no: inbound.inbound_no,
      order_id: inbound.order_id || undefined,
      project_id: inbound.project_id,
      warehouse_id: inbound.warehouse_id,
      supplier_id: inbound.supplier_id,
      inbound_date: inbound.inbound_date,
      remark: inbound.remark || undefined,
      items: items.map(item => ({
        id: item.id,
        material_id: item.material_id,
        material_name: item.material_name,
        specification: item.specification ?? undefined,
        unit: item.unit,
        quantity: item.quantity,
        price: item.price,
        tax_rate: item.tax_rate,
        remark: item.remark ?? undefined
      }))
    });
    
    loadPurchaseOrders(inbound.project_id);
    setShowFormModal(true);
  };
  
  // 添加明细行
  const addItem = () => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { material_id: '', unit: '个', quantity: 1, price: 0, tax_rate: 0 }]
    }));
  };
  
  // 删除明细行
  const removeItem = (index: number) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };
  
  // 更新明细项
  const updateItem = (index: number, field: keyof InboundItemForm, value: any) => {
    setForm(prev => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      
      if (field === 'material_id' && value) {
        const material = materials.find(m => m.id === value);
        if (material) {
          newItems[index] = {
            ...newItems[index],
            unit: material.unit,
            price: material.default_price || 0,
            material_name: material.name
          };
        }
      }
      
      return { ...prev, items: newItems };
    });
  };
  
  // 保存入库单
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.project_id) {
      alert('请选择项目');
      return;
    }
    
    if (!form.warehouse_id) {
      alert('请选择仓库');
      return;
    }
    
    if (!form.supplier_id) {
      alert('请选择供应商');
      return;
    }
    
    if (form.items.length === 0) {
      alert('请添加至少一条明细');
      return;
    }
    
    for (const item of form.items) {
      if (!item.material_id) {
        alert('请选择物资');
        return;
      }
      if (!item.quantity || item.quantity <= 0) {
        alert('数量必须大于0');
        return;
      }
      if (!item.price || item.price < 0) {
        alert('单价必须大于等于0');
        return;
      }
    }
    
    try {
      if (editingInbound) {
        await inboundApi.updateInbound(editingInbound.id, form);
        alert('更新成功');
      } else {
        await inboundApi.createInbound(form);
        alert('创建成功');
      }
      
      setShowFormModal(false);
      loadInbounds();
    } catch (err: any) {
      alert(err.message || '保存失败');
    }
  };
  
  // 删除入库单
  const handleDelete = async (id: string) => {
    if (confirm('确定要删除该入库单吗？')) {
      try {
        await inboundApi.deleteInbound(id);
        alert('删除成功');
        loadInbounds();
      } catch (err: any) {
        alert(err.message || '删除失败');
      }
    }
  };
  
  // 确认入库
  const handleConfirm = async (id: string) => {
    if (confirm('确定要确认入库吗？此操作将更新库存。')) {
      try {
        await inboundApi.confirmInbound(id);
        alert('入库确认成功');
        loadInbounds();
      } catch (err: any) {
        alert(err.message || '确认失败');
      }
    }
  };
  
  // 计算总金额
  const getTotalAmount = () => {
    return form.items.reduce((sum, item) => {
      return sum + (item.quantity * item.price * (1 + item.tax_rate / 100));
    }, 0);
  };
  
  const totalPages = Math.ceil(total / PAGE_SIZE);
  
  // 状态选项
  const statusOptions = [
    { value: 'draft', label: '草稿' },
    { value: 'confirmed', label: '已确认' },
    { value: 'cancelled', label: '已取消' }
  ];
  
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">入库管理</h1>
        <p className="text-gray-500 mt-1">管理物资入库单，跟踪库存更新</p>
      </div>
      
      {/* 工具栏 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="搜索入库单编号、供应商..."
              value={search}
              onChange={e => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
            />
          </div>
          
          <select
            value={projectFilter}
            onChange={e => { setProjectFilter(e.target.value); setPage(1); }}
            className="px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
          >
            <option value="">全部项目</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
          >
            <option value="">全部状态</option>
            {statusOptions.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg ml-auto"
          >
            <FaPlus /> 新增入库单
          </button>
        </div>
      </div>
      
      {/* 入库单列表 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        {loading ? (
          <div className="text-center text-gray-500 py-12">加载中...</div>
        ) : inbounds.length === 0 ? (
          <div className="text-center text-gray-500 py-12">暂无入库单</div>
        ) : (
          <div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 text-sm">
                  <th className="text-left py-3 px-4">入库单编号</th>
                  <th className="text-left py-3 px-4">项目</th>
                  <th className="text-left py-3 px-4">仓库</th>
                  <th className="text-left py-3 px-4">供应商</th>
                  <th className="text-right py-3 px-4">入库金额</th>
                  <th className="text-center py-3 px-4">状态</th>
                  <th className="text-center py-3 px-4">操作</th>
                </tr>
              </thead>
              <tbody>
                {inbounds.map(inbound => (
                  <motion.tr
                    key={inbound.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="border-b border-gray-200/50 hover:bg-gray-50/30"
                  >
                    <td className="py-3 px-4 text-gray-800 font-mono font-medium">{inbound.inbound_no}</td>
                    <td className="py-3 px-4 text-gray-700">
                      {projects.find(p => p.id === inbound.project_id)?.name || '-'}
                    </td>
                    <td className="py-3 px-4 text-gray-700">{inbound.warehouse_name || '-'}</td>
                    <td className="py-3 px-4 text-gray-700">{inbound.supplier_name || '-'}</td>
                    <td className="py-3 px-4 text-right text-gray-800 font-medium">
                      ¥{inbound.total_amount.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-1 rounded text-xs ${
                        inbound.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                        inbound.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {statusOptions.find(s => s.value === inbound.status)?.label || inbound.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEdit(inbound)}
                          className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg"
                        >
                          <FaEdit />
                        </button>
                        {inbound.status === 'draft' && (
                          <button
                            onClick={() => handleConfirm(inbound.id)}
                            className="p-2 text-green-400 hover:bg-green-500/20 rounded-lg"
                          >
                            <FaCheck />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(inbound.id)}
                          className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg"
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
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="p-2 bg-gray-50 rounded disabled:opacity-50"
                >
                  <FaChevronLeft className="w-3 h-3 text-gray-800" />
                </button>
                <span className="text-gray-500 text-sm">{page} / {totalPages}</span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages}
                  className="p-2 bg-gray-50 rounded disabled:opacity-50"
                >
                  <FaChevronRight className="w-3 h-3 text-gray-800" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* 入库单表单弹窗 */}
      {showFormModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowFormModal(false)}
        >
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-gray-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6 p-4 border-b">
              <h3 className="text-xl font-bold text-gray-800">
                {editingInbound ? '编辑入库单' : '新增入库单'}
              </h3>
              <button onClick={() => setShowFormModal(false)} className="text-gray-500 hover:text-gray-800">
                <FaTimes />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-4 space-y-6">
              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-2">入库单编号 *</label>
                  <input
                    type="text"
                    required
                    value={form.inbound_no}
                    onChange={e => setForm(prev => ({ ...prev, inbound_no: e.target.value }))}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">入库日期 *</label>
                  <input
                    type="date"
                    required
                    value={form.inbound_date}
                    onChange={e => setForm(prev => ({ ...prev, inbound_date: e.target.value }))}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-2">项目 *</label>
                  <select
                    required
                    value={form.project_id}
                    onChange={e => setForm(prev => ({ ...prev, project_id: e.target.value }))}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  >
                    <option value="">选择项目</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">仓库 *</label>
                  <select
                    required
                    value={form.warehouse_id}
                    onChange={e => setForm(prev => ({ ...prev, warehouse_id: e.target.value }))}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  >
                    <option value="">选择仓库</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-2">供应商 *</label>
                  <select
                    required
                    value={form.supplier_id}
                    onChange={e => setForm(prev => ({ ...prev, supplier_id: e.target.value }))}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  >
                    <option value="">选择供应商</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">关联采购订单</label>
                  <select
                    value={form.order_id || ''}
                    onChange={e => setForm(prev => ({ ...prev, order_id: e.target.value || undefined }))}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  >
                    <option value="">选择采购订单</option>
                    {purchaseOrders.map(o => (
                      <option key={o.id} value={o.id}>
                        {o.order_no} - {o.supplier_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* 明细列表 */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-sm text-gray-500">入库明细</label>
                  <button
                    type="button"
                    onClick={addItem}
                    className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-600 rounded-lg text-sm"
                  >
                    <FaPlus /> 添加明细
                  </button>
                </div>
                
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left py-2 px-3 text-sm text-gray-600 w-1/4">物资</th>
                        <th className="text-right py-2 px-3 text-sm text-gray-600 w-12">数量</th>
                        <th className="text-right py-2 px-3 text-sm text-gray-600 w-16">单位</th>
                        <th className="text-right py-2 px-3 text-sm text-gray-600 w-20">单价</th>
                        <th className="text-right py-2 px-3 text-sm text-gray-600 w-16">税率%</th>
                        <th className="text-right py-2 px-3 text-sm text-gray-600 w-20">金额</th>
                        <th className="text-center py-2 px-3 text-sm text-gray-600 w-12">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.items.map((item, index) => (
                        <tr key={index} className="border-t border-gray-200">
                          <td className="py-2 px-3">
                            <select
                              value={item.material_id}
                              onChange={e => updateItem(index, 'material_id', e.target.value)}
                              className="w-full px-2 py-1 bg-gray-50 border border-slate-600 rounded text-sm"
                            >
                              <option value="">选择物资</option>
                              {materials.map(m => (
                                <option key={m.id} value={m.id}>
                                  {m.code} - {m.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.quantity}
                              onChange={e => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                              className="w-full text-right px-2 py-1 bg-gray-50 border border-slate-600 rounded text-sm"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={item.unit}
                              onChange={e => updateItem(index, 'unit', e.target.value)}
                              className="w-full text-center px-2 py-1 bg-gray-50 border border-slate-600 rounded text-sm"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.price}
                              onChange={e => updateItem(index, 'price', parseFloat(e.target.value) || 0)}
                              className="w-full text-right px-2 py-1 bg-gray-50 border border-slate-600 rounded text-sm"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              value={item.tax_rate}
                              onChange={e => updateItem(index, 'tax_rate', parseFloat(e.target.value) || 0)}
                              className="w-full text-right px-2 py-1 bg-gray-50 border border-slate-600 rounded text-sm"
                            />
                          </td>
                          <td className="py-2 px-3 text-right font-medium">
                            ¥{(item.quantity * item.price * (1 + item.tax_rate / 100)).toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => removeItem(index)}
                              className="text-red-400 hover:text-red-600"
                            >
                              <FaTrash />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {/* 入库总金额 */}
              <div className="flex justify-end items-center">
                <span className="text-gray-500 mr-2">入库总金额：</span>
                <span className="text-xl font-bold text-blue-600">¥{getTotalAmount().toLocaleString()}</span>
              </div>
              
              {/* 备注 */}
              <div>
                <label className="block text-sm text-gray-500 mb-2">备注</label>
                <textarea
                  value={form.remark || ''}
                  onChange={e => setForm(prev => ({ ...prev, remark: e.target.value || undefined }))}
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                />
              </div>
              
              {/* 提交按钮 */}
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
                  {editingInbound ? '更新入库单' : '创建入库单'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default InboundManagement;
