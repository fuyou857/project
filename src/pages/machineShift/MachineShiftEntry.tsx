/**
 * 机械台班录入页面
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPlus, FaTimes, FaUpload } from 'react-icons/fa';
import { SearchableSelect } from '../../components/ui';
import { projectSelectOptions } from '../../components/ui/options';
import { useCompanyScope } from '../../hooks/useCompanyScope';
import { supabase } from '../../supabase/client';
import {
  createMachineShiftRecord,
  fetchRentalContracts,
  uploadMachineShiftImage,
} from './api';
import type { MachineShiftFormData, RentalContract } from './types';

interface MachineShiftEntryProps {
  onSuccess?: () => void;
  onClose?: () => void;
  defaultProjectId?: string;
  defaultDate?: string;
}

export default function MachineShiftEntry({
  onSuccess,
  onClose,
  defaultProjectId,
  defaultDate,
}: MachineShiftEntryProps) {
  const { companyIds } = useCompanyScope();
  
  const [projects, setProjects] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [contracts, setContracts] = useState<RentalContract[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState<MachineShiftFormData>({
    project_id: defaultProjectId || '',
    machine_id: '',
    record_date: defaultDate || new Date().toISOString().split('T')[0],
    shift_count: 1,
    start_time: '',
    end_time: '',
    cost_per_shift: undefined,
    operator: '',
    remark: '',
    images: [],
  });

  const [uploadingImages, setUploadingImages] = useState(false);

  // 加载项目列表
  useEffect(() => {
    async function loadProjects() {
      if (companyIds.length === 0) return;
      
      const { data } = await supabase
        .from('projects')
        .select('id, name')
        .in('company_id', companyIds)
        .eq('status', 'active')
        .order('name');
      
      if (data) setProjects(data);
    }
    loadProjects();
  }, [companyIds]);

  // 加载机械列表
  useEffect(() => {
    async function loadMachines() {
      try {
        const { data, error } = await supabase
          .from('machines')
          .select('id, name, code, unit, default_shift_price')
          .eq('status', 'available')
          .order('name');
        
        if (error) {
          console.warn('Failed to load machines from database:', error);
          // 使用模拟数据
          setMachines([
            { id: 'eq001', name: '挖掘机', code: 'EQ001', unit: '台班', default_shift_price: 1800 },
            { id: 'eq002', name: '塔吊', code: 'EQ002', unit: '台班', default_shift_price: 2500 },
            { id: 'eq003', name: '混凝土泵车', code: 'EQ003', unit: '台班', default_shift_price: 3200 },
            { id: 'eq004', name: '压路机', code: 'EQ004', unit: '台班', default_shift_price: 1200 },
            { id: 'eq005', name: '装载机', code: 'EQ005', unit: '台班', default_shift_price: 1000 },
          ]);
          return;
        }
        
        if (data) setMachines(data);
      } catch (err) {
        console.error('Error loading machines:', err);
      }
    }
    loadMachines();
  }, []);

  // 当选择项目时，加载该项目的机械租赁合同
  useEffect(() => {
    async function loadContracts() {
      if (!formData.project_id) {
        setContracts([]);
        return;
      }
      
      try {
        const data = await fetchRentalContracts(formData.project_id);
        setContracts(data);
      } catch (err) {
        console.error('Failed to load contracts:', err);
        setContracts([]);
      }
    }
    loadContracts();
  }, [formData.project_id]);

  // 当选择合同或机械时，自动带出台班单价
  useEffect(() => {
    // 优先从合同带出单价
    if (formData.rental_contract_id) {
      const contract = contracts.find(c => c.id === formData.rental_contract_id);
      if (contract?.shift_price) {
        setFormData(prev => ({ ...prev, cost_per_shift: contract.shift_price }));
        return;
      }
    }

    // 其次从机械带出默认单价
    if (formData.machine_id) {
      const machine = machines.find(m => m.id === formData.machine_id);
      if (machine?.default_shift_price) {
        setFormData(prev => ({ ...prev, cost_per_shift: machine.default_shift_price }));
        return;
      }
    }

    // 否则清空
    setFormData(prev => ({ ...prev, cost_per_shift: undefined }));
  }, [formData.rental_contract_id, formData.machine_id, contracts, machines]);

  const projectOptions = useMemo(() => projectSelectOptions(projects), [projects]);

  const machineOptions = useMemo(() => [
    { value: '', label: '请选择机械' },
    ...machines.map(m => ({
      value: m.id,
      label: `${m.name} (${m.code || '无编码'})`,
    })),
  ], [machines]);

  const contractOptions = useMemo(() => [
    { value: '', label: '不使用合同（手动填写单价）' },
    ...contracts.map(c => ({
      value: c.id,
      label: `${c.contract_no} - ${c.contract_name} (单价: ¥${c.shift_price || '-'})`,
    })),
  ], [contracts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.project_id || !formData.machine_id || !formData.shift_count) {
      alert('请填写必填字段');
      return;
    }

    setLoading(true);
    try {
      await createMachineShiftRecord(formData);
      alert('保存成功');
      onSuccess?.();
      if (onClose) onClose();
    } catch (err: any) {
      alert(err.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    setUploadingImages(true);
    try {
      const uploadedUrls: string[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const url = await uploadMachineShiftImage(files[i]);
        uploadedUrls.push(url);
      }

      setFormData(prev => ({
        ...prev,
        images: [...prev.images, ...uploadedUrls],
      }));
    } catch (err: any) {
      alert(err.message || '上传失败');
    } finally {
      setUploadingImages(false);
    }
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-white rounded-xl border border-gray-200 p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-800">录入台班</h3>
        {onClose && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose && onClose(); }}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FaTimes className="text-gray-500" />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 项目选择 */}
        <div>
          <label className="block text-gray-500 text-sm mb-2">
            项目 <span className="text-red-500">*</span>
          </label>
          <SearchableSelect
            value={formData.project_id}
            onChange={(value) => setFormData(prev => ({ ...prev, project_id: value }))}
            options={projectOptions}
            placeholder="选择项目"
            searchPlaceholder="搜索项目..."
            className="w-full"
          />
        </div>

        {/* 机械选择 */}
        <div>
          <label className="block text-gray-500 text-sm mb-2">
            机械 <span className="text-red-500">*</span>
          </label>
          <SearchableSelect
            value={formData.machine_id}
            onChange={(value) => setFormData(prev => ({ ...prev, machine_id: value }))}
            options={machineOptions}
            placeholder="选择机械"
            searchPlaceholder="搜索机械..."
            className="w-full"
          />
        </div>

        {/* 租赁合同（可选） */}
        <div>
          <label className="block text-gray-500 text-sm mb-2">
            租赁合同 <span className="text-gray-400">(可选)</span>
          </label>
          <SearchableSelect
            value={formData.rental_contract_id || ''}
            onChange={(value) => setFormData(prev => ({ ...prev, rental_contract_id: value || undefined }))}
            options={contractOptions}
            placeholder="选择合同"
            searchPlaceholder="搜索合同..."
            className="w-full"
          />
        </div>

        {/* 作业日期 */}
        <div>
          <label className="block text-gray-500 text-sm mb-2">
            作业日期 <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={formData.record_date}
            onChange={(e) => setFormData(prev => ({ ...prev, record_date: e.target.value }))}
            className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
          />
        </div>

        {/* 台班数 */}
        <div>
          <label className="block text-gray-500 text-sm mb-2">
            台班数 <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            step="0.5"
            min="0"
            value={formData.shift_count}
            onChange={(e) => setFormData(prev => ({ ...prev, shift_count: parseFloat(e.target.value) || 0 }))}
            className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
            placeholder="支持小数，如1.5"
          />
        </div>

        {/* 开始时间 - 结束时间 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-500 text-sm mb-2">
              开始时间 <span className="text-gray-400">(可选)</span>
            </label>
            <input
              type="time"
              value={formData.start_time || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value || undefined }))}
              className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
            />
          </div>
          <div>
            <label className="block text-gray-500 text-sm mb-2">
              结束时间 <span className="text-gray-400">(可选)</span>
            </label>
            <input
              type="time"
              value={formData.end_time || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value || undefined }))}
              className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
            />
          </div>
        </div>

        {/* 台班单价 */}
        <div>
          <label className="block text-gray-500 text-sm mb-2">
            台班单价 <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={formData.cost_per_shift || ''}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              cost_per_shift: e.target.value ? parseFloat(e.target.value) : undefined 
            }))}
            className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
            placeholder="自动从合同或机械带出，可手动修改"
          />
          {formData.shift_count && formData.cost_per_shift && (
            <p className="text-sm text-gray-500 mt-1">
              预计总费用：¥{(formData.shift_count * formData.cost_per_shift).toFixed(2)}
            </p>
          )}
        </div>

        {/* 操作人 */}
        <div>
          <label className="block text-gray-500 text-sm mb-2">
            操作人/司机 <span className="text-gray-400">(可选)</span>
          </label>
          <input
            type="text"
            value={formData.operator || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, operator: e.target.value }))}
            className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
            placeholder="输入操作人或司机姓名"
          />
        </div>

        {/* 备注 */}
        <div>
          <label className="block text-gray-500 text-sm mb-2">
            备注 <span className="text-gray-400">(可选)</span>
          </label>
          <textarea
            value={formData.remark || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, remark: e.target.value }))}
            className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
            rows={3}
            placeholder="输入备注信息"
          />
        </div>

        {/* 拍照凭证 */}
        <div>
          <label className="block text-gray-500 text-sm mb-2">
            拍照凭证 <span className="text-gray-400">(可选)</span>
          </label>
          
          <div className="flex items-center gap-2 mb-2">
            <label className="flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg cursor-pointer transition-colors">
              <FaUpload />
              <span>{uploadingImages ? '上传中...' : '上传图片'}</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                disabled={uploadingImages}
                className="hidden"
              />
            </label>
            <span className="text-sm text-gray-500">支持 JPG, PNG (最大 12MB)</span>
          </div>

          {formData.images.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {formData.images.map((url, index) => (
                <div key={index} className="relative group">
                  <img
                    src={url}
                    alt={`凭证 ${index + 1}`}
                    className="w-full h-24 object-cover rounded-lg border border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <FaTimes className="text-xs" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 提交按钮 */}
        <div className="flex justify-end gap-3 pt-4">
          {onClose && (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose && onClose(); }}
              className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors"
            >
              取消
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? '保存中...' : '保存'}
          </button>
        </div>
      </form>
    </motion.div>
  );
}
