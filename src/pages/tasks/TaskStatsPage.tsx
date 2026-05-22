import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaDownload, FaArrowRight } from 'react-icons/fa';
import { supabase } from '../../supabase/client';
import { useCompany } from '../../components/Layout';
import { useAuth } from '../../hooks/useAuth';
import type { TaskRow } from '../../services/taskService';
import { resolveUiStatus, uiStatusLabel } from './taskDisplay';
import { PRIORITY_LABEL, normalizePriority } from './taskPriority';
import { SearchableSelect } from '../../components/ui';
import { projectSelectOptions } from '../../components/ui/options';

type ProjectMini = { id: string; name: string; company_id: string };

function csvEscape(s: string): string {
  const t = String(s ?? '');
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

export default function TaskStatsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const uid = user?.id ?? '';
  const { currentCompany, companies } = useCompany();
  const [projects, setProjects] = useState<ProjectMini[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState<string>('');
  const [execTaskIds, setExecTaskIds] = useState<Set<string>>(new Set());
  const [ccTaskIds, setCcTaskIds] = useState<Set<string>>(new Set());

  const companyIds = useMemo(() => {
    if (!currentCompany) return [];
    const isParent = !currentCompany.parent_id || currentCompany.parent_id === '0';
    if (isParent) {
      const ids = [currentCompany.id];
      companies.filter(c => c.parent_id === currentCompany.id).forEach(c => ids.push(c.id));
      return ids;
    }
    return [currentCompany.id];
  }, [currentCompany, companies]);

  const load = useCallback(async () => {
    if (!companyIds.length) {
      setProjects([]);
      setTasks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: projRows, error: pErr } = await supabase
        .from('projects')
        .select('id,name,company_id')
        .in('company_id', companyIds);
      if (pErr) throw pErr;
      const plist = (projRows ?? []) as ProjectMini[];
      setProjects(plist);
      const pids = plist.map(p => p.id);
      if (!pids.length) {
        setTasks([]);
        return;
      }
      const { data: taskRows, error: tErr } = await supabase
        .from('tasks')
        .select('*')
        .in('project_id', pids)
        .eq('del_flag', 0);
      if (tErr) throw tErr;
      setTasks((taskRows ?? []) as TaskRow[]);
    } catch (e) {
      console.error(e);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [companyIds]);

  useEffect(() => {
    void load();
  }, [load]);

  const projectName = useMemo(() => {
    const m = new Map(projects.map(p => [p.id, p.name]));
    return (id: string) => m.get(id) || id.slice(0, 8);
  }, [projects]);

  const filteredTasks = useMemo(() => {
    if (!projectFilter) return tasks;
    return tasks.filter(t => t.project_id === projectFilter);
  }, [tasks, projectFilter]);

  const projectFilterOptions = useMemo(
    () => projectSelectOptions(projects.map(p => ({ id: p.id, name: p.name })), '全部项目'),
    [projects],
  );

  useEffect(() => {
    if (!uid || !filteredTasks.length) {
      setExecTaskIds(new Set());
      setCcTaskIds(new Set());
      return;
    }
    const ids = filteredTasks.map(t => t.id);
    let cancelled = false;
    void (async () => {
      const [ex, ccRes] = await Promise.all([
        supabase.from('task_executors').select('task_id').eq('user_id', uid).in('task_id', ids),
        supabase.from('task_cc').select('task_id').eq('user_id', uid).in('task_id', ids),
      ]);
      if (cancelled) return;
      setExecTaskIds(new Set((ex.data ?? []).map(r => r.task_id as string)));
      setCcTaskIds(new Set((ccRes.data ?? []).map(r => r.task_id as string)));
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, filteredTasks]);

  const byStatus = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of filteredTasks) {
      const lab = uiStatusLabel(resolveUiStatus(t));
      m[lab] = (m[lab] ?? 0) + 1;
    }
    return m;
  }, [filteredTasks]);

  const byPriority = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of filteredTasks) {
      const k = PRIORITY_LABEL[normalizePriority(t.priority)];
      m[k] = (m[k] ?? 0) + 1;
    }
    return m;
  }, [filteredTasks]);

  const myPerf = useMemo(() => {
    const published = filteredTasks.filter(t => t.publisher_id === uid).length;
    const completedAsPub = filteredTasks.filter(t => t.publisher_id === uid && t.status === 'completed').length;
    let executor = 0;
    let completedExec = 0;
    for (const t of filteredTasks) {
      if (execTaskIds.has(t.id)) {
        executor++;
        if (t.status === 'completed') completedExec++;
      }
    }
    const cc = filteredTasks.filter(t => ccTaskIds.has(t.id)).length;
    return { published, executor, completedExec, cc, completedAsPub };
  }, [filteredTasks, uid, execTaskIds, ccTaskIds]);

  function exportCsv() {
    const header = ['任务名称', '项目', '状态', '优先级', '验收日', '进度%', '发布人ID'];
    const lines = [
      header.map(csvEscape).join(','),
      ...filteredTasks.map(t =>
        [
          t.task_name,
          projectName(t.project_id),
          uiStatusLabel(resolveUiStatus(t)),
          PRIORITY_LABEL[normalizePriority(t.priority)],
          (t.acceptor_deadline || '').slice(0, 10),
          String(Math.round(Number(t.total_progress) || 0)),
          t.publisher_id,
        ]
          .map(csvEscape)
          .join(',')
      ),
    ];
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `任务统计_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (!uid) {
    return <div className="p-6 text-gray-500">请先登录</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">任务统计</h1>
        <button
          type="button"
          onClick={exportCsv}
          disabled={!filteredTasks.length}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 text-white text-sm disabled:opacity-40"
        >
          <FaDownload className="w-4 h-4" />
          导出 CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div className="flex flex-wrap items-center gap-2 text-gray-600">
          <span>项目筛选</span>
          <div className="min-w-[12rem] max-w-xs">
            <SearchableSelect
              value={projectFilter}
              onChange={setProjectFilter}
              options={projectFilterOptions}
              placeholder="全部项目"
              searchPlaceholder="搜索项目…"
            />
          </div>
        </div>
        <span className="text-gray-400">当前公司范围：{currentCompany?.name ?? '—'}</span>
      </div>

      {loading ? (
        <div className="text-gray-500">加载中…</div>
      ) : (
        <>
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="text-sm text-gray-500">按状态</div>
              <ul className="mt-2 text-sm space-y-1">
                {Object.entries(byStatus).map(([k, v]) => (
                  <li key={k} className="flex justify-between">
                    <span>{k}</span>
                    <span className="font-medium">{v}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="text-sm text-gray-500">按优先级</div>
              <ul className="mt-2 text-sm space-y-1">
                {Object.entries(byPriority).map(([k, v]) => (
                  <li key={k} className="flex justify-between">
                    <span>{k}</span>
                    <span className="font-medium">{v}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 shadow-sm">
              <div className="text-sm font-medium text-gray-800">我的绩效（当前筛选范围内）</div>
              <ul className="mt-2 text-sm space-y-1 text-gray-700">
                <li className="flex justify-between">
                  <span>我发布的任务</span>
                  <span className="font-medium">{myPerf.published}</span>
                </li>
                <li className="flex justify-between">
                  <span>其中已完成</span>
                  <span className="font-medium">{myPerf.completedAsPub}</span>
                </li>
                <li className="flex justify-between">
                  <span>我执行的任务</span>
                  <span className="font-medium">{myPerf.executor}</span>
                </li>
                <li className="flex justify-between">
                  <span>执行且已完成</span>
                  <span className="font-medium">{myPerf.completedExec}</span>
                </li>
                <li className="flex justify-between">
                  <span>抄送我的任务</span>
                  <span className="font-medium">{myPerf.cc}</span>
                </li>
              </ul>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
            <div className="px-4 py-2 border-b border-gray-100 text-sm font-medium text-gray-700">任务列表</div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left px-3 py-2">名称</th>
                    <th className="text-left px-3 py-2">项目</th>
                    <th className="text-left px-3 py-2">状态</th>
                    <th className="text-left px-3 py-2">优先级</th>
                    <th className="text-left px-3 py-2">验收日</th>
                    <th className="text-right px-3 py-2">进度</th>
                    <th className="w-24 px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map(t => (
                    <tr key={t.id} className="border-t border-gray-100 hover:bg-gray-50/80">
                      <td className="px-3 py-2 font-medium text-gray-900 max-w-[200px] truncate">{t.task_name}</td>
                      <td className="px-3 py-2 text-gray-600 max-w-[140px] truncate">{projectName(t.project_id)}</td>
                      <td className="px-3 py-2">{uiStatusLabel(resolveUiStatus(t))}</td>
                      <td className="px-3 py-2">{PRIORITY_LABEL[normalizePriority(t.priority)]}</td>
                      <td className="px-3 py-2">{(t.acceptor_deadline || '').slice(0, 10)}</td>
                      <td className="px-3 py-2 text-right">{Math.round(Number(t.total_progress) || 0)}%</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="text-blue-600 inline-flex items-center gap-1"
                          onClick={() => navigate(`/tasks/${t.id}`)}
                        >
                          详情 <FaArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filteredTasks.length && (
                <div className="px-4 py-8 text-center text-gray-400 text-sm">暂无任务数据</div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
