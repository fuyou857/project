import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCheck, FaTimes, FaEye, FaFilter } from 'react-icons/fa';

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

type OutputAuditRow = {
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
  createdAt: string;
  rejectReason?: string;
};

const mockReports: OutputAuditRow[] = [
  { id: '1', projectId: '1', projectName: '星河湾小区工程', teamName: '钢筋班组', month: '2024-03', amount: 85000, content: '3号楼主体结构钢筋绑扎', status: 'pending', attachments: ['凭证1.jpg'], reporter: '张三', createdAt: '2024-03-20' },
  { id: '2', projectId: '2', projectName: '市政道路改造', teamName: '木工班组', month: '2024-03', amount: 62000, content: '道路两侧模板安装', status: 'approved', attachments: [], reporter: '李四', createdAt: '2024-03-18' },
  { id: '3', projectId: '1', projectName: '星河湾小区工程', teamName: '水电班组', month: '2024-02', amount: 45000, content: '2号楼水电预埋', status: 'rejected', attachments: [], rejectReason: '产值偏低', reporter: '王五', createdAt: '2024-02-25' },
];

export default function OutputAudit() {
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [reports, setReports] = useState<OutputAuditRow[]>(mockReports);
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showDetail, setShowDetail] = useState<OutputAuditRow | null>(null);

  const filteredReports = filter === 'all' ? reports : reports.filter(r => r.status === filter);

  const handleApprove = (id: string) => {
    setReports(reports.map(r => r.id === id ? { ...r, status: 'approved' } : r));
  };

  const handleReject = (id: string) => {
    setReports(reports.map(r => r.id === id ? { ...r, status: 'rejected', rejectReason } : r));
    setShowRejectModal(null);
    setRejectReason('');
  };

  const statusMap: Record<string, { label: string; color: string }> = {
    pending: { label: '待审核', color: 'bg-yellow-500' },
    approved: { label: '已通过', color: 'bg-green-500' },
    rejected: { label: '已驳回', color: 'bg-red-500' },
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-800">产值审核</h3>
        <div className="flex gap-2">
          {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-sm ${filter === f ? 'bg-blue-600 text-gray-800' : 'bg-gray-50 text-gray-500 hover:text-gray-800'}`}>
              {f === 'all' ? '全部' : statusMap[f].label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-gray-500 text-sm border-b border-gray-200">
              <th className="pb-3 font-medium">项目</th>
              <th className="pb-3 font-medium">班组</th>
              <th className="pb-3 font-medium">月份</th>
              <th className="pb-3 font-medium text-right">产值金额</th>
              <th className="pb-3 font-medium">上报人</th>
              <th className="pb-3 font-medium text-center">状态</th>
              <th className="pb-3 font-medium text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredReports.map(report => (
              <motion.tr key={report.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-b border-gray-200/50 text-gray-800">
                <td className="py-4">{report.projectName}</td>
                <td className="py-4">{report.teamName}</td>
                <td className="py-4">{report.month}</td>
                <td className="py-4 text-right text-green-400">¥{report.amount.toLocaleString()}</td>
                <td className="py-4">{report.reporter}</td>
                <td className="py-4 text-center">
                  <span className={`px-2 py-1 rounded text-xs text-gray-800 ${statusMap[report.status].color}`}>
                    {statusMap[report.status].label}
                  </span>
                </td>
                <td className="py-4">
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={() => setShowDetail(report)} className="p-2 text-blue-400 hover:bg-gray-500 rounded"><FaEye /></button>
                    {report.status === 'pending' && (
                      <>
                        <button onClick={() => handleApprove(report.id)} className="p-2 text-green-400 hover:bg-gray-500 rounded"><FaCheck /></button>
                        <button onClick={() => setShowRejectModal(report.id)} className="p-2 text-red-400 hover:bg-gray-500 rounded"><FaTimes /></button>
                      </>
                    )}
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {showRejectModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowRejectModal(null)}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl p-6 w-full max-w-md border border-gray-200" onClick={e => e.stopPropagation()}>
              <h4 className="text-lg font-bold text-gray-800 mb-4">驳回原因</h4>
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="请输入驳回原因" rows={3} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 text-gray-800 rounded-lg resize-none" />
              <div className="flex justify-end gap-3 mt-4">
                <button onClick={() => setShowRejectModal(null)} className="px-4 py-2 text-gray-500 hover:text-gray-800">取消</button>
                <button onClick={() => handleReject(showRejectModal)} className="px-4 py-2 bg-red-600 text-gray-800 rounded-lg">确认驳回</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDetail && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowDetail(null)}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl p-6 w-full max-w-lg border border-gray-200" onClick={e => e.stopPropagation()}>
              <h4 className="text-lg font-bold text-gray-800 mb-4">产值详情</h4>
              <div className="space-y-3 text-gray-700">
                <div className="flex justify-between"><span>项目：</span><span className="text-gray-800">{showDetail.projectName}</span></div>
                <div className="flex justify-between"><span>班组：</span><span className="text-gray-800">{showDetail.teamName}</span></div>
                <div className="flex justify-between"><span>月份：</span><span className="text-gray-800">{showDetail.month}</span></div>
                <div className="flex justify-between"><span>金额：</span><span className="text-green-400">¥{showDetail.amount.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>上报人：</span><span className="text-gray-800">{showDetail.reporter}</span></div>
                <div className="flex justify-between"><span>上报时间：</span><span className="text-gray-800">{showDetail.createdAt}</span></div>
                <div><span className="text-gray-500">详细内容：</span><p className="text-gray-800 mt-1">{showDetail.content}</p></div>
                {showDetail.rejectReason && <div><span className="text-gray-500">驳回原因：</span><p className="text-red-400 mt-1">{showDetail.rejectReason}</p></div>}
              </div>
              <div className="flex justify-end mt-6">
                <button onClick={() => setShowDetail(null)} className="px-4 py-2 bg-gray-50 text-gray-800 rounded-lg hover:bg-gray-500">关闭</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
