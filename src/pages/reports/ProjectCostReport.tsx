import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FaFileExcel, FaSearch, FaProjectDiagram, FaMoneyBillWave,
  FaTools, FaCogs, FaUsers, FaExternalLinkAlt
} from 'react-icons/fa';
import { supabase } from '../../supabase/client';
import { useCompanyScope } from '../../hooks/useCompanyScope';
import { projectIdsForCompanies } from '../../utils/companyProjectScope';
import { downloadJsonRowsAsXlsx } from '../../utils/excelSheet';

interface ProjectCostRow {
  project_id: string;
  project_name: string;
  material_cost: number;
  machine_cost: number;
  labor_cost: number;
  total_cost: number;
}

function formatMoney(val: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
  }).format(val || 0);
}

export default function ProjectCostReport() {
  const navigate = useNavigate();
  const { companyIds } = useCompanyScope();
  const [data, setData] = useState<ProjectCostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('project_cost_summary')
        .select('*')
        .order('total_cost', { ascending: false });

      if (companyIds.length > 0) {
        const pIds = await projectIdsForCompanies(companyIds);
        if (pIds.length === 0) {
          setData([]);
          return;
        }
        query = query.in('project_id', pIds);
      }

      const { data: result, error } = await query;
      if (error) {
        console.error('[ProjectCostReport] fetchData', error);
        setData([]);
        return;
      }
      setData((result as unknown as ProjectCostRow[]) || []);
    } catch (e) {
      console.error('[ProjectCostReport] fetchData', e);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [companyIds]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    return data.filter(row => {
      if (search && !row.project_name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [data, search]);

  const totalStats = useMemo(() => {
    return filtered.reduce(
      (acc, row) => ({
        material: acc.material + Number(row.material_cost || 0),
        machine: acc.machine + Number(row.machine_cost || 0),
        labor: acc.labor + Number(row.labor_cost || 0),
        total: acc.total + Number(row.total_cost || 0),
      }),
      { material: 0, machine: 0, labor: 0, total: 0 },
    );
  }, [filtered]);

  async function handleExport() {
    const rows = filtered.map(row => ({
      '项目名称': row.project_name,
      '材料成本': Number(row.material_cost || 0),
      '机械成本': Number(row.machine_cost || 0),
      '劳务成本': Number(row.labor_cost || 0),
      '总成本': Number(row.total_cost || 0),
    }));
    await downloadJsonRowsAsXlsx(rows, '项目成本报表', `项目成本报表_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FaMoneyBillWave className="text-2xl text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-800">项目成本报表</h2>
        </div>
        <button
          onClick={handleExport}
          disabled={filtered.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
        >
          <FaFileExcel /> 导出 Excel
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: '材料成本合计', value: totalStats.material, icon: FaTools, color: 'blue' },
          { label: '机械成本合计', value: totalStats.machine, icon: FaCogs, color: 'orange' },
          { label: '劳务成本合计', value: totalStats.labor, icon: FaUsers, color: 'green' },
          { label: '总成本合计', value: totalStats.total, icon: FaMoneyBillWave, color: 'red' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">{stat.label}</div>
                <div className={`text-xl font-bold mt-1 ${stat.color === 'red' ? 'text-red-600' : `text-${stat.color}-600`}`}>
                  {formatMoney(stat.value)}
                </div>
              </div>
              <stat.icon className={`text-3xl ${stat.color === 'red' ? 'text-red-200' : `text-${stat.color}-200`}`} />
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <div className="relative min-w-[12rem] flex-1">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="搜索项目名称..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ui-input w-full pl-10"
          />
        </div>
        <div className="text-sm text-gray-500">
          共 {filtered.length} 个项目
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="text-gray-500 text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 mb-2" />
            <div>加载中...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-gray-500 text-center py-12">
            <FaProjectDiagram className="mx-auto text-3xl mb-2 text-gray-300" />
            <div>暂无项目成本数据</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">项目名称</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">材料成本</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">机械成本</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">劳务成本</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">总成本</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((row) => (
                  <motion.tr
                    key={row.project_id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">
                      {row.project_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {formatMoney(Number(row.material_cost || 0))}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {formatMoney(Number(row.machine_cost || 0))}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {formatMoney(Number(row.labor_cost || 0))}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-gray-800">
                      {formatMoney(Number(row.total_cost || 0))}
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      <button
                        onClick={() => navigate(`/projects/${row.project_id}`)}
                        className="text-blue-600 hover:text-blue-800 flex items-center gap-1 mx-auto transition-colors"
                        title="查看项目详情"
                      >
                        <FaExternalLinkAlt className="w-3 h-3" />
                        穿透
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}