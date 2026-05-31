/**
 * 移动端台班录入页面
 * 适配手机端快速录入台班记录
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaArrowLeft, FaPlus, FaCamera, FaTrash, FaCheck, FaClock, FaMapMarker } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase/client';
import { createMachineShiftRecord, uploadMachineShiftImage } from '../machineShift/api';

interface FormData {
  project_id: string;
  machine_id: string;
  record_date: string;
  shift_count: number;
  cost_per_shift?: number;
  operator?: string;
  remark?: string;
  images: string[];
}

export default function MobileMachineShift() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<FormData>({
    project_id: '',
    machine_id: '',
    record_date: new Date().toISOString().split('T')[0],
    shift_count: 1,
    images: [],
  });
  
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [machines, setMachines] = useState<{ id: string; name: string; code: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // 加载项目列表
  useEffect(() => {
    loadProjects();
  }, []);

  // 当选择项目时，加载机械列表
  useEffect(() => {
    if (formData.project_id) {
      loadMachines(formData.project_id);
    }
  }, [formData.project_id]);

  const loadProjects = async () => {
    const { data } = await supabase
      .from('projects')
      .select('id, name')
      .eq('status', 'active')
      .order('name');
    
    if (data) {
      setProjects(data);
      // 默认选择第一个项目
      if (data.length > 0 && !formData.project_id) {
        setFormData(prev => ({ ...prev, project_id: data[0].id }));
      }
    }
  };

  const loadMachines = async (projectId: string) => {
    const { data } = await supabase
      .from('machines')
      .select('id, name, code')
      .eq('current_project_id', projectId);
    
    if (data) {
      setMachines(data);
    }
  };

  // 自动计算总费用
  const calculateTotalCost = () => {
    if (formData.cost_per_shift && formData.shift_count) {
      return (formData.cost_per_shift * formData.shift_count).toFixed(2);
    }
    return '0.00';
  };

  // 处理图片上传
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    try {
      const uploadedUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const url = await uploadMachineShiftImage(files[i]);
        uploadedUrls.push(url);
      }
      setFormData(prev => ({ ...prev, images: [...prev.images, ...uploadedUrls] }));
    } catch (err: any) {
      alert(err.message || '图片上传失败');
    }
  };

  // 删除图片
  const handleRemoveImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  // 提交表单
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.project_id) {
      alert('请选择项目');
      return;
    }
    if (!formData.machine_id) {
      alert('请选择机械');
      return;
    }
    if (!formData.shift_count || formData.shift_count <= 0) {
      alert('台班数必须大于0');
      return;
    }

    setSubmitting(true);

    try {
      await createMachineShiftRecord(formData);
      setSuccess(true);
      
      // 1秒后自动返回
      setTimeout(() => {
        navigate(-1);
      }, 1000);
    } catch (err: any) {
      alert(err.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 顶部导航 */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <FaArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <h1 className="text-lg font-bold text-gray-800">录入台班</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="p-4 space-y-4">
        {/* 成功提示 */}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3"
          >
            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
              <FaCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="font-medium text-green-800">提交成功</div>
              <div className="text-sm text-green-600">即将返回上一页...</div>
            </div>
          </motion.div>
        )}

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 项目选择 */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FaMapMarker className="inline-block mr-1" />
              选择项目
            </label>
            <select
              value={formData.project_id}
              onChange={(e) => setFormData(prev => ({ ...prev, project_id: e.target.value, machine_id: '' }))}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-800"
              required
            >
              <option value="">请选择项目</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* 机械选择 */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              选择机械
            </label>
            <select
              value={formData.machine_id}
              onChange={(e) => setFormData(prev => ({ ...prev, machine_id: e.target.value }))}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-800"
              required
              disabled={!formData.project_id}
            >
              <option value="">请先选择项目</option>
              {machines.map(m => (
                <option key={m.id} value={m.id}>
                  {m.code} - {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* 日期和台班数 */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FaClock className="inline-block mr-1" />
                  作业日期
                </label>
                <input
                  type="date"
                  value={formData.record_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, record_date: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-800"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  台班数
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={formData.shift_count}
                  onChange={(e) => setFormData(prev => ({ ...prev, shift_count: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 text-center text-xl font-bold"
                  required
                />
              </div>
            </div>
          </div>

          {/* 单价和总费用 */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  台班单价
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.cost_per_shift || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, cost_per_shift: parseFloat(e.target.value) || undefined }))}
                  placeholder="自动带出"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-800"
                />
              </div>
              <div className="flex items-center justify-center bg-blue-50 rounded-lg">
                <div className="text-center">
                  <div className="text-sm text-gray-500">总费用</div>
                  <div className="text-2xl font-bold text-blue-600">
                    ¥{calculateTotalCost()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 操作人 */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              操作人/司机
            </label>
            <input
              type="text"
              value={formData.operator || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, operator: e.target.value || undefined }))}
              placeholder="输入操作人姓名"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-800"
            />
          </div>

          {/* 拍照凭证 */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              <FaCamera className="inline-block mr-1" />
              拍照凭证（可选）
            </label>
            <div className="flex flex-wrap gap-2">
              {formData.images.map((url, index) => (
                <div key={index} className="relative w-20 h-20">
                  <img 
                    src={url} 
                    alt={`凭证${index + 1}`} 
                    className="w-full h-full object-cover rounded-lg" 
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(index)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center"
                  >
                    <FaTrash className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <label className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50">
                <FaCamera className="w-6 h-6 text-gray-400" />
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* 备注 */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              备注
            </label>
            <textarea
              value={formData.remark || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, remark: e.target.value || undefined }))}
              rows={3}
              placeholder="输入备注信息"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-800"
            />
          </div>

          {/* 提交按钮 */}
          <button
            type="submit"
            disabled={submitting || success}
            className={`w-full py-4 rounded-xl font-bold text-white text-lg transition-colors ${
              submitting || success
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
            }`}
          >
            {submitting ? '提交中...' : success ? '提交成功' : '提交台班'}
          </button>
        </form>
      </main>
    </div>
  );
}
