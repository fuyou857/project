import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  FaBox, FaLayerGroup, FaPlus, FaEdit, FaTrash, 
  FaSearch, FaTimes, FaChevronLeft, FaChevronRight
} from 'react-icons/fa';
import { supabase } from '../../supabase/client';
import { SegmentedControl, SearchableSelect } from '../../components/ui';
import type { Material, MaterialCategory } from './types';

type TabType = 'list' | 'category';

const PAGE_SIZE = 20;

const MaterialManagement: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('list');
  
  // 列表状态
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  
  // 分类状态
  const [categories, setCategories] = useState<MaterialCategory[]>([]);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MaterialCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState({ code: '', name: '', sort_order: 0 });
  
  // 表单状态
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [form, setForm] = useState({
    code: '',
    name: '',
    specification: '',
    unit: '个',
    category_id: '',
    default_price: '',
    min_stock: '0',
    status: 'active',
    remark: ''
  });
  
  // 加载物资列表
  const loadMaterials = async () => {
    setLoading(true);
    try {
      const offset = (page - 1) * PAGE_SIZE;
      let query = supabase
        .from('materials')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
      
      if (search) {
        query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%,specification.ilike.%${search}%`);
      }
      
      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }
      
      if (categoryFilter) {
        query = query.eq('category_id', categoryFilter);
      }
      
      const res = await query;
      if (res.data) {
        setMaterials(res.data);
      }
      if (res.count !== undefined && res.count !== null) {
        setTotal(res.count);
      }
    } catch (err) {
      console.error('加载物资列表失败', err);
    } finally {
      setLoading(false);
    }
  };
  
  // 加载分类
  const loadCategories = async () => {
    setCategoryLoading(true);
    try {
      const { data } = await supabase
        .from('material_categories')
        .select('*')
        .order('sort_order', { ascending: true });
      setCategories(data || []);
    } catch (err) {
      console.error('加载分类失败', err);
    } finally {
      setCategoryLoading(false);
    }
  };
  
  // 生成编码
  const generateCode = async () => {
    const { data } = await supabase
      .from('materials')
      .select('code')
      .order('code', { ascending: false })
      .limit(1);
    
    let maxNum = 0;
    if (data && data.length > 0 && data[0].code) {
      const numStr = data[0].code.replace('MAT', '').replace(/^0*/, '') || '0';
      maxNum = parseInt(numStr, 10) || 0;
    }
    
    setForm(prev => ({ ...prev, code: `MAT${(maxNum + 1).toString().padStart(6, '0')}` }));
  };
  
  useEffect(() => {
    loadMaterials();
    loadCategories();
  }, [page, search, statusFilter, categoryFilter]);
  
  // 搜索处理
  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };
  
  // 打开新增物资弹窗
  const openAdd = () => {
    setEditingMaterial(null);
    setForm({
      code: '',
      name: '',
      specification: '',
      unit: '个',
      category_id: '',
      default_price: '',
      min_stock: '0',
      status: 'active',
      remark: ''
    });
    generateCode();
    setShowFormModal(true);
  };
  
  // 打开编辑物资弹窗
  const openEdit = (item: Material) => {
    setEditingMaterial(item);
    setForm({
      code: item.code,
      name: item.name,
      specification: item.specification || '',
      unit: item.unit,
      category_id: item.category_id || '',
      default_price: item.default_price?.toString() || '',
      min_stock: item.min_stock?.toString() || '0',
      status: item.status,
      remark: item.remark || ''
    });
    setShowFormModal(true);
  };
  
  // 保存物资
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.code.trim()) {
      alert('请输入物资编码');
      return;
    }
    if (!form.name.trim()) {
      alert('请输入物资名称');
      return;
    }
    
    const data = {
      code: form.code,
      name: form.name,
      specification: form.specification || null,
      unit: form.unit,
      category_id: form.category_id || null,
      default_price: form.default_price ? parseFloat(form.default_price) : null,
      min_stock: form.min_stock ? parseFloat(form.min_stock) : 0,
      status: form.status,
      remark: form.remark || null
    };
    
    if (editingMaterial) {
      await supabase.from('materials').update(data).eq('id', editingMaterial.id);
    } else {
      await supabase.from('materials').insert(data);
    }
    
    setShowFormModal(false);
    loadMaterials();
  };
  
  // 删除物资
  const handleDelete = async (id: string) => {
    if (confirm('确定要删除该物资吗？')) {
      await supabase.from('materials').delete().eq('id', id);
      loadMaterials();
    }
  };
  
  // 保存分类
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!categoryForm.name.trim()) {
      alert('请输入分类名称');
      return;
    }
    
    const data = {
      code: categoryForm.code || null,
      name: categoryForm.name,
      sort_order: categoryForm.sort_order
    };
    
    if (editingCategory) {
      await supabase.from('material_categories').update(data).eq('id', editingCategory.id);
    } else {
      await supabase.from('material_categories').insert(data);
    }
    
    setShowCategoryModal(false);
    setEditingCategory(null);
    setCategoryForm({ code: '', name: '', sort_order: 0 });
    loadCategories();
  };
  
  // 打开编辑分类弹窗
  const openEditCategory = (cat: MaterialCategory) => {
    setEditingCategory(cat);
    setCategoryForm({
      code: cat.code || '',
      name: cat.name,
      sort_order: cat.sort_order
    });
    setShowCategoryModal(true);
  };
  
  // 删除分类
  const handleDeleteCategory = async (id: string) => {
    if (confirm('确定要删除该分类吗？')) {
      await supabase.from('material_categories').delete().eq('id', id);
      loadCategories();
    }
  };
  
  const totalPages = Math.ceil(total / PAGE_SIZE);
  
  // 状态选项
  const statusOptions = [
    { value: 'active', label: '正常' },
    { value: 'inactive', label: '停用' },
    { value: 'discontinued', label: '淘汰' }
  ];
  
  // 单位选项
  const unitOptions = [
    '个', '件', '套', '台', '辆', '吨', '千克', '立方米', '平方米', '米', '卷', '张', '根', '箱', '袋', '桶', '升'
  ];
  
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">物资管理</h1>
        <p className="text-gray-500 mt-1">管理物资档案、分类和库存</p>
      </div>
      
      {/* 标签页 */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'list' 
              ? 'border-blue-500 text-blue-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('list')}
        >
          <FaBox className="inline mr-2" />
          物资档案
        </button>
        <button
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'category' 
              ? 'border-blue-500 text-blue-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('category')}
        >
          <FaLayerGroup className="inline mr-2" />
          物资分类
        </button>
      </div>
      
      {/* 物资档案列表 */}
      {activeTab === 'list' && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          {/* 工具栏 */}
          <div className="mb-4 flex flex-wrap items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="搜索物资名称、编码、规格..."
                value={search}
                onChange={e => handleSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
              />
            </div>
            
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
            >
              <option value="">全部状态</option>
              <option value="active">正常</option>
              <option value="inactive">停用</option>
              <option value="discontinued">淘汰</option>
            </select>
            
            <select
              value={categoryFilter}
              onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}
              className="px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
            >
              <option value="">全部分类</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            
            <button
              onClick={openAdd}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg ml-auto"
            >
              <FaPlus /> 新增物资
            </button>
          </div>
          
          {/* 列表 */}
          {loading ? (
            <div className="text-center text-gray-500 py-12">加载中...</div>
          ) : materials.length === 0 ? (
            <div className="text-center text-gray-500 py-12">暂无数据</div>
          ) : (
            <div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500 text-sm">
                    <th className="text-left py-3 px-4">编码</th>
                    <th className="text-left py-3 px-4">名称</th>
                    <th className="text-left py-3 px-4">规格</th>
                    <th className="text-left py-3 px-4">单位</th>
                    <th className="text-right py-3 px-4">单价</th>
                    <th className="text-right py-3 px-4">库存</th>
                    <th className="text-center py-3 px-4">状态</th>
                    <th className="text-center py-3 px-4">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map(item => (
                    <motion.tr
                      key={item.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-b border-gray-200/50 hover:bg-gray-50/30"
                    >
                      <td className="py-3 px-4 text-gray-800 font-mono text-sm">{item.code}</td>
                      <td className="py-3 px-4 text-gray-800 font-medium">{item.name}</td>
                      <td className="py-3 px-4 text-gray-700">{item.specification || '-'}</td>
                      <td className="py-3 px-4 text-gray-700">{item.unit}</td>
                      <td className="py-3 px-4 text-right text-gray-700">
                        {item.default_price ? `¥${item.default_price.toLocaleString()}` : '-'}
                      </td>
                      <td className={`py-3 px-4 text-right ${item.min_stock > 0 && item.current_stock < item.min_stock ? 'text-red-500 font-medium' : 'text-gray-700'}`}>
                        {item.current_stock?.toLocaleString() || 0}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-1 rounded text-xs ${
                          item.status === 'active' ? 'bg-green-100 text-green-800' :
                          item.status === 'inactive' ? 'bg-gray-100 text-gray-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {statusOptions.find(s => s.value === item.status)?.label || item.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEdit(item)}
                            className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg"
                          >
                            <FaEdit />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
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
      )}
      
      {/* 物资分类 */}
      {activeTab === 'category' && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-800">物资分类</h3>
            <button
              onClick={() => { setEditingCategory(null); setCategoryForm({ code: '', name: '', sort_order: 0 }); setShowCategoryModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              <FaPlus /> 新增分类
            </button>
          </div>
          
          {categoryLoading ? (
            <div className="text-center text-gray-500 py-12">加载中...</div>
          ) : categories.length === 0 ? (
            <div className="text-center text-gray-500 py-12">暂无分类，点击上方按钮新增</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {categories.map(category => (
                <div
                  key={category.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-800">{category.name}</div>
                      <div className="text-sm text-gray-500 mt-1">
                        编码: {category.code || '-'}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEditCategory(category)}
                        className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg"
                      >
                        <FaEdit />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(category.id)}
                        className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* 物资表单弹窗 */}
      {showFormModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowFormModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
            className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-800">
                {editingMaterial ? '编辑物资' : '新增物资'}
              </h3>
              <button onClick={() => setShowFormModal(false)} className="text-gray-500 hover:text-gray-800">
                <FaTimes />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-2">物资编码 *</label>
                  <input
                    type="text"
                    required
                    value={form.code}
                    onChange={e => setForm({ ...form, code: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">物资名称 *</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-gray-500 mb-2">规格型号</label>
                <input
                  type="text"
                  value={form.specification}
                  onChange={e => setForm({ ...form, specification: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-2">物资分类</label>
                  <select
                    value={form.category_id}
                    onChange={e => setForm({ ...form, category_id: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  >
                    <option value="">选择分类</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">单位 *</label>
                  <select
                    value={form.unit}
                    onChange={e => setForm({ ...form, unit: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  >
                    {unitOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-2">参考单价</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.default_price}
                    onChange={e => setForm({ ...form, default_price: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">最低库存预警</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.min_stock}
                    onChange={e => setForm({ ...form, min_stock: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-gray-500 mb-2">状态</label>
                <SegmentedControl
                  value={form.status as 'active' | 'inactive' | 'discontinued'}
                  onChange={v => setForm({ ...form, status: v })}
                  options={statusOptions}
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-500 mb-2">备注</label>
                <textarea
                  value={form.remark}
                  onChange={e => setForm({ ...form, remark: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
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
                  保存
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
      
      {/* 分类表单弹窗 */}
      {showCategoryModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowCategoryModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
            className="bg-white rounded-xl p-6 w-full max-w-md border border-gray-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-800">
                {editingCategory ? '编辑分类' : '新增分类'}
              </h3>
              <button onClick={() => setShowCategoryModal(false)} className="text-gray-500 hover:text-gray-800">
                <FaTimes />
              </button>
            </div>
            
            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-500 mb-2">分类编码</label>
                <input
                  type="text"
                  value={categoryForm.code}
                  onChange={e => setCategoryForm({ ...categoryForm, code: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  placeholder="如: 01"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-500 mb-2">分类名称 *</label>
                <input
                  type="text"
                  required
                  value={categoryForm.name}
                  onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  placeholder="如: 钢材类"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-500 mb-2">排序</label>
                <input
                  type="number"
                  value={categoryForm.sort_order}
                  onChange={e => setCategoryForm({ ...categoryForm, sort_order: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  placeholder="数字越小越靠前"
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
                  保存
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default MaterialManagement;
