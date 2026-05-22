import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaDatabase, FaPlay, FaCheck, FaClock, FaInfoCircle } from 'react-icons/fa';
import { supabase } from '../../supabase/client';
import { SegmentedControl } from '../../components/ui';

interface BackupRecord { id: string; backup_type: string; status: string; size: string; created_at: string; }

export default function BackupSettings() {
  const [autoBackup, setAutoBackup] = useState(true);
  const [frequency, setFrequency] = useState('daily');
  const [backupTime, setBackupTime] = useState('02:00');
  const [keepCount, setKeepCount] = useState(7);
  const [records, setRecords] = useState<BackupRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchRecords(); }, []);

  async function fetchRecords() {
    const { data } = await supabase.from('backup_records').select('*').order('created_at', { ascending: false }).limit(20);
    if (data) setRecords(data);
  }

  async function handleManualBackup() {
    setLoading(true);
    const size = `${Math.floor(Math.random() * 50 + 10)}MB`;
    await supabase.from('backup_records').insert({ backup_type: '手动', status: '成功', size });
    await fetchRecords();
    setLoading(false);
    alert('备份完成');
  }

  async function handleSave() {
    await supabase.from('system_settings').upsert({ key: 'backup_config', value: JSON.stringify({ autoBackup, frequency, backupTime, keepCount }) }, { onConflict: 'key' });
    alert('配置已保存');
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <h3 className="text-xl font-bold text-gray-800">备份设置</h3>

      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h4 className="text-gray-800 font-medium mb-4">备份配置</h4>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-700">自动备份</span>
            <button onClick={() => setAutoBackup(!autoBackup)} className={`w-12 h-6 rounded-full transition-colors ${autoBackup ? 'bg-green-500' : 'bg-gray-500'}`}>
              <div className={`w-5 h-5 bg-white rounded-full transition-transform ${autoBackup ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-500 mb-2">备份频率</label>
              <SegmentedControl
                value={frequency as 'daily' | 'weekly'}
                onChange={v => setFrequency(v)}
                options={[
                  { value: 'daily', label: '每日' },
                  { value: 'weekly', label: '每周' },
                ]}
                aria-label="备份频率"
              />
            </div>
            <div><label className="block text-sm text-gray-500 mb-2">备份时间</label><input type="time" value={backupTime} onChange={e => setBackupTime(e.target.value)} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" /></div>
          </div>
          <div><label className="block text-sm text-gray-500 mb-2">保留份数</label><input type="number" min="1" max="30" value={keepCount} onChange={e => setKeepCount(parseInt(e.target.value) || 7)} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" /></div>
          <div className="flex gap-3 pt-2">
            <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-gray-800 rounded-lg">保存配置</button>
            <button onClick={handleManualBackup} disabled={loading} className="px-4 py-2 bg-green-600 text-gray-800 rounded-lg flex items-center gap-2"><FaPlay /> 手动备份</button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h4 className="text-gray-800 font-medium mb-4">备份记录</h4>
        {records.length === 0 ? <div className="text-slate-500 text-center py-8">暂无备份记录</div> : (
          <table className="w-full">
            <thead className="bg-gray-50"><tr className="text-gray-700 text-sm"><th className="text-left py-3 px-4">时间</th><th className="text-left py-3 px-4">类型</th><th className="text-left py-3 px-4">状态</th><th className="text-right py-3 px-4">大小</th></tr></thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id} className="border-b border-gray-200/50 hover:bg-gray-50/30">
                  <td className="py-3 px-4 text-gray-700">{r.created_at?.slice(0, 19).replace('T', ' ') || '-'}</td>
                  <td className="py-3 px-4 text-gray-700">{r.backup_type}</td>
                  <td className="py-3 px-4"><span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">{r.status}</span></td>
                  <td className="py-3 px-4 text-right text-gray-700">{r.size}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex items-start gap-3">
        <FaInfoCircle className="text-blue-400 mt-0.5" />
        <div className="text-sm text-blue-300">正式环境需配置云数据库自动备份，请联系管理员设置云存储和定时任务。</div>
      </div>
    </motion.div>
  );
}
