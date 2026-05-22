import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaExclamationTriangle, FaCheck, FaTrash, FaSearch, FaCheckCircle } from 'react-icons/fa';
import { supabase } from '../supabase/client';
import { useCompanyScope } from '../hooks/useCompanyScope';
import { projectIdsForCompanies } from '../utils/companyProjectScope';
import { SegmentedControl } from '../components/ui';

interface Warning {
  id: string;
  warning_type: string;
  content: string;
  project_id: string;
  status: string;
  urgent: boolean;
  created_at: string;
}

type WarningInsert = Omit<Warning, 'id' | 'created_at'>;
const PAGE_SIZE = 15;

export default function Warnings() {
  const { currentCompany, companies, companyIds } = useCompanyScope();
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<{type: string;message: string;} | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase.from('warnings').select('*').order('id', { ascending: false }).limit(PAGE_SIZE);
      if (companyIds.length > 0) {
        const projectIds = await projectIdsForCompanies(companyIds);
        if (projectIds.length === 0) {
          setWarnings([]);
          return;
        }
        query = query.in('project_id', projectIds);
      }
      if (filter === 'pending') query = query.eq('status', 'pending');else
      if (filter === 'resolved') query = query.eq('status', 'resolved');
      const { data, error } = await query;
      if (error) {
        console.error('[Warnings] fetchData', error);
        setWarnings([]);
        return;
      }
      if (data) setWarnings(data);
    } catch (e) {
      console.error('[Warnings] fetchData', e);
      setWarnings([]);
    } finally {
      setLoading(false);
    }
  }, [filter, companyIds]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function generateWarnings() {
    try {
      let query = supabase.from('projects').select('*');
      if (companyIds.length > 0) query = query.in('company_id', companyIds);
      const { data: projects, error } = await query;
      if (error) {
        console.error('[Warnings] generateWarnings projects', error);
        return;
      }
      const now = new Date();
      const newWarnings: WarningInsert[] = [];

      for (const p of projects || []) {
        if (p.end_date && new Date(p.end_date) < now && p.status !== 'completed') {
          const exists = warnings.some((w) => w.project_id === p.id && w.warning_type === '工期逾期' && w.status === 'pending');
          if (!exists) {
            newWarnings.push({ warning_type: '工期逾期', content: `项目「${p.name}」已超过结束日期`, project_id: p.id, status: 'pending', urgent: true });
          }
        }
      }

      if (newWarnings.length > 0) {
        const { error: insErr } = await supabase.from('warnings').insert(newWarnings);
        if (insErr) console.error('[Warnings] insert', insErr);else
        {
          showToast('success', `已生成 ${newWarnings.length} 条预警`);
          fetchData();
        }
      } else {
        showToast('info', '暂无新的预警');
      }
    } catch (e) {
      console.error('[Warnings] generateWarnings', e);
    }
  }

  async function handleResolve(id: string) {
    try {
      const { error } = await supabase.from('warnings').update({ status: 'resolved' }).eq('id', id);
      if (error) console.error('[Warnings] handleResolve', error);else
      {
        showToast('success', '已标记为已处理');
        fetchData();
      }
    } catch (e) {
      console.error('[Warnings] handleResolve', e);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      const { error } = await supabase.from('warnings').delete().eq('id', deleteId);
      if (error) console.error('[Warnings] handleDelete', error);else
      {
        showToast('success', '删除成功');
        setShowDeleteModal(false);
        setDeleteId(null);
        fetchData();
      }
    } catch (e) {
      console.error('[Warnings] handleDelete', e);
    }
  }

  function showToast(type: string, message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  }

  const filtered = warnings.filter((w) => {
    if (filter === 'pending') return w.status === 'pending';
    if (filter === 'resolved') return w.status === 'resolved';
    return true;
  }).filter((w) => !search || w.content.includes(search) || w.warning_type.includes(search));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">预警中心</h2>
        <button onClick={generateWarnings} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-gray-800 rounded-lg">
          <FaExclamationTriangle /> 生成预警
        </button>
      </div>

        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
          <div className="relative min-w-[12rem] flex-1">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
            type="text"
            placeholder="搜索预警..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ui-input w-full pl-10" />
          
          </div>
          <SegmentedControl
          value={filter as 'all' | 'pending' | 'resolved'}
          onChange={(v) => setFilter(v)}
          options={[
          { value: 'all', label: '全部' },
          { value: 'pending', label: '待处理' },
          { value: 'resolved', label: '已处理' }]
          }
          className="min-w-0 flex-shrink-0"
          aria-label="预警筛选" />
        
        </div>

      <div className="bg-white rounded-lg overflow-hidden">
        {(() => {if (loading) {return <div className="text-slate-500 text-center py-8">加载中...</div>;} else {if (filtered.length === 0) {return (
                <div className="text-slate-500 text-center py-8">暂无预警</div>);} else {return (

                <div className="divide-y divide-slate-700">
            {filtered.map((w) =>
                  <motion.div key={w.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className={`p-4 flex items-center justify-between ${w.urgent && w.status === 'pending' ? 'bg-red-500/10' : 'hover:bg-gray-50/30'}`}>
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${w.urgent ? 'bg-red-500/20' : 'bg-yellow-500/20'}`}>
                    <FaExclamationTriangle className={`${w.urgent ? 'text-red-400' : 'text-yellow-400'}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${w.urgent ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{w.warning_type}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${w.status === 'resolved' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500 text-gray-500'}`}>{w.status === 'resolved' ? '已处理' : '待处理'}</span>
                    </div>
                    <div className="text-gray-800 mt-1">{w.content}</div>
                    <div className="text-slate-500 text-sm mt-1">{w.created_at?.slice(0, 19).replace('T', ' ') || '-'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {w.status === 'pending' &&
                      <button onClick={() => handleResolve(w.id)} className="p-2 text-green-400 hover:bg-green-500/20 rounded-lg" title="标记已处理">
                      <FaCheck />
                    </button>
                      }
                  <button onClick={() => {setDeleteId(w.id);setShowDeleteModal(true);}} className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg" title="删除">
                    <FaTrash />
                  </button>
                </div>
              </motion.div>
                  )}
          </div>);}}})()
        }
      </div>

      <AnimatePresence>
        {showDeleteModal &&
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDeleteModal(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-xl font-bold text-gray-800 mb-4">确认删除</h3>
              <p className="text-gray-700 mb-6">确定要删除这条预警记录吗？</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 bg-gray-500 text-gray-800 rounded-lg">取消</button>
                <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-gray-800 rounded-lg">删除</button>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      <AnimatePresence>
        {toast &&
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
        className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg flex items-center gap-2 ${(() => {if (toast.type === 'success') {return 'bg-green-600';} else {if (toast.type === 'info') {return 'bg-blue-600';} else {return 'bg-red-600';}}})()} text-gray-800`}>
            {toast.type === 'success' ? <FaCheckCircle /> : <FaExclamationTriangle />}
            <span>{toast.message}</span>
          </motion.div>
        }
      </AnimatePresence>
    </div>);

}