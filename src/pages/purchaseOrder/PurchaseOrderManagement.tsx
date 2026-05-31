import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaPlus, FaEdit, FaTrash, FaSearch, FaTimes, 
  FaChevronLeft, FaChevronRight, FaShoppingCart,
  FaUser
} from 'react-icons/fa';
import { supabase } from '../../supabase/client';
import { SegmentedControl } from '../../components/ui';
import type { PurchaseOrder, PurchaseOrderItem, PurchaseOrderFormData, PurchaseOrderItemForm } from './types';
import { purchaseOrderApi } from './api';

const PAGE_SIZE = 20;

const PurchaseOrderManagement: React.FC = () => {
  // 列表状态
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  
  // 表单状态
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null);
  const [orderItems, setOrderItems] = useState<PurchaseOrderItem[]>([]);
  const [form, setForm] = useState<PurchaseOrderFormData>({
    order_no: '',
    project_id: '',
    supplier_id: '',
    order_date: new Date().toISOString().split('T')[0],
    items: [{ material_id: '', quantity: 1, unit: '个', price: 0, tax_rate: 0 }]
  });
  
  // 选项列表
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [materials, setMaterials] = useState<{ id: string; code: string; name: string; unit: string; default_price: number }[]>([]);
  const [contracts, setContracts] = useState<{ id: string; contract_no: string; supplier_name: string }[]>([]);
  
  // 加载订单列表
  const loadOrders = async () => {
    setLoading(true);
    try {
      const result = await purchaseOrderApi.getOrders({
        keyword: search,
        project_id: projectFilter || undefined,
        status: statusFilter || undefined,
        page,
        page_size: PAGE_SIZE
      });
      setOrders(result.data);
      setTotal(result.total);
    } catch (err) {
      console.error('加载订单失败', err);
    } finally {
      setLoading(false);
    }
  };
  
  // 加载项目列表
  const loadProjects = async () => {
    const { data } = await supabase.from('projects').select('id, name');
    setProjects(data?.map(p => ({ id: p.id, name: p.name })) || []);
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
  
  // 当项目变化时加载合同
  const loadContracts = async (projectId: string) => {
    if (!projectId) {
      setContracts([]);
      return;
    }
    try {
      const data = await purchaseOrderApi.getProjectContracts(projectId);
      setContracts(data);
    } catch (err) {
      setContracts([]);
    }
  };
  
  // 加载订单明细
  const loadOrderItems = async (orderId: string) => {
    try {
      const items = await purchaseOrderApi.getOrderItems(orderId);
      setOrderItems(items);
    } catch (err) {
      setOrderItems([]);
    }
  };
  
  useEffect(() => {
    loadOrders();
    loadProjects();
    loadSuppliers();
    loadMaterials();
  }, [page, search, statusFilter, projectFilter]);
  
  useEffect(() => {
    loadContracts(form.project_id);
  }, [form.project_id]);
  
  // 搜索处理
  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };
  
  // 打开新增弹窗
  const openAdd = async () => {
    const orderNo = await purchaseOrderApi.generateOrderNo();
    setEditingOrder(null);
    setForm({
      order_no: orderNo,
      project_id: '',
      supplier_id: '',
      order_date: new Date().toISOString().split('T')[0],
      items: [{ material_id: '', quantity: 1, unit: '个', price: 0, tax_rate: 0 }]
    });
    setOrderItems([]);
    setShowFormModal(true);
  };
  
  // 打开编辑弹窗
  const openEdit = async (order: PurchaseOrder) => {
    setEditingOrder(order);
    const items = await purchaseOrderApi.getOrderItems(order.id);
    
    setForm({
      order_no: order.order_no,
      contract_id: order.contract_id || undefined,
      project_id: order.project_id,
      supplier_id: order.supplier_id,
      order_date: order.order_date,
      delivery_date: order.delivery_date || undefined,
      payment_terms: order.payment_terms || undefined,
      remark: order.remark || undefined,
      items: items.map(item => ({
        id: item.id,
        material_id: item.material_id,
        material_name: item.material_name,
        specification: item.specification,
        quantity: item.quantity,
        unit: item.unit,
        price: item.price,
        tax_rate: item.tax_rate,
        remark: item.remark ?? undefined
      }))
    });
    
    setOrderItems(items);
    loadContracts(order.project_id);
    setShowFormModal(true);
  };
  
  // 添加明细行
  const addItem = () => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { material_id: '', quantity: 1, unit: '个', price: 0, tax_rate: 0 }]
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
  const updateItem = (index: number, field: keyof PurchaseOrderItemForm, value: any) => {
    setForm(prev => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      
      // 当选择物资时自动填充单位和单价
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
  
  // 保存订单
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.project_id) {
      alert('请选择项目');
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
      if (editingOrder) {
        await purchaseOrderApi.updateOrder(editingOrder.id, form);
        alert('更新成功');
      } else {
        await purchaseOrderApi.createOrder(form);
        alert('创建成功');
      }
      
      setShowFormModal(false);
      loadOrders();
    } catch (err: any) {
      alert(err.message || '保存失败');
    }
  };
  
  // 删除订单
  const handleDelete = async (id: string) => {
    if (confirm('确定要删除该订单吗？')) {
      try {
        await purchaseOrderApi.deleteOrder(id);
        alert('删除成功');
        loadOrders();
      } catch (err: any) {
        alert(err.message || '删除失败');
      }
    }
  };
  
  // 计算订单总金额
  const getTotalAmount = () => {
    return form.items.reduce((sum, item) => {
      return sum + (item.quantity * item.price * (1 + item.tax_rate / 100));
    }, 0);
  };
  
  const totalPages = Math.ceil(total / PAGE_SIZE);
  
  // 状态选项
  const statusOptions = [
    { value: 'draft', label: '草稿' },
    { value: 'submitted', label: '已提交' },
    { value: 'approved', label: '已审批' },
    { value: 'partially_received', label: '部分入库' },
    { value: 'received', label: '已入库' },
    { value: 'cancelled', label: '已取消' }
  ];
  
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">采购订单管理</h1>
        <p className="text-gray-500 mt-1">管理采购订单的创建、审批和执行跟踪</p>
      </div>
      
      {/* 工具栏 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="搜索订单编号、供应商..."
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
            <FaPlus /> 新增订单
          </button>
        </div>
      </div>
      
      {/* 订单列表 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        {loading ? (
          <div className="text-center text-gray-500 py-12">加载中...</div>
        ) : orders.length === 0 ? (
          <div className="text-center text-gray-500 py-12">暂无订单</div>
        ) : (
          <div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 text-sm">
                  <th className="text-left py-3 px-4">订单编号</th>
                  <th className="text-left py-3 px-4">项目</th>
                  <th className="text-left py-3 px-4">供应商</th>
                  <th className="text-right py-3 px-4">订单金额</th>
                  <th className="text-center py-3 px-4">状态</th>
                  <th className="text-center py-3 px-4">操作</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => (
                  <motion.tr
                    key={order.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="border-b border-gray-200/50 hover:bg-gray-50/30"
                  >
                    <td className="py-3 px-4 text-gray-800 font-mono font-medium">{order.order_no}</td>
                    <td className="py-3 px-4 text-gray-700">
                      {projects.find(p => p.id === order.project_id)?.name || '-'}
                    </td>
                    <td className="py-3 px-4 text-gray-700">{order.supplier_name || '-'}</td>
                    <td className="py-3 px-4 text-right text-gray-800 font-medium">
                      ¥{order.total_amount.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-1 rounded text-xs ${
                        order.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                        order.status === 'submitted' ? 'bg-yellow-100 text-yellow-800' :
                        order.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                        order.status === 'partially_received' ? 'bg-orange-100 text-orange-800' :
                        order.status === 'received' ? 'bg-green-100 text-green-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {statusOptions.find(s => s.value === order.status)?.label || order.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEdit(order)}
                          className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg"
                        >
                          <FaEdit />
                        </button>
                        <button
                          onClick={() => handleDelete(order.id)}
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
      
      {/* 订单表单弹窗 */}
      {showFormModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowFormModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
            className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-gray-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6 p-4 border-b">
              <h3 className="text-xl font-bold text-gray-800">
                {editingOrder ? '编辑采购订单' : '新增采购订单'}
              </h3>
              <button onClick={() => setShowFormModal(false)} className="text-gray-500 hover:text-gray-800">
                <FaTimes />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-4 space-y-6">
              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-2">订单编号 *</label>
                  <input
                    type="text"
                    required
                    value={form.order_no}
                    onChange={e => setForm(prev => ({ ...prev, order_no: e.target.value }))}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">订单日期 *</label>
                  <input
                    type="date"
                    required
                    value={form.order_date}
                    onChange={e => setForm(prev => ({ ...prev, order_date: e.target.value }))}
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
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-2">采购合同</label>
                  <select
                    value={form.contract_id || ''}
                    onChange={e => setForm(prev => ({ ...prev, contract_id: e.target.value || undefined }))}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  >
                    <option value="">选择合同</option>
                    {contracts.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.contract_no} - {c.supplier_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">预计交货日期</label>
                  <input
                    type="date"
                    value={form.delivery_date || ''}
                    onChange={e => setForm(prev => ({ ...prev, delivery_date: e.target.value || undefined }))}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-gray-500 mb-2">付款条件</label>
                <input
                  type="text"
                  value={form.payment_terms || ''}
                  onChange={e => setForm(prev => ({ ...prev, payment_terms: e.target.value || undefined }))}
                  placeholder="如: 货到付款"
                  className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                />
              </div>
              
              {/* 明细列表 */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-sm text-gray-500">订单明细</label>
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
              
              {/* 订单总金额 */}
              <div className="flex justify-end items-center">
                <span className="text-gray-500 mr-2">订单总金额：</span>
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
                  {editingOrder ? '更新订单' : '创建订单'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default PurchaseOrderManagement;
