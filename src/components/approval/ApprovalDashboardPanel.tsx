import type { ApprovalDashboardStats } from '../../services/approvalPhase3Service';

type Props = {
  stats: ApprovalDashboardStats | null;
  loading: boolean;
};

export default function ApprovalDashboardPanel({ stats, loading }: Props) {
  if (loading) {
    return <div className="text-center py-8 text-slate-500">加载中...</div>;
  }
  if (!stats) {
    return <div className="text-center py-8 text-slate-500">暂无统计数据</div>;
  }

  const cards = [
    { label: '我的待办', value: stats.pendingCount, color: 'text-blue-600' },
    { label: '今日已审', value: stats.todayApproved, color: 'text-green-600' },
    { label: '本周已审', value: stats.weekApproved, color: 'text-green-600' },
    { label: '本月已审', value: stats.monthApproved, color: 'text-gray-700' },
    {
      label: '待办平均等待(h)',
      value: stats.avgPendingHours,
      color: 'text-amber-600',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className="bg-gray-50 rounded-lg p-4 border border-gray-200 text-center"
          >
            <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
            <div className="text-sm text-gray-500 mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">待办按业务分布</h4>
        {stats.bySourceType.length === 0 ? (
          <p className="text-sm text-gray-500">当前无待办</p>
        ) : (
          <div className="space-y-2">
            {stats.bySourceType.map((row) => (
              <div
                key={row.source_type}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <span className="text-gray-800">{row.label}</span>
                <span className="text-blue-600 font-medium">{row.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
