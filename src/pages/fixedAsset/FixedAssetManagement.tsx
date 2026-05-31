import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  FaPlus, FaEdit, FaTrash, FaSearch, FaTimes, 
  FaChevronLeft, FaChevronRight, FaWrench,
  FaClipboardList, FaSignOutAlt, FaSignInAlt, FaSync,
  FaArchive
} from 'react-icons/fa';
import { supabase } from '../../supabase/client';
import type { 
  FixedAsset, 
  AssetCategory, 
  FixedAssetFormData,
  AllocationFormData,
  TransferFormData,
  ScrapFormData
} from './types';
import { fixedAssetApi } from './api';

const PAGE_SIZE = 20;

type TabType = 'list' | 'category';

const FixedAssetManagement: React.FC = () => {
  // 标签页状态
  const [activeTab, setActiveTab] = useState<TabType>('list');
  
  // 资产列表状态
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  
  // 分类列表状态
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [categoryForm, setCategoryForm] = useState({ name: '', code: '', remark: '' });
  const [editingCategory, setEditingCategory] = useState<AssetCategory | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  
  // 资产表单状态
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [showAllocationModal, setShowAllocationModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showScrapModal, setShowScrapModal] = useState(false);
  
  const [editingAsset, setEditingAsset] = useState<FixedAsset | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<FixedAsset | null>(null);
  
  const [assetForm, setAssetForm] = useState<FixedAssetFormData>({
    asset_no: '',
    name: '',
    category_id: '',
    purchase_date: new Date().toISOString().split('T')[0],
    purchase_price: 0,
    depreciation_method: 'straight_line',
    useful_life: 5,
    salvage_value: 0
  });
  
  const [allocationForm, setAllocationForm] = useState<AllocationFormData>({
    asset_id: '',
    project_id: '',
    allocate_date: new Date().toISOString().split('T')[0]
  });
  
  const [transferForm, setTransferForm] = useState<TransferFormData>({
    asset_id: '',
    from_project_id: '',
    to_project_id: '',
    transfer_date: new Date().toISOString().split('T')[0]
  });
  
  const [scrapForm, setScrapForm] = useState<ScrapFormData>({
    asset_id: '',
    scrap_date: new Date().toISOString().split('T')[0],
    reason: '',
    disposal_method: ''
  });
  
  // 选项列表
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  
  // 加载资产列表
  const loadAssets = async () => {
    setLoading(true);
    try {
      const result = await fixedAssetApi.getAssets({
        keyword: search,
        category_id: categoryFilter || undefined,
        status: statusFilter || undefined,
        page,
        page_size: PAGE_SIZE
      });
      setAssets(result.data);
      setTotal(result.total);
    } catch (err) {
      console.error('加载资产失败', err);
    } finally {
      setLoading(false);
    }
  };
  
  // 加载分类列表
  const loadCategories = async () => {
    const data = await fixedAssetApi.getCategories();
    setCategories(data);
  };
  
  // 加载项目列表
  const loadProjects = async () => {
    const { data } = await supabase.from('projects').select('id, name');
    setProjects(data?.map(p => ({ id: p.id, name: p.name })) || []);
  };
  
  useEffect(() => {
    loadAssets();
    loadCategories();
    loadProjects();
  }, [page, search, statusFilter, categoryFilter]);
  
  useEffect(() => {
    if (activeTab === 'category') {
      loadCategories();
    }
  }, [activeTab]);
  
  // 搜索处理
  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };
  
  // 打开资产新增弹窗
  const openAddAsset = async () => {
    const assetNo = await fixedAssetApi.generateAssetNo();
    setEditingAsset(null);
    setAssetForm({
      asset_no: assetNo,
      name: '',
      category_id: '',
      purchase_date: new Date().toISOString().split('T')[0],
      purchase_price: 0,
      depreciation_method: 'straight_line',
      useful_life: 5,
      salvage_value: 0
    });
    setShowAssetModal(true);
  };
  
  // 打开资产编辑弹窗
  const openEditAsset = async (asset: FixedAsset) => {
    setEditingAsset(asset);
    setAssetForm({
      asset_no: asset.asset_no,
      name: asset.name,
      specification: asset.specification || undefined,
      model: asset.model || undefined,
      category_id: asset.category_id,
      brand: asset.brand || undefined,
      purchase_date: asset.purchase_date,
      purchase_price: asset.purchase_price,
      depreciation_method: asset.depreciation_method,
      useful_life: asset.useful_life,
      salvage_value: asset.salvage_value,
      location: asset.location || undefined,
      remark: asset.remark || undefined
    });
    setShowAssetModal(true);
  };
  
  // 保存资产
  const handleSaveAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!assetForm.name) {
      alert('请输入资产名称');
      return;
    }
    
    if (!assetForm.category_id) {
      alert('请选择资产分类');
      return;
    }
    
    try {
      if (editingAsset) {
        await fixedAssetApi.updateAsset(editingAsset.id, assetForm);
        alert('更新成功');
      } else {
        await fixedAssetApi.createAsset(assetForm);
        alert('创建成功');
      }
      
      setShowAssetModal(false);
      loadAssets();
    } catch (err: any) {
      alert(err.message || '保存失败');
    }
  };
  
  // 删除资产
  const handleDeleteAsset = async (id: string) => {
    if (confirm('确定要删除该资产吗？')) {
      try {
        await fixedAssetApi.deleteAsset(id);
        alert('删除成功');
        loadAssets();
      } catch (err: any) {
        alert(err.message || '删除失败');
      }
    }
  };
  
  // 打开领用弹窗
  const openAllocation = (asset: FixedAsset) => {
    setSelectedAsset(asset);
    setAllocationForm({
      asset_id: asset.id,
      project_id: '',
      allocate_date: new Date().toISOString().split('T')[0]
    });
    setShowAllocationModal(true);
  };
  
  // 领用资产
  const handleAllocate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!allocationForm.project_id) {
      alert('请选择项目');
      return;
    }
    
    try {
      await fixedAssetApi.allocateAsset(allocationForm);
      alert('领用成功');
      setShowAllocationModal(false);
      loadAssets();
    } catch (err: any) {
      alert(err.message || '领用失败');
    }
  };
  
  // 打开归还弹窗
  const openReturn = (asset: FixedAsset) => {
    if (confirm('确定要归还该资产吗？')) {
      try {
        // 找到最新的领用记录并归还
        fixedAssetApi.getAllocations(asset.id).then(async (allocations) => {
          const activeAllocation = allocations.find(a => a.status === 'allocated');
          if (activeAllocation) {
            await fixedAssetApi.returnAsset(activeAllocation.id);
            alert('归还成功');
            loadAssets();
          } else {
            alert('该资产没有未归还的领用记录');
          }
        });
      } catch (err: any) {
        alert(err.message || '归还失败');
      }
    }
  };
  
  // 打开调拨弹窗
  const openTransfer = (asset: FixedAsset) => {
    setSelectedAsset(asset);
    setTransferForm({
      asset_id: asset.id,
      from_project_id: asset.current_project_id || '',
      to_project_id: '',
      transfer_date: new Date().toISOString().split('T')[0]
    });
    setShowTransferModal(true);
  };
  
  // 调拨资产
  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!transferForm.to_project_id) {
      alert('请选择目标项目');
      return;
    }
    
    if (transferForm.from_project_id === transferForm.to_project_id) {
      alert('目标项目不能与当前项目相同');
      return;
    }
    
    try {
      await fixedAssetApi.transferAsset(transferForm);
      alert('调拨成功');
      setShowTransferModal(false);
      loadAssets();
    } catch (err: any) {
      alert(err.message || '调拨失败');
    }
  };
  
  // 打开报废弹窗
  const openScrap = (asset: FixedAsset) => {
    setSelectedAsset(asset);
    setScrapForm({
      asset_id: asset.id,
      scrap_date: new Date().toISOString().split('T')[0],
      reason: '',
      disposal_method: ''
    });
    setShowScrapModal(true);
  };
  
  // 报废资产
  const handleScrap = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!scrapForm.reason) {
      alert('请输入报废原因');
      return;
    }
    
    if (!scrapForm.disposal_method) {
      alert('请输入处置方式');
      return;
    }
    
    if (!confirm('确定要报废该资产吗？此操作不可撤销。')) {
      return;
    }
    
    try {
      await fixedAssetApi.scrapAsset(scrapForm);
      alert('报废成功');
      setShowScrapModal(false);
      loadAssets();
    } catch (err: any) {
      alert(err.message || '报废失败');
    }
  };
  
  // 分类管理
  const openCategoryModal = () => {
    setEditingCategory(null);
    setCategoryForm({ name: '', code: '', remark: '' });
    setShowCategoryModal(true);
  };
  
  const openEditCategory = (category: AssetCategory) => {
    setEditingCategory(category);
    setCategoryForm({ name: category.name, code: category.code, remark: category.remark || '' });
    setShowCategoryModal(true);
  };
  
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!categoryForm.name) {
      alert('请输入分类名称');
      return;
    }
    
    try {
      if (editingCategory) {
        await fixedAssetApi.updateCategory(editingCategory.id, categoryForm);
        alert('更新成功');
      } else {
        await fixedAssetApi.createCategory({
          ...categoryForm,
          parent_id: null,
          sort_order: categories.length + 1
        });
        alert('创建成功');
      }
      
      setShowCategoryModal(false);
      loadCategories();
    } catch (err: any) {
      alert(err.message || '保存失败');
    }
  };
  
  const handleDeleteCategory = async (id: string) => {
    if (confirm('确定要删除该分类吗？')) {
      try {
        await fixedAssetApi.deleteCategory(id);
        alert('删除成功');
        loadCategories();
      } catch (err: any) {
        alert(err.message || '删除失败');
      }
    }
  };
  
  const totalPages = Math.ceil(total / PAGE_SIZE);
  
  // 状态选项
  const statusOptions = [
    { value: 'in_stock', label: '库存中' },
    { value: 'in_use', label: '使用中' },
    { value: 'scrapped', label: '已报废' },
    { value: 'transferred', label: '已调拨' }
  ];
  
  // 折旧方法选项
  const depreciationOptions = [
    { value: 'straight_line', label: '直线法' },
    { value: 'declining_balance', label: '双倍余额递减法' },
    { value: 'sum_of_years', label: '年数总和法' }
  ];
  
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">固定资产管理</h1>
        <p className="text-gray-500 mt-1">管理固定资产档案、领用、调拨和报废</p>
      </div>
      
      {/* 标签页 */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('list')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'list'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <FaClipboardList className="inline-block mr-2" />
          资产档案
        </button>
        <button
          onClick={() => setActiveTab('category')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'category'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <FaArchive className="inline-block mr-2" />
          资产分类
        </button>
      </div>
      
      {/* 资产列表 */}
      {activeTab === 'list' && (
        <>
          {/* 工具栏 */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  placeholder="搜索资产编号、名称..."
                  value={search}
                  onChange={e => handleSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                />
              </div>
              
              <select
                value={categoryFilter}
                onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}
                className="px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
              >
                <option value="">全部分类</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
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
                onClick={openAddAsset}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg ml-auto"
              >
                <FaPlus /> 新增资产
              </button>
            </div>
          </div>
          
          {/* 资产列表 */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            {loading ? (
              <div className="text-center text-gray-500 py-12">加载中...</div>
            ) : assets.length === 0 ? (
              <div className="text-center text-gray-500 py-12">暂无资产</div>
            ) : (
              <div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-500 text-sm">
                      <th className="text-left py-3 px-4">资产编号</th>
                      <th className="text-left py-3 px-4">资产名称</th>
                      <th className="text-left py-3 px-4">分类</th>
                      <th className="text-right py-3 px-4">原值</th>
                      <th className="text-center py-3 px-4">状态</th>
                      <th className="text-left py-3 px-4">当前项目</th>
                      <th className="text-center py-3 px-4">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map(asset => (
                      <motion.tr
                        key={asset.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="border-b border-gray-200/50 hover:bg-gray-50/30"
                      >
                        <td className="py-3 px-4 text-gray-800 font-mono font-medium">{asset.asset_no}</td>
                        <td className="py-3 px-4 text-gray-700">{asset.name}</td>
                        <td className="py-3 px-4 text-gray-700">{asset.category_name || '-'}</td>
                        <td className="py-3 px-4 text-right text-gray-800 font-medium">
                          ¥{asset.purchase_price.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-1 rounded text-xs ${
                            asset.status === 'in_stock' ? 'bg-blue-100 text-blue-800' :
                            asset.status === 'in_use' ? 'bg-green-100 text-green-800' :
                            asset.status === 'scrapped' ? 'bg-red-100 text-red-800' :
                            'bg-orange-100 text-orange-800'
                          }`}>
                            {statusOptions.find(s => s.value === asset.status)?.label || asset.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-700">
                          {projects.find(p => p.id === asset.current_project_id)?.name || '-'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => openEditAsset(asset)}
                              className="p-1.5 text-blue-400 hover:bg-blue-500/20 rounded"
                              title="编辑"
                            >
                              <FaEdit className="w-4 h-4" />
                            </button>
                            {asset.status === 'in_stock' && (
                              <button
                                onClick={() => openAllocation(asset)}
                                className="p-1.5 text-green-400 hover:bg-green-500/20 rounded"
                                title="领用"
                              >
                                <FaSignOutAlt className="w-4 h-4" />
                              </button>
                            )}
                            {asset.status === 'in_use' && (
                              <>
                                <button
                                  onClick={() => openReturn(asset)}
                                  className="p-1.5 text-blue-400 hover:bg-blue-500/20 rounded"
                                  title="归还"
                                >
                                  <FaSignInAlt className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => openTransfer(asset)}
                                  className="p-1.5 text-purple-400 hover:bg-purple-500/20 rounded"
                                  title="调拨"
                                >
                                  <FaSync className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            {asset.status !== 'scrapped' && (
                              <button
                                onClick={() => openScrap(asset)}
                                className="p-1.5 text-red-400 hover:bg-red-500/20 rounded"
                                title="报废"
                              >
                                <FaTrash className="w-4 h-4" />
                              </button>
                            )}
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
        </>
      )}
      
      {/* 分类管理 */}
      {activeTab === 'category' && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-800">资产分类列表</h3>
            <button
              onClick={openCategoryModal}
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
                    <td className="py-3 px-4 text-gray-800">{category.name}</td>
                    <td className="py-3 px-4 text-gray-700 font-mono">{category.code}</td>
                    <td className="py-3 px-4 text-gray-700">{category.remark || '-'}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      
      {/* 资产表单弹窗 */}
      {showAssetModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowAssetModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
            className="bg-white rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto border border-gray-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6 p-4 border-b">
              <h3 className="text-xl font-bold text-gray-800">
                {editingAsset ? '编辑资产' : '新增资产'}
              </h3>
              <button onClick={() => setShowAssetModal(false)} className="text-gray-500 hover:text-gray-800">
                <FaTimes />
              </button>
            </div>
            
            <form onSubmit={handleSaveAsset} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-1">资产编号 *</label>
                  <input
                    type="text"
                    required
                    value={assetForm.asset_no}
                    onChange={e => setAssetForm(prev => ({ ...prev, asset_no: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">资产名称 *</label>
                  <input
                    type="text"
                    required
                    value={assetForm.name}
                    onChange={e => setAssetForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800 text-sm"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-1">资产分类 *</label>
                  <select
                    required
                    value={assetForm.category_id}
                    onChange={e => setAssetForm(prev => ({ ...prev, category_id: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800 text-sm"
                  >
                    <option value="">选择分类</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">规格型号</label>
                  <input
                    type="text"
                    value={assetForm.specification || ''}
                    onChange={e => setAssetForm(prev => ({ ...prev, specification: e.target.value || undefined }))}
                    className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800 text-sm"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-1">品牌</label>
                  <input
                    type="text"
                    value={assetForm.brand || ''}
                    onChange={e => setAssetForm(prev => ({ ...prev, brand: e.target.value || undefined }))}
                    className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">型号</label>
                  <input
                    type="text"
                    value={assetForm.model || ''}
                    onChange={e => setAssetForm(prev => ({ ...prev, model: e.target.value || undefined }))}
                    className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800 text-sm"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-1">购入日期 *</label>
                  <input
                    type="date"
                    required
                    value={assetForm.purchase_date}
                    onChange={e => setAssetForm(prev => ({ ...prev, purchase_date: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">购入原值 *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={assetForm.purchase_price}
                    onChange={e => setAssetForm(prev => ({ ...prev, purchase_price: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800 text-sm"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-1">折旧方法 *</label>
                  <select
                    required
                    value={assetForm.depreciation_method}
                    onChange={e => setAssetForm(prev => ({ ...prev, depreciation_method: e.target.value as any }))}
                    className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800 text-sm"
                  >
                    {depreciationOptions.map(d => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">使用年限(年) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={assetForm.useful_life}
                    onChange={e => setAssetForm(prev => ({ ...prev, useful_life: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800 text-sm"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-1">残值 *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={assetForm.salvage_value}
                    onChange={e => setAssetForm(prev => ({ ...prev, salvage_value: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">存放位置</label>
                  <input
                    type="text"
                    value={assetForm.location || ''}
                    onChange={e => setAssetForm(prev => ({ ...prev, location: e.target.value || undefined }))}
                    className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800 text-sm"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-gray-500 mb-1">备注</label>
                <textarea
                  value={assetForm.remark || ''}
                  onChange={e => setAssetForm(prev => ({ ...prev, remark: e.target.value || undefined }))}
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800 text-sm"
                />
              </div>
              
              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowAssetModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  {editingAsset ? '更新资产' : '创建资产'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
      
      {/* 领用弹窗 */}
      {showAllocationModal && selectedAsset && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowAllocationModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="bg-white rounded-xl w-full max-w-md border border-gray-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6 p-4 border-b">
              <h3 className="text-xl font-bold text-gray-800">领用资产</h3>
              <button onClick={() => setShowAllocationModal(false)} className="text-gray-500 hover:text-gray-800">
                <FaTimes />
              </button>
            </div>
            
            <form onSubmit={handleAllocate} className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-gray-500 mb-1">资产名称</label>
                <input
                  type="text"
                  disabled
                  value={selectedAsset.name}
                  className="w-full px-3 py-2 bg-gray-100 border border-slate-600 rounded-lg text-gray-600 text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-500 mb-1">领用项目 *</label>
                <select
                  required
                  value={allocationForm.project_id}
                  onChange={e => setAllocationForm(prev => ({ ...prev, project_id: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800 text-sm"
                >
                  <option value="">选择项目</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-gray-500 mb-1">领用日期 *</label>
                <input
                  type="date"
                  required
                  value={allocationForm.allocate_date}
                  onChange={e => setAllocationForm(prev => ({ ...prev, allocate_date: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800 text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-500 mb-1">备注</label>
                <textarea
                  value={allocationForm.remark || ''}
                  onChange={e => setAllocationForm(prev => ({ ...prev, remark: e.target.value || undefined }))}
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800 text-sm"
                />
              </div>
              
              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowAllocationModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  确认领用
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
      
      {/* 调拨弹窗 */}
      {showTransferModal && selectedAsset && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowTransferModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="bg-white rounded-xl w-full max-w-md border border-gray-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6 p-4 border-b">
              <h3 className="text-xl font-bold text-gray-800">资产调拨</h3>
              <button onClick={() => setShowTransferModal(false)} className="text-gray-500 hover:text-gray-800">
                <FaTimes />
              </button>
            </div>
            
            <form onSubmit={handleTransfer} className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-gray-500 mb-1">资产名称</label>
                <input
                  type="text"
                  disabled
                  value={selectedAsset.name}
                  className="w-full px-3 py-2 bg-gray-100 border border-slate-600 rounded-lg text-gray-600 text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-500 mb-1">当前项目</label>
                <input
                  type="text"
                  disabled
                  value={projects.find(p => p.id === selectedAsset.current_project_id)?.name || '-'}
                  className="w-full px-3 py-2 bg-gray-100 border border-slate-600 rounded-lg text-gray-600 text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-500 mb-1">目标项目 *</label>
                <select
                  required
                  value={transferForm.to_project_id}
                  onChange={e => setTransferForm(prev => ({ ...prev, to_project_id: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800 text-sm"
                >
                  <option value="">选择项目</option>
                  {projects.filter(p => p.id !== selectedAsset.current_project_id).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-gray-500 mb-1">调拨日期 *</label>
                <input
                  type="date"
                  required
                  value={transferForm.transfer_date}
                  onChange={e => setTransferForm(prev => ({ ...prev, transfer_date: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800 text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-500 mb-1">备注</label>
                <textarea
                  value={transferForm.remark || ''}
                  onChange={e => setTransferForm(prev => ({ ...prev, remark: e.target.value || undefined }))}
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800 text-sm"
                />
              </div>
              
              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  确认调拨
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
      
      {/* 报废弹窗 */}
      {showScrapModal && selectedAsset && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowScrapModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="bg-white rounded-xl w-full max-w-md border border-gray-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6 p-4 border-b">
              <h3 className="text-xl font-bold text-red-600">资产报废</h3>
              <button onClick={() => setShowScrapModal(false)} className="text-gray-500 hover:text-gray-800">
                <FaTimes />
              </button>
            </div>
            
            <form onSubmit={handleScrap} className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-gray-500 mb-1">资产名称</label>
                <input
                  type="text"
                  disabled
                  value={selectedAsset.name}
                  className="w-full px-3 py-2 bg-gray-100 border border-slate-600 rounded-lg text-gray-600 text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-500 mb-1">报废日期 *</label>
                <input
                  type="date"
                  required
                  value={scrapForm.scrap_date}
                  onChange={e => setScrapForm(prev => ({ ...prev, scrap_date: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800 text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-500 mb-1">报废原因 *</label>
                <textarea
                  required
                  value={scrapForm.reason}
                  onChange={e => setScrapForm(prev => ({ ...prev, reason: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800 text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-500 mb-1">处置方式 *</label>
                <input
                  type="text"
                  required
                  value={scrapForm.disposal_method}
                  onChange={e => setScrapForm(prev => ({ ...prev, disposal_method: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800 text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-500 mb-1">备注</label>
                <textarea
                  value={scrapForm.remark || ''}
                  onChange={e => setScrapForm(prev => ({ ...prev, remark: e.target.value || undefined }))}
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800 text-sm"
                />
              </div>
              
              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowScrapModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
                >
                  确认报废
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
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowCategoryModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="bg-white rounded-xl w-full max-w-md border border-gray-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6 p-4 border-b">
              <h3 className="text-xl font-bold text-gray-800">
                {editingCategory ? '编辑分类' : '新增分类'}
              </h3>
              <button onClick={() => setShowCategoryModal(false)} className="text-gray-500 hover:text-gray-800">
                <FaTimes />
              </button>
            </div>
            
            <form onSubmit={handleSaveCategory} className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-gray-500 mb-1">分类名称 *</label>
                <input
                  type="text"
                  required
                  value={categoryForm.name}
                  onChange={e => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800 text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-500 mb-1">分类编码</label>
                <input
                  type="text"
                  value={categoryForm.code}
                  onChange={e => setCategoryForm(prev => ({ ...prev, code: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800 text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-500 mb-1">备注</label>
                <textarea
                  value={categoryForm.remark}
                  onChange={e => setCategoryForm(prev => ({ ...prev, remark: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800 text-sm"
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
                  {editingCategory ? '更新分类' : '创建分类'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default FixedAssetManagement;
