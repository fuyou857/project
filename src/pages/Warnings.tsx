import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { useCompanyScope } from '../hooks/useCompanyScope';
import { projectIdsForCompanies } from '../utils/companyProjectScope';
import { SegmentedControl } from '../components/ui';
import { errorMessageFromUnknown } from '../utils/httpErrorMessage';

interface Alert {
  id: string;
  project_id?: string;
  alert_type: string;
  title: string;
  content: string;
  severity: 'warning' | 'critical';
  status: 'active' | 'resolved';
  source_id?: string;
  source_type?: string;
  created_at: string;
  resolved_at?: string;
  resolved_by?: string;
}

export default function Warnings() {
  const navigate = useNavigate();
  const { companyIds } = useCompanyScope();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{ type: string; message: string } | null>(null);

  const showToast = useCallback((type: string, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('alerts')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (companyIds.length > 0) {
        const projectIds = await projectIdsForCompanies(companyIds);
        if (projectIds.length > 0) {
          query = query.in('project_id', projectIds);
        }
      }
      
      if (filter === 'active') query = query.eq('status', 'active');
      if (filter === 'resolved') query = query.eq('status', 'resolved');
      
      const { data, error } = await query;
      if (error) {
        console.error('[Alerts fetchData error:', error);
        showToast('error', errorMessageFromUnknown(error, '加载预警数据失败'));
        setAlerts([]);
        return;
      }
      if (data) setAlerts(data as unknown as Alert[]);
    } catch (e) {
      console.error('[Alerts fetchData catch:', e);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [filter, companyIds, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleResolve(id: string) {
    try {
      const { error } = await supabase
        .from('alerts')
        .update({ status: 'resolved', resolved_at: new Date().toISOString() })
        .eq('id', id);
      if (error) {
        console.error('[Alerts handleResolve error:', error);
        showToast('error', '操作失败');
      } else {
        showToast('success', '已标记为已处理');
        fetchData();
      }
    } catch (e) {
      console.error('[Alerts handleResolve catch:', e);
      showToast('error', errorMessageFromUnknown(e, '操作失败'));
    }
  }

  const filtered = alerts.filter((alert) => {
    if (filter === 'active') return alert.status === 'active';
    if (filter === 'resolved') return alert.status === 'resolved';
    return true;
  }).filter((alert) =>
    !search ||
    alert.title.includes(search) ||
    alert.content.includes(search)
  );

  const activeCount = alerts.filter(alert => alert.status === 'active').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-gray-800">预警中心</h2>
          {activeCount > 0 && (
            <span className="px-2.5 py-0.5 bg-red-100 text-red-700 rounded-full text-sm font-medium">
              {activeCount} 条待处理
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <div className="relative min-w-[12rem] flex-1">
          <input
            type="text"
            placeholder="搜索预警..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <SegmentedControl
          value={filter as 'all' | 'active' | 'resolved'}
          onChange={(v) => setFilter(v)}
          options={[
            { value: 'all', label: '全部' },
            { value: 'active', label: '待处理' },
            { value: 'resolved', label: '已处理' },
          ]}
          className="flex-shrink-0"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
            <div className="text-gray-500 mt-2">加载中...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div>暂无预警</div>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map((alert) => (
              <div key={alert.id} className="p-4 flex items-start gap-3 hover:bg-gray-50">
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-gray-100">
                  <div className="w-6 h-6 bg-yellow-500 rounded-full"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                      {alert.alert_type}
                    </span>
                    <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
                      {alert.status === 'resolved' ? '已处理' : '待处理'}
                    </span>
                  </div>
                  <div className="text-gray-800 font-medium mt-1">{alert.title}</div>
                  <div className="text-gray-600 text-sm">{alert.content}</div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-gray-400 text-xs">{new Date(alert.created_at).toLocaleString()}</span>
                    <button
                      onClick={() => {
                        if (alert.source_type === 'expense_contract' && alert.project_id) {
                          navigate('/contract/expense/list');
                        } else if (alert.source_type === 'approval') {
                          navigate('/approval');
                        }
                      }}
                      className="text-blue-600 hover:text-blue-800 text-xs"
                    >
                      查看详情
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {alert.status === 'active' && (
                    <button
                      onClick={() => handleResolve(alert.id)}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="标记已处理"
                    >
                      ✓
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg ${
          toast.type === 'success' ? 'bg-green-600 text-white' :
          toast.type === 'info' ? 'bg-blue-600 text-white' :
          'bg-red-600 text-white'
        }`}>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
