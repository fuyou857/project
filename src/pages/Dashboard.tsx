import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FaProjectDiagram, FaHandshake, FaMoneyBillWave, FaExclamationTriangle, FaPlus, FaArrowRight, FaClipboardList, FaSyncAlt } from 'react-icons/fa';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { useCompany } from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { syncDeadlineNotifications } from '../services/notificationService';
import { fetchUpcomingInvolvedTasks, type TaskRow } from '../services/taskService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend } from 'recharts';
import { errorMessageFromUnknown } from '../utils/httpErrorMessage';

type DashboardProjectRow = { id: string; name?: string | null; created_at?: string | null };
type DashboardPaymentRow = {
  amount?: number | null;
  transfer_date?: string | null;
  payment_type?: string | null;
};
type DashboardInvoiceRow = {
  id: string;
  project_id?: string | null;
  invoice_number?: string | null;
  invoice_amount?: number | null;
  remaining_amount?: number | null;
  invoice_date?: string | null;
  is_paid?: boolean | null;
};
type DashboardWarningRow = {
  id: string;
  warning_type?: string | null;
  content?: string | null;
  project_id?: string | null;
  urgent?: boolean | null;
  created_at?: string | null;
};

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentCompany, companies } = useCompany();
  const [stats, setStats] = useState({ projectCount: 0, supplierCount: 0, monthExpense: 0, warningCount: 0 });
  const [upcomingTasks, setUpcomingTasks] = useState<TaskRow[]>([]);
  const [warnings, setWarnings] = useState<DashboardWarningRow[]>([]);
  const [unpaidInvoices, setUnpaidInvoices] = useState<DashboardInvoiceRow[]>([]);
  const [projects, setProjects] = useState<DashboardProjectRow[]>([]);
  const [payments, setPayments] = useState<DashboardPaymentRow[]>([]);
  const [invoices, setInvoices] = useState<DashboardInvoiceRow[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const getCompanyIds = useCallback(() => {
    if (!currentCompany) return [];
    const isParent = !currentCompany.parent_id || currentCompany.parent_id === '0';
    if (isParent) {
      const ids = [currentCompany.id];
      const children = companies.filter(c => c.parent_id === currentCompany.id);
      children.forEach(c => ids.push(c.id));
      return ids;
    }
    return [currentCompany.id];
  }, [currentCompany, companies]);

  const fetchData = useCallback(async () => {
    try {
      setFetchError(null);
      const companyIds = getCompanyIds();
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

      let projQuery = supabase.from('projects').select('id, created_at');
      if (companyIds.length > 0) {
        projQuery = projQuery.in('company_id', companyIds);
      }
      const projRes = await projQuery;
      if (projRes.error) {
        console.error('[Dashboard] projects', projRes.error);
        setFetchError(errorMessageFromUnknown(projRes.error, '加载项目数据失败'));
        return;
      }
      const projectIds = (projRes.data ?? []).map((p) => p.id);

      let invRes: { data: unknown[] | null; error: unknown };
      if (companyIds.length > 0 && projectIds.length === 0) {
        invRes = { data: [], error: null };
      } else {
        let invQuery = supabase
          .from('cost_invoices')
          .select('*')
          .order('id', { ascending: false })
          .limit(15);
        if (companyIds.length > 0) {
          invQuery = invQuery.in('project_id', projectIds);
        }
        invRes = await invQuery;
        if (invRes.error) console.error('[Dashboard] cost_invoices', invRes.error);
      }

      const [partyBRes, payRes, warnRes] = await Promise.all([
        supabase.from('party_b').select('id'),
        (async () => {
          if (companyIds.length > 0 && projectIds.length === 0) {
            return { data: [] as DashboardPaymentRow[], error: null };
          }
          let q = supabase
            .from('payment_records')
            .select('amount, transfer_date, payment_type')
            .order('id', { ascending: false })
            .limit(15);
          if (companyIds.length > 0) q = q.in('project_id', projectIds);
          const r = await q;
          if (r.error) console.error('[Dashboard] payment_records', r.error);
          return r;
        })(),
        (async () => {
          if (companyIds.length > 0 && projectIds.length === 0) {
            return { data: [] as DashboardWarningRow[], error: null };
          }
          let q = supabase
            .from('warnings')
            .select('*')
            .eq('status', 'pending')
            .order('id', { ascending: false })
            .limit(15);
          if (companyIds.length > 0) q = q.in('project_id', projectIds);
          const r = await q;
          if (r.error) console.error('[Dashboard] warnings', r.error);
          return r;
        })(),
      ]);

      setStats({
        projectCount: projRes.data?.length || 0,
        supplierCount: partyBRes.data?.length || 0,
        monthExpense: payRes.data?.filter(p => p.transfer_date >= firstDayOfMonth).reduce((sum, p) => sum + (p.amount || 0), 0) || 0,
        warningCount: warnRes.data?.length || 0,
      });
      const invoiceRows = (invRes.data ?? []) as DashboardInvoiceRow[];
      setWarnings((warnRes.data ?? []) as DashboardWarningRow[]);
      setUnpaidInvoices(invoiceRows.filter((i) => !i.is_paid));
      setProjects((projRes.data ?? []) as DashboardProjectRow[]);
      setPayments((payRes.data ?? []) as DashboardPaymentRow[]);
      setInvoices(invoiceRows);

      if (user?.id) {
        try {
          await syncDeadlineNotifications(user.id);
          const up = await fetchUpcomingInvolvedTasks(user.id, { companyIds, withinDays: 14 });
          setUpcomingTasks(up);
        } catch (e) {
          console.error('[Dashboard] tasks/notifications', e);
          setUpcomingTasks([]);
        }
      } else {
        setUpcomingTasks([]);
      }
    } catch (e) {
      console.error('[Dashboard] fetchData', e);
      setFetchError(errorMessageFromUnknown(e, '加载仪表盘数据失败，请刷新重试'));
    }
  }, [user?.id, getCompanyIds]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const formatMoney = (amount: number) => `¥${(amount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

  const statsData = [
    { label: '项目总数', value: stats.projectCount, icon: FaProjectDiagram, color: 'from-blue-500 to-blue-600', path: '/projects' },
    { label: '乙方单位', value: stats.supplierCount, icon: FaHandshake, color: 'from-green-500 to-green-600', path: '/party-b' },
    { label: '本月支出', value: formatMoney(stats.monthExpense), icon: FaMoneyBillWave, color: 'from-orange-500 to-orange-600', path: '/finance/payments' },
    { label: '待处理预警', value: stats.warningCount, icon: FaExclamationTriangle, color: 'from-red-500 to-red-600', path: '/warnings' },
  ];

  const getProjectName = (id: string) => projects.find(p => p.id === id)?.name || '-';

  const monthlyData = () => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const count = projects.filter(p => p.created_at?.startsWith(monthKey)).length;
      months.push({ month: `${d.getMonth() + 1}月`, projects: count });
    }
    return months;
  };

  const expenseData = () => {
    const categories: Record<string, number> = { '材料': 0, '人工': 0, '机械': 0, '其他': 0 };
    payments.forEach(p => {
      const type = p.payment_type || '其他';
      if (type.includes('材料')) categories['材料'] += p.amount || 0;
      else if (type.includes('人工') || type.includes('工资')) categories['人工'] += p.amount || 0;
      else if (type.includes('机械')) categories['机械'] += p.amount || 0;
      else categories['其他'] += p.amount || 0;
    });
    return Object.entries(categories).filter(([_, v]) => v > 0).map(([name, value]) => ({ name, value }));
  };

  const monthlyCompareData = () => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const income = invoices.filter(i => i.invoice_date?.startsWith(monthKey)).reduce((sum, i) => sum + (i.invoice_amount || 0), 0);
      const expense = payments.filter(p => p.transfer_date?.startsWith(monthKey)).reduce((sum, p) => sum + (p.amount || 0), 0);
      months.push({ month: `${d.getMonth() + 1}月`, 收入: income, 支出: expense });
    }
    return months;
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {fetchError && (
        <motion.div variants={item} className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FaExclamationTriangle className="text-red-500 w-5 h-5" />
            <span className="text-red-700 text-sm">{fetchError}</span>
          </div>
          <button
            onClick={() => void fetchData()}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
          >
            <FaSyncAlt className="w-3 h-3" />
            重试
          </button>
        </motion.div>
      )}
      <motion.div variants={item} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {statsData.map((stat) => (
          <motion.button
            key={stat.label}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(stat.path)}
            className="bg-white rounded-xl p-4 md:p-6 border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-500 transition-all text-left cursor-pointer relative"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-gray-500 text-sm">{stat.label}</div>
                <div className="text-2xl font-bold text-gray-800 mt-1">{stat.value}</div>
              </div>
              <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                <stat.icon className="w-5 h-5 md:w-6 md:h-6 text-gray-800" />
              </div>
            </div>
            <div className="absolute bottom-2 right-3 text-xs text-gray-400">实时统计</div>
          </motion.button>
        ))}
      </motion.div>

      {user?.id && (
        <motion.div variants={item} className="bg-white rounded-xl border border-amber-200 p-4 md:p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-100 pb-3 mb-3">
            <h3 className="text-lg font-semibold text-amber-950 flex items-center gap-2">
              <FaClipboardList className="text-amber-700" />
              即将到期任务（14 天内 · 我参与）
            </h3>
            <div className="flex items-center gap-3 text-sm">
              <Link to="/messages" className="text-blue-600 hover:text-blue-800">
                消息中心
              </Link>
              <Link to="/tasks/stats" className="text-blue-600 hover:text-blue-800">
                任务统计
              </Link>
            </div>
          </div>
          {upcomingTasks.length === 0 ? (
            <p className="text-sm text-gray-500">当前公司范围下暂无即将到期的参与任务。</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {upcomingTasks.slice(0, 10).map(t => (
                <li key={t.id} className="flex justify-between items-center gap-2 border-b border-gray-50 pb-2 last:border-0">
                  <button
                    type="button"
                    onClick={() => navigate(`/tasks/${t.id}`)}
                    className="text-left text-blue-700 hover:underline truncate font-medium"
                  >
                    {t.task_name}
                  </button>
                  <span className="text-gray-500 shrink-0 tabular-nums">{t.acceptor_deadline?.slice(0, 10)}</span>
                </li>
              ))}
            </ul>
          )}
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <motion.div variants={item} className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-gray-800 font-medium mb-4">项目趋势</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={monthlyData()}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8 }} labelStyle={{ color: '#374151' }} />
              <Line type="monotone" dataKey="projects" stroke="#3B82F6" strokeWidth={2} dot={{ fill: '#3B82F6' }} />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div variants={item} className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-gray-800 font-medium mb-4">支出占比</h3>
          {expenseData().length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={expenseData()} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {expenseData().map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8 }} formatter={(value: number) => formatMoney(value)} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="h-[220px] flex items-center justify-center text-gray-400">暂无数据</div>}
        </motion.div>
      </div>

      <motion.div variants={item} className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-gray-800 font-medium mb-4">月度收支对比</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={monthlyCompareData()}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="month" stroke="#6b7280" fontSize={12} />
            <YAxis stroke="#6b7280" fontSize={12} />
            <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8 }} formatter={(value: number) => formatMoney(value)} />
            <Legend />
            <Bar dataKey="收入" fill="#10B981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="支出" fill="#EF4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <motion.div variants={item} className="lg:col-span-2 bg-white rounded-xl border border-gray-200">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800">预警中心</h3>
            <button onClick={() => navigate('/warnings')} className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1">查看全部 <FaArrowRight className="w-3 h-3" /></button>
          </div>
          <div className="p-4 space-y-3">
            {warnings.length === 0 ? <div className="text-gray-400 text-center py-4">暂无预警</div> : warnings.slice(0, 4).map((warning) => (
              <motion.div key={warning.id} whileHover={{ x: 4 }} className={`p-4 rounded-lg border ${warning.urgent ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${warning.urgent ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'}`}>{warning.warning_type}</span>
                      <span className="text-gray-500 text-sm">{warning.project_id ? getProjectName(warning.project_id) : '-'}</span>
                    </div>
                    <div className="text-gray-800 mt-1">{warning.content}</div>
                  </div>
                  <span className="text-gray-400 text-xs">
                    {warning.created_at ? new Date(warning.created_at).toLocaleDateString() : '-'}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div variants={item} className="bg-white rounded-xl border border-gray-200">
          <div className="p-4 border-b border-gray-200"><h3 className="text-lg font-semibold text-gray-800">快捷操作</h3></div>
          <div className="p-4 space-y-3">
            {[
              { label: '新建项目', path: '/projects', icon: FaPlus },
              { label: '添加乙方单位', path: '/party-b', icon: FaPlus },
              { label: '录入发票', path: '/finance', icon: FaPlus },
              { label: '物资入库', path: '/materials', icon: FaPlus },
            ].map((action) => (
              <motion.button key={action.label} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => navigate(action.path)} className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-500 transition-colors">
                <span className="text-gray-700">{action.label}</span>
                <action.icon className="w-4 h-4 text-blue-600" />
              </motion.button>
            ))}
          </div>
        </motion.div>
      </div>

      <motion.div variants={item} className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-200"><h3 className="text-lg font-semibold text-gray-800">已开票未付款统计</h3></div>
        <div className="p-4">
          {unpaidInvoices.length === 0 ? (
            <div className="text-gray-400 text-center py-4">暂无未付款发票</div>
          ) : (
            <div className="mobile-table-wrapper overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500 text-sm">
                    <th className="text-left py-2 px-3">项目名称</th>
                    <th className="text-left py-2 px-3">发票编号</th>
                    <th className="text-right py-2 px-3">开票金额</th>
                    <th className="text-right py-2 px-3">尚欠金额</th>
                  </tr>
                </thead>
                <tbody>
                  {unpaidInvoices.slice(0, 5).map((inv) => (
                    <tr key={inv.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-3 text-gray-700">{getProjectName(inv.project_id ?? '')}</td>
                      <td className="py-2 px-3 text-gray-700">{inv.invoice_number || '-'}</td>
                      <td className="py-2 px-3 text-right text-green-600">{formatMoney(inv.invoice_amount ?? 0)}</td>
                      <td className="py-2 px-3 text-right text-yellow-600">{formatMoney(inv.remaining_amount ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
