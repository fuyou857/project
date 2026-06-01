import React, { useState, useEffect, useCallback } from 'react';
import { DrillDownButton } from './DrillDownButton';
import { supabase } from '../supabase/client';

interface CostDetail {
  project_id: string;
  project_name: string;
  material_cost: number;
  machine_cost: number;
  labor_cost: number;
  total_cost: number;
}

interface CostDetailItem {
  id: string;
  project_id: string;
  cost_type: string;
  amount: number;
  source_id: string;
  source_type: string;
  created_at: string;
}

type CostType = 'material' | 'machine' | 'labor';

const COST_TYPE_LABELS: Record<string, string> = {
  material: '材料费',
  machine: '机械费',
  labor: '人工费',
  other: '其他费用',
};

const COST_TYPE_SUPPLY_CATEGORY: Record<string, string> = {
  material: '材料',
  machine: '机械',
  labor: '人工',
};

interface ProjectCostDrillDownProps {
  projectId: string;
  projectName: string;
}

export function ProjectCostDrillDown({ projectId, projectName }: ProjectCostDrillDownProps) {
  const [open, setOpen] = useState(false);
  const [cost, setCost] = useState<CostDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | CostType>('overview');
  const [costDetails, setCostDetails] = useState<{
    material: CostDetailItem[],
    machine: CostDetailItem[],
    labor: CostDetailItem[]
  }>({
    material: [],
    machine: [],
    labor: []
  });

  const formatMoney = (val: number) =>
    new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(val || 0);

  const fetchCostAndDetails = useCallback(async () => {
    setLoading(true);
    try {
      // 1. 获取成本汇总
      const { data: costSummary } = await supabase
        .from('project_cost_summary')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle();
      
      if (costSummary) {
        setCost(costSummary as unknown as CostDetail);
      }

      // 2. 获取所有成本明细
      const { data: details } = await supabase
        .from('project_costs')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      const detailsList = (details || []) as unknown as CostDetailItem[];
      setCostDetails({
        material: detailsList.filter(d => d.cost_type === 'material'),
        machine: detailsList.filter(d => d.cost_type === 'machine'),
        labor: detailsList.filter(d => d.cost_type === 'labor')
      });
    } catch (e) {
      console.error('获取成本数据失败:', e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const handleOpen = useCallback(() => {
    setOpen(true);
    setActiveTab('overview');
    fetchCostAndDetails();
  }, [fetchCostAndDetails]);

  const handleClose = useCallback(() => {
    try {
      setOpen(false);
    } catch (err) {
      console.error('[ProjectCostDrillDown] handleClose failed', err);
      setOpen(false);
    }
  }, []);

  if (!open) {
    return (
      <DrillDownButton
        count={cost ? formatMoney(cost.total_cost) : '查看'}
        label="总成本"
        onClick={handleOpen}
      />
    );
  }

  const currentDetails = activeTab === 'overview' 
    ? [] 
    : costDetails[activeTab];
  
  const currentTotal = activeTab === 'overview'
    ? (cost?.total_cost || 0)
    : currentDetails.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={handleClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-900">项目成本 - {projectName}</h3>
          <button 
            type="button" 
            onClick={handleClose} 
            className="p-1 text-slate-400 hover:text-slate-600"
            aria-label="关闭"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 px-6">
          <div className="flex space-x-4 -mb-px">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-3 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'overview'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              概览
            </button>
            <button
              onClick={() => setActiveTab('material')}
              className={`py-3 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'material'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              材料费 ({costDetails.material.length})
            </button>
            <button
              onClick={() => setActiveTab('machine')}
              className={`py-3 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'machine'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              机械费 ({costDetails.machine.length})
            </button>
            <button
              onClick={() => setActiveTab('labor')}
              className={`py-3 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'labor'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              人工费 ({costDetails.labor.length})
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-8 text-slate-500">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
              <p className="mt-2">加载中...</p>
            </div>
          ) : activeTab === 'overview' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                {(['material', 'machine', 'labor'] as CostType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setActiveTab(type)}
                    className="p-4 rounded-lg border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all text-left cursor-pointer"
                  >
                    <div className="text-sm text-slate-500 mb-1">{COST_TYPE_LABELS[type]}</div>
                    <div className="text-xl font-bold text-slate-800">
                      {formatMoney(cost?.[`${type}_cost` as keyof CostDetail] as number || 0)}
                    </div>
                    <div className="text-xs text-blue-500 mt-2">查看明细 →</div>
                  </button>
                ))}
              </div>
              <div className="mt-6 p-4 bg-blue-50 rounded-lg text-center">
                <span className="text-slate-600">总成本合计：</span>
                <span className="text-2xl font-bold text-blue-700 ml-2">{formatMoney(cost?.total_cost || 0)}</span>
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <span className="font-medium">{COST_TYPE_LABELS[activeTab]} 合计：</span>
                <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded text-lg font-bold">
                  {formatMoney(currentTotal)}
                </span>
              </div>

              {currentDetails.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  暂无{COST_TYPE_LABELS[activeTab]}明细
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-slate-500">
                        <th className="py-2 px-2">金额</th>
                        <th className="py-2 px-2">来源类型</th>
                        <th className="py-2 px-2">记录时间</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentDetails.map((item) => (
                        <tr key={item.id} className="border-b border-slate-100">
                          <td className="py-2 px-2 text-right text-red-600 font-medium">
                            {formatMoney(Number(item.amount))}
                          </td>
                          <td className="py-2 px-2 text-slate-700">
                            {item.source_type === 'cost_invoice' ? '成本发票' : item.source_type}
                          </td>
                          <td className="py-2 px-2 text-slate-500">
                            {new Date(item.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
