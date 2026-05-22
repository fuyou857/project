import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPlus, FaUpload, FaEdit, FaTrash, FaPaperclip, FaTimes } from 'react-icons/fa';
import { SearchableSelect } from '../../components/ui';
import { projectSelectOptions } from '../../components/ui/options';

const mockProjects = [
  { id: '1', name: '星河湾小区工程' },
  { id: '2', name: '市政道路改造' },
  { id: '3', name: '商业综合体' },
];

const mockTeams = [
  { id: '1', name: '钢筋班组' },
  { id: '2', name: '木工班组' },
  { id: '3', name: '水电班组' },
];

type OutputReportRow = {
  id: string;
  projectId: string;
  projectName: string;
  teamName: string;
  month: string;
  amount: number;
  content: string;
  status: string;
  attachments: string[];
  reporter: string;
  remark: string;
};

const mockReports: OutputReportRow[] = [
  { id: '1', projectId: '1', projectName: '星河湾小区工程', teamName: '钢筋班组', month: '2024-03', amount: 150000, content: '3号楼主体结构施工', status: 'pending', attachments: [], reporter: '张三', remark: '' },
  { id: '2', projectId: '2', projectName: '市政道路改造', teamName: '木工班组', month: '2024-02', amount: 80000, content: '道路两侧模板安装', status: 'approved', attachments: [], reporter: '李四', remark: '' },
];

export default function OutputReport() {
  const [reports, setReports] = useState<OutputReportRow[]>(mockReports);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<{
    projectId: string;
    teamName: string;
    month: string;
    amount: number | null;
    content: string;
    attachments: string[];
    reporter: string;
    remark: string;
  }>({
    projectId: '', teamName: '', month: new Date().toISOString().slice(0, 7), amount: null, content: '', attachments: [], reporter: '当前用户', remark: '',
  });

  const handleSubmit = () => {
    if (!formData.projectId || !formData.amount) {
      alert('请填写必填项');
      return;
    }
    const project = mockProjects.find(p => p.id === formData.projectId);
    const newReport = {
      id: String(Date.now()),
      projectId: formData.projectId,
      projectName: project?.name || '',
      teamName: formData.teamName,
      month: formData.month,
      amount: formData.amount,
      content: formData.content,
      status: 'pending',
      attachments: formData.attachments,
      reporter: formData.reporter,
      remark: formData.remark,
    };
    setReports([newReport, ...reports]);
    setShowModal(false);
    setFormData({ projectId: '', teamName: '', month: new Date().toISOString().slice(0, 7), amount: null, content: '', attachments: [], reporter: '当前用户', remark: '' });
  };

  const handleDelete = (id: string) => {
    setReports(reports.filter(r => r.id !== id));
  };

  const statusMap: Record<string, { label: string; color: string }> = {
    pending: { label: '待审核', color: 'bg-yellow-500' },
    approved: { label: '已审核', color: 'bg-green-500' },
    rejected: { label: '已驳回', color: 'bg-red-500' },
  };

  const projectOptions = useMemo(() => projectSelectOptions(mockProjects, '请选择项目'), []);
  const teamOptions = useMemo(
    () => [{ value: '', label: '请选择班组' }, ...mockTeams.map(t => ({ value: t.name, label: t.name }))],
    [],
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-800">产值上报</h3>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-gray-800 rounded-lg">
          <FaPlus /> 新增上报
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-gray-700">
              <th className="px-4 py-3 text-left">项目</th>
              <th className="px-4 py-3 text-left">班组</th>
              <th className="px-4 py-3 text-left">产值月份</th>
              <th className="px-4 py-3 text-right">产值金额</th>
              <th className="px-4 py-3 text-center">状态</th>
              <th className="px-4 py-3 text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            {reports.map(r => (
              <tr key={r.id} className="border-t border-gray-200 text-gray-700 hover:bg-gray-50/50">
                <td className="px-4 py-3 text-gray-800">{r.projectName}</td>
                <td className="px-4 py-3">{r.teamName}</td>
                <td className="px-4 py-3">{r.month}</td>
                <td className="px-4 py-3 text-right text-green-400">¥{r.amount.toLocaleString()}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 rounded text-xs text-gray-800 ${statusMap[r.status]?.color}`}>
                    {statusMap[r.status]?.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    {r.status === 'pending' && (
                      <>
                        <button className="p-2 text-blue-400 hover:bg-gray-500 rounded"><FaEdit /></button>
                        <button onClick={() => handleDelete(r.id)} className="p-2 text-red-400 hover:bg-gray-500 rounded"><FaTrash /></button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={(e) => { e.stopPropagation(); }}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white rounded-xl p-6 w-full max-w-lg border border-gray-200" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-gray-800">产值上报</h3>
                <button onClick={(e) => { e.stopPropagation(); }} className="text-gray-500 hover:text-gray-800"><FaTimes /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="ui-label mb-2 block">项目名称 *</label>
                  <SearchableSelect
                    allowEmpty={false}
                    value={formData.projectId}
                    onChange={v => setFormData({ ...formData, projectId: v })}
                    options={projectOptions}
                    placeholder="请选择项目"
                    searchPlaceholder="搜索项目…"
                  />
                </div>
                <div>
                  <label className="ui-label mb-2 block">班组名称</label>
                  <SearchableSelect
                    value={formData.teamName}
                    onChange={v => setFormData({ ...formData, teamName: v })}
                    options={teamOptions}
                    placeholder="请选择班组"
                    emptyLabel="请选择班组"
                    searchThreshold={4}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-500 text-sm mb-2">产值月份 *</label>
                    <input type="month" value={formData.month} onChange={e => setFormData({ ...formData, month: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 text-gray-800 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-gray-500 text-sm mb-2">产值金额 *</label>
                    <input type="number" value={formData.amount ?? ''} onChange={e => setFormData({ ...formData, amount: e.target.value === '' ? null : Number(e.target.value) })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 text-gray-800 rounded-lg" />
                  </div>
                </div>
                <div>
                  <label className="block text-gray-500 text-sm mb-2">详细内容</label>
                  <textarea value={formData.content} onChange={e => setFormData({ ...formData, content: e.target.value })} rows={3} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 text-gray-800 rounded-lg resize-none" />
                </div>
                <div>
                  <label className="block text-gray-500 text-sm mb-2">凭证附件 (最多5个)</label>
                  <label className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg cursor-pointer hover:bg-gray-500">
                    <FaUpload className="text-gray-500" />
                    <span className="text-gray-500 text-sm">上传附件</span>
                    <input type="file" multiple accept="image/*,.pdf" className="hidden" />
                  </label>
                </div>
                <div>
                  <label className="block text-gray-500 text-sm mb-2">备注</label>
                  <input type="text" value={formData.remark} onChange={e => setFormData({ ...formData, remark: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 text-gray-800 rounded-lg" />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={(e) => { e.stopPropagation(); }} className="px-4 py-2 bg-gray-50 text-gray-800 rounded-lg hover:bg-gray-500">取消</button>
                <button onClick={handleSubmit} className="px-4 py-2 bg-blue-600 text-gray-800 rounded-lg hover:bg-blue-700">提交</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
