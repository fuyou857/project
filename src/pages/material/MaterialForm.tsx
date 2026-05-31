import React, { useState, useEffect } from 'react';
import { FaTimes } from 'react-icons/fa';
import UiModalOverlay from '@/components/ui/UiModalOverlay';
import { materialApi } from './api';
import type { Material, MaterialCategory, MaterialFormData } from './types';

interface MaterialFormProps {
  material: Material | null;
  categories: MaterialCategory[];
  onSave: (data: MaterialFormData) => void;
  onClose: () => void;
}

const showError = (msg: string) => alert(msg);
const success = (msg: string) => alert(msg);

const MaterialForm: React.FC<MaterialFormProps> = ({
  material,
  categories,
  onSave,
  onClose
}) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<MaterialFormData>({
    code: '',
    name: '',
    specification: '',
    unit: '个',
    category_id: undefined,
    default_price: undefined,
    min_stock: 0,
    status: 'active',
    remark: ''
  });
  
  useEffect(() => {
    if (material) {
      setForm({
        code: material.code,
        name: material.name,
        specification: material.specification || '',
        unit: material.unit,
        category_id: material.category_id || undefined,
        default_price: material.default_price || undefined,
        min_stock: material.min_stock || 0,
        status: material.status,
        remark: material.remark || ''
      });
    } else {
      generateCode();
    }
  }, [material]);
  
  const generateCode = async () => {
    try {
      const code = await materialApi.generateMaterialCode();
      setForm(prev => ({ ...prev, code }));
    } catch (err) {
      console.error('生成编码失败', err);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.code.trim()) {
      showError('请输入物资编码');
      return;
    }
    if (!form.name.trim()) {
      showError('请输入物资名称');
      return;
    }
    if (!form.unit.trim()) {
      showError('请输入单位');
      return;
    }
    
    setLoading(true);
    try {
      await onSave(form);
    } finally {
      setLoading(false);
    }
  };
  
  const unitOptions = [
    { value: '个', label: '个' },
    { value: '件', label: '件' },
    { value: '套', label: '套' },
    { value: '台', label: '台' },
    { value: '辆', label: '辆' },
    { value: '吨', label: '吨' },
    { value: '千克', label: '千克' },
    { value: '立方米', label: '立方米' },
    { value: '平方米', label: '平方米' },
    { value: '米', label: '米' },
    { value: '卷', label: '卷' },
    { value: '张', label: '张' },
    { value: '根', label: '根' },
    { value: '箱', label: '箱' },
    { value: '袋', label: '袋' },
    { value: '桶', label: '桶' },
    { value: '升', label: '升' }
  ];
  
  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm';
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1';
  const selectCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white';
  
  return (
    <UiModalOverlay open onClose={onClose}>
      <div className="bg-white rounded-xl w-full max-h-[95vh] overflow-hidden shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">{material ? '编辑物资' : '新增物资'}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
            <FaTimes className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(95vh-8rem)]">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>
                物资编码 <span className="text-red-500">*</span>
              </label>
              <input
                className={inputCls}
                value={form.code}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(prev => ({ ...prev, code: e.target.value }))}
                placeholder="系统自动生成"
                required
              />
            </div>
            <div>
              <label className={labelCls}>
                物资名称 <span className="text-red-500">*</span>
              </label>
              <input
                className={inputCls}
                value={form.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="如: 螺纹钢"
                required
              />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>规格型号</label>
              <input
                className={inputCls}
                value={form.specification}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(prev => ({ ...prev, specification: e.target.value }))}
                placeholder="如: HRB400 Φ12"
              />
            </div>
            <div>
              <label className={labelCls}>物资分类</label>
              <select
                className={selectCls}
                value={form.category_id || ''}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(prev => ({ ...prev, category_id: e.target.value || undefined }))}
              >
                <option value="">选择分类</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>
                单位 <span className="text-red-500">*</span>
              </label>
              <select
                className={selectCls}
                value={form.unit}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(prev => ({ ...prev, unit: e.target.value }))}
              >
                {unitOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>参考单价</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">¥</span>
                <input
                  type="number"
                  className={`${inputCls} pl-8`}
                  value={form.default_price ?? ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(prev => ({
                    ...prev,
                    default_price: e.target.value ? parseFloat(e.target.value) : undefined
                  }))}
                  placeholder="0.00"
                  min={0}
                  step={0.01}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>最低库存预警</label>
              <input
                type="number"
                className={inputCls}
                value={form.min_stock}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(prev => ({
                  ...prev,
                  min_stock: e.target.value ? parseFloat(e.target.value) : 0
                }))}
                placeholder="0"
                min={0}
                step={0.01}
              />
            </div>
            <div>
              <label className={labelCls}>状态</label>
              <select
                className={selectCls}
                value={form.status}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(prev => ({ ...prev, status: e.target.value as 'active' | 'inactive' | 'discontinued' }))}
              >
                <option value="active">正常</option>
                <option value="inactive">停用</option>
                <option value="discontinued">淘汰</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className={labelCls}>备注</label>
              <textarea
                className={inputCls}
                value={form.remark}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm(prev => ({ ...prev, remark: e.target.value }))}
                placeholder="可选"
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '保存中...' : (material ? '更新' : '创建')}
            </button>
          </div>
        </form>
      </div>
    </UiModalOverlay>
  );
};

export default MaterialForm;