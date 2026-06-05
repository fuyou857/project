import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPlus, FaUpload, FaUser, FaCalendarAlt, FaMoneyCheckAlt, FaSearch, FaTimes } from 'react-icons/fa';
import { supabase } from '../supabase/client';
import { alertMissingRequiredFields } from '../utils/contractSubPage';
import { SearchableSelect } from '../components/ui';
import { useProjectsForSelect } from '../hooks/useProjectsForSelect';

const PROJECT_SEARCH_PROPS = {
  searchThreshold: 1 as const,
  searchPlaceholder: '搜索项目名称或编号…',
};

function getActiveTabFromPath(pathname: string): string {
  if (pathname.includes('/attendance')) return 'attendance';
  if (pathname.includes('/payment')) return 'payment';
  if (pathname.includes('/contract')) return 'contract';
  return 'workers';
}

interface Worker {
  id: string;
  name: string;
  id_card: string;
  position: string;
  wage_standard: number;
  education_records: string;
  project_id: string;
}

interface Attendance {
  id: string;
  worker_id: string;
  month: string;
  work_days: number;
  overtime_hours: number;
}

interface WagePayment {
  id: string;
  worker_id: string;
  payment_month: string;
  amount: number;
  status: string;
}

export default function Workers() {
  const { filterOptions: projectFilterOptions, options: projectFormOptions } = useProjectsForSelect({
    filterEmptyLabel: '全部项目',
    emptyLabel: '请选择项目',
  });
  const location = useLocation();
  const activeTab = getActiveTabFromPath(location.pathname);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [wages, setWages] = useState<WagePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [formData, setFormData] = useState<{
    name: string;
    id_card: string;
    position: string;
    wage_standard: number | null;
    education_records: string;
  }>({
    name: '',
    id_card: '',
    position: '',
    wage_standard: null,
    education_records: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const [wRes, aRes, wageRes] = await Promise.all([
      supabase.from('workers').select('*').limit(100),
      supabase.from('attendance').select('*').limit(100),
      supabase.from('wage_payments').select('*').limit(100),
    ]);
    if (wRes.data) setWorkers(wRes.data);
    if (aRes.data) setAttendance(aRes.data);
    if (wageRes.data) setWages(wageRes.data);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const missing: string[] = [];
    if (!selectedProject) missing.push('项目');
    if (!formData.name?.trim()) missing.push('姓名');
    if (!formData.id_card?.trim()) missing.push('身份证号');
    if (alertMissingRequiredFields(missing)) return
    
    await supabase.from('workers').insert({
      project_id: selectedProject,
      ...formData,
    });
    
    setShowModal(false);
    setFormData({ name: '', id_card: '', position: '', wage_standard: null, education_records: '' });
    fetchData();
  }

  const tabs = [
    { key: 'workers', label: '农民工档案', icon: FaUser },
    { key: 'attendance', label: '考勤记录', icon: FaCalendarAlt },
    { key: 'wages', label: '工资台账', icon: FaMoneyCheckAlt },
  ];

  const filteredWorkers = workers.filter(w => 
    w.name.toLowerCase().includes(searchKeyword.toLowerCase()) ||
    w.id_card.includes(searchKeyword)
  );

  const calculateWage = (worker: Worker, workDays: number) => {
    const dailyWage = worker.wage_standard / 30;
    return dailyWage * workDays;
  };

  const formatMoney = (amount: number) => `¥${(amount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">农民工管理</h2>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-gray-800 rounded-lg">
            <FaUpload /> 导入考勤
          </button>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-gray-800 rounded-lg">
            <FaPlus /> 新增档案
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 border border-gray-200">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1">
            <SearchableSelect
              value={selectedProject}
              onChange={setSelectedProject}
              options={projectFilterOptions}
              placeholder="全部项目"
              emptyLabel="全部项目"
              {...PROJECT_SEARCH_PROPS}
            />
          </div>
          <div className="flex-1 relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="搜索姓名或身份证号..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
            />
          </div>
        </div>

        <div className="flex gap-2 border-b border-gray-200 pb-2">
          {tabs.map(tab => (
            <button
              key={tab.key}
              className={`flex-1 px-4 py-3 text-center transition-colors ${activeTab === tab.key ? 'bg-blue-600 text-gray-800' : 'text-gray-500 hover:text-gray-800'}`}
            >
              <tab.icon /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-8">加载中...</div>
      ) : (
        <>
          {activeTab === 'workers' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="bg-white rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-gray-700">姓名</th>
                      <th className="px-4 py-3 text-left text-gray-700">身份证号</th>
                      <th className="px-4 py-3 text-left text-gray-700">岗位</th>
                      <th className="px-4 py-3 text-right text-gray-700">日工资标准</th>
                      <th className="px-4 py-3 text-left text-gray-700">三级教育</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredWorkers.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">暂无档案</td></tr>
                    ) : filteredWorkers.map(w => (
                      <tr key={w.id} className="border-t border-gray-200 hover:bg-slate-750">
                        <td className="px-4 py-3 text-gray-800 font-medium">{w.name}</td>
                        <td className="px-4 py-3 text-gray-700">{w.id_card}</td>
                        <td className="px-4 py-3 text-gray-700">{w.position || '-'}</td>
                        <td className="px-4 py-3 text-right text-green-400">{formatMoney(w.wage_standard)}</td>
                        <td className="px-4 py-3 text-gray-700">{w.education_records ? '已记录' : '未记录'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === 'attendance' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="bg-white rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-gray-700">姓名</th>
                      <th className="px-4 py-3 text-left text-gray-700">月份</th>
                      <th className="px-4 py-3 text-right text-gray-700">出勤天数</th>
                      <th className="px-4 py-3 text-right text-gray-700">加班小时</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">暂无记录</td></tr>
                    ) : attendance.map(a => (
                      <tr key={a.id} className="border-t border-gray-200">
                        <td className="px-4 py-3 text-gray-800">{workers.find(w => w.id === a.worker_id)?.name || '-'}</td>
                        <td className="px-4 py-3 text-gray-700">{a.month}</td>
                        <td className="px-4 py-3 text-right text-gray-800">{a.work_days}天</td>
                        <td className="px-4 py-3 text-right text-gray-700">{a.overtime_hours || 0}小时</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === 'wages' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="bg-white rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-gray-700">姓名</th>
                      <th className="px-4 py-3 text-left text-gray-700">月份</th>
                      <th className="px-4 py-3 text-right text-gray-700">出勤天数</th>
                      <th className="px-4 py-3 text-right text-gray-700">应付工资</th>
                      <th className="px-4 py-3 text-center text-gray-700">状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wages.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">暂无记录</td></tr>
                    ) : wages.map(w => {
                      const worker = workers.find(wo => wo.id === w.worker_id);
                      const att = attendance.find(a => a.worker_id === w.worker_id && a.month === w.payment_month);
                      const calculatedWage = worker && att ? calculateWage(worker, att.work_days) : w.amount;
                      return (
                        <tr key={w.id} className="border-t border-gray-200">
                          <td className="px-4 py-3 text-gray-800">{worker?.name || '-'}</td>
                          <td className="px-4 py-3 text-gray-700">{w.payment_month}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{att?.work_days || 0}天</td>
                          <td className="px-4 py-3 text-right text-green-400">{formatMoney(calculatedWage)}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-1 rounded text-xs ${w.status === 'paid' ? 'bg-green-900 text-green-400' : 'bg-yellow-900 text-yellow-400'}`}>
                              {w.status === 'paid' ? '已发放' : '待发放'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </>
      )}

      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="bg-white rounded-xl p-6 w-full max-w-lg border border-gray-200"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-800">新增农民工档案</h3>
                <button onClick={(e) => { e.stopPropagation(); }} className="text-gray-500 hover:text-gray-800">
                  <FaTimes />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="ui-label mb-2 block">选择项目 *</label>
                  <SearchableSelect
                    required
                    allowEmpty={false}
                    value={selectedProject}
                    onChange={v => setSelectedProject(v)}
                    options={projectFormOptions}
                    placeholder="请选择项目"
                    {...PROJECT_SEARCH_PROPS}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">姓名 *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                    placeholder="请输入姓名"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">身份证号 *</label>
                  <input
                    type="text"
                    required
                    maxLength={18}
                    value={formData.id_card}
                    onChange={(e) => setFormData({ ...formData, id_card: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                    placeholder="请输入18位身份证号"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-500 mb-2">岗位</label>
                    <input
                      type="text"
                      value={formData.position}
                      onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                      placeholder="如：钢筋工"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-2">日工资标准(元)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.wage_standard === null ? '' : formData.wage_standard}
                      onChange={(e) => setFormData({ ...formData, wage_standard: e.target.value === '' ? null : parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">三级教育记录</label>
                  <textarea
                    value={formData.education_records}
                    onChange={(e) => setFormData({ ...formData, education_records: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                    rows={3}
                    placeholder="请填写三级教育记录..."
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                            className="px-4 py-2 bg-gray-500 hover:bg-slate-500 text-gray-800 rounded-lg"
                  >
                    取消
                  </button>
                  <button type="submit" className="px-4 py-2 bg-green-600 hover:bg-green-700 text-gray-800 rounded-lg">
                    保存
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
