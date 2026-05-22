import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase/client';
import { useAuth } from '../../hooks/useAuth';
import { useApp } from '../../stores';
import { fetchTodoTasks, type TaskRow } from '../../services/taskService';
import { resolveUiStatus, uiStatusLabel, uiStatusClass, daysUntilDeadline } from './taskDisplay';
import {
  normalizePriority,
  PRIORITY_COLOR,
  PRIORITY_LABEL,
  sortTodoTasks,
  type TaskSortMode } from
'./taskPriority';
import { SearchableSelect, SegmentedControl } from '../../components/ui';
import { projectSelectOptions } from '../../components/ui/options';

interface ProjectOpt {
  id: string;
  name: string | null;
}

export default function TodoTasksPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentCompany } = useApp();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [publisherNames, setPublisherNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{type: 'ok' | 'err';text: string;} | null>(null);
  const [filterProject, setFilterProject] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [sortMode, setSortMode] = useState<TaskSortMode>('smart');
  const [projects, setProjects] = useState<ProjectOpt[]>([]);

  const uid = user?.id ?? '';

  useEffect(() => {
    if (!currentCompany) return;
    void (async () => {
      const { data } = await supabase.from('projects').select('id,name').order('name');
      setProjects((data ?? []) as ProjectOpt[]);
    })();
  }, [currentCompany]);

  const load = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const list = await fetchTodoTasks(uid);
      const pubIds = [...new Set(list.map((t) => t.publisher_id))];
      let nameMap: Record<string, string> = {};
      if (pubIds.length) {
        const { data: users } = await supabase.
        from('users').
        select('id,real_name,username').
        in('id', pubIds);
        nameMap = Object.fromEntries(
          (users ?? []).map((u: {id: string;real_name: string | null;username: string;}) => [
          u.id,
          u.real_name || u.username]
          )
        );
      }
      setPublisherNames(nameMap);
      setTasks(list);
    } catch (e) {
      setToast({ type: 'err', text: (e as Error).message || '加载失败' });
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (filterProject && t.project_id !== filterProject) return false;
      const ui = resolveUiStatus(t);
      if (filterStatus === 'in_progress' && ui !== 'in_progress') return false;
      if (filterStatus === 'pending_acceptance' && ui !== 'pending_acceptance') return false;
      if (filterStatus === 'completed' && ui !== 'completed') return false;
      if (filterStatus === 'overdue' && ui !== 'overdue') return false;
      if (filterPriority !== 'all' && normalizePriority(t.priority) !== filterPriority) return false;
      return true;
    });
  }, [tasks, filterProject, filterStatus, filterPriority]);

  const displayRows = useMemo(() => sortTodoTasks(filtered, sortMode), [filtered, sortMode]);

  const overdueBanner = displayRows.some((t) => resolveUiStatus(t) === 'overdue');

  const projectFilterOptions = useMemo(
    () => projectSelectOptions(projects.map((p) => ({ id: p.id, name: p.name || p.id })), '全部'),
    [projects]
  );

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-800">我的待办任务</h2>

      {overdueBanner &&
      <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 px-4 py-2 text-sm">
          您有待办任务已超过验收日，请尽快处理。
        </div>
      }

      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-wrap gap-3 items-end">
        <div className="min-w-[11rem] flex-1">
          <span className="mb-1 block text-sm text-gray-600">项目</span>
          <SearchableSelect
            value={filterProject}
            onChange={setFilterProject}
            options={projectFilterOptions}
            placeholder="全部"
            emptyLabel="全部"
            searchPlaceholder="搜索项目…"
            metricsContext="page:todo_tasks:filter_project"
            searchThreshold={6} />
          
        </div>
        <div className="min-w-0">
          <span className="mb-1 block text-sm text-gray-600">状态</span>
          <SegmentedControl
            value={filterStatus}
            onChange={(v) => setFilterStatus(v)}
            options={[
            { value: 'all', label: '全部' },
            { value: 'in_progress', label: '进行中' },
            { value: 'pending_acceptance', label: '待验收' },
            { value: 'completed', label: '已完成' },
            { value: 'overdue', label: '已逾期' }]
            }
            metricsContext="page:todo_tasks:filter_status"
            aria-label="任务状态" />
          
        </div>
        <div className="min-w-0">
          <span className="mb-1 block text-sm text-gray-600">优先级</span>
          <SegmentedControl
            value={filterPriority}
            onChange={(v) => setFilterPriority(v)}
            options={[
            { value: 'all', label: '全部' },
            { value: 'urgent', label: '紧急' },
            { value: 'high', label: '高' },
            { value: 'medium', label: '中' },
            { value: 'low', label: '低' }]
            }
            metricsContext="page:todo_tasks:filter_priority"
            aria-label="优先级" />
          
        </div>
        <div className="min-w-0 max-w-md flex-1">
          <span className="mb-1 block text-sm text-gray-600">排序</span>
          <SegmentedControl
            value={sortMode}
            onChange={(v) => setSortMode(v as TaskSortMode)}
            options={[
            { value: 'smart', label: '智能' },
            { value: 'priority_desc', label: '优先级↓' },
            { value: 'priority_asc', label: '优先级↑' },
            { value: 'deadline_asc', label: '验收日↑' }]
            }
            metricsContext="page:todo_tasks:sort_mode"
            aria-label="排序方式" />
          
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        {loading ?
        <div className="p-8 text-center text-gray-500">加载中…</div> :

        <table className="w-full min-w-[880px] text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left py-3 px-3">任务名称</th>
                <th className="text-center py-3 px-3 w-24">优先级</th>
                <th className="text-left py-3 px-3">发布人</th>
                <th className="text-left py-3 px-3">验收日期</th>
                <th className="text-left py-3 px-3 w-36">进度</th>
                <th className="text-center py-3 px-3">剩余天数</th>
                <th className="text-center py-3 px-3">状态</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.length === 0 ?
            <tr>
                  <td colSpan={7} className="text-center py-10 text-gray-400">
                    暂无待办
                  </td>
                </tr> :

            displayRows.map((t) => {
              const ui = resolveUiStatus(t);
              const pct = Math.min(100, Math.max(0, Number(t.total_progress) || 0));
              const days = daysUntilDeadline(t.acceptor_deadline);
              const rejected = Boolean(t.last_reject_opinion && t.status === 'in_progress');
              const urgentSoon = days >= 0 && days < 3 && ui !== 'completed';
              const pr = normalizePriority(t.priority);
              const urgentRow = pr === 'urgent' && ui !== 'completed';
              const rowBg = (() => {if (
                ui === 'overdue') {return (
                    'bg-red-50/80');} else {if (
                  urgentSoon) {return (
                      'bg-yellow-50/80');} else {if (
                    rejected) {return (
                        'bg-orange-50/40');} else {return (
                        '');}}}})();
              return (
                <tr
                  key={t.id}
                  className={
                  'border-t border-gray-100 hover:bg-gray-50 ' + rowBg + (urgentRow ? ' task-row-urgent' : '')
                  }>
                  
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                        type="button"
                        className="text-blue-600 hover:underline font-medium text-left"
                        onClick={() => navigate('/tasks/' + t.id)}>
                        
                            {t.task_name}
                          </button>
                          {rejected &&
                      <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-800">已驳回</span>
                      }
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                      className={
                      'inline-block px-2 py-0.5 rounded text-xs font-medium ' + (
                      pr === 'high' ? 'text-gray-900' : 'text-white')
                      }
                      style={{ backgroundColor: PRIORITY_COLOR[pr] }}>
                      
                          {PRIORITY_LABEL[pr]}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-700">{publisherNames[t.publisher_id] || '—'}</td>
                      <td className="py-3 px-3 text-gray-700">{t.acceptor_deadline?.slice(0, 10)}</td>
                      <td className="py-3 px-3">
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                        className={(() => {if (
                          ui === 'completed') {return (
                              'h-full bg-green-500 rounded-full');} else {if (
                            rejected) {return (
                                'h-full bg-orange-500 rounded-full');} else {return (
                                'h-full bg-blue-500 rounded-full');}}})()
                        }
                        style={{ width: `${pct}%` }} />
                      
                        </div>
                        <span className="text-xs text-gray-500">{pct.toFixed(0)}%</span>
                      </td>
                      <td className="py-3 px-3 text-center text-gray-700">
                        {(() => {if (ui === 'completed') {return '—';} else {if (days < 0) {return `逾期 ${-days} 天`;} else {return `${days} 天`;}}})()}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={'px-2 py-1 rounded text-xs ' + uiStatusClass(ui)}>{uiStatusLabel(ui)}</span>
                      </td>
                    </tr>);

            })
            }
            </tbody>
          </table>
        }
      </div>

      {toast &&
      <div
        className={
        'fixed bottom-6 right-6 z-[60] px-4 py-2 rounded-lg shadow-lg text-white ' + (
        toast.type === 'ok' ? 'bg-green-600' : 'bg-red-600')
        }>
        
          {toast.text}
          <button type="button" className="ml-3 underline" onClick={() => setToast(null)}>
            关闭
          </button>
        </div>
      }
    </div>);

}