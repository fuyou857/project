import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaList, FaThLarge, FaSearch, FaUserTie, FaComments } from 'react-icons/fa';
import { supabase } from '../../supabase/client';
import { useAuth } from '../../hooks/useAuth';
import { useApp } from '../../stores';
import {
  fetchInvolvedTasks,
  type TaskRow,
  type TaskPriority } from
'../../services/taskService';
import { resolveUiStatus, uiStatusLabel, uiStatusClass } from './taskDisplay';
import TaskKanbanView from '../../components/TaskKanbanView';
import TaskCommentsPanel from '../../components/tasks/TaskCommentsPanel';
import { SearchableSelect, SegmentedControl } from '../../components/ui';
import { projectSelectOptions } from '../../components/ui/options';

interface ProjectOpt {
  id: string;
  name: string | null;
}

interface UserOpt {
  id: string;
  real_name: string | null;
  username: string;
}

export default function InvolvedTasksPage() {
  const navigate = useNavigate();
  const { user, isSuperAdmin } = useAuth();
  const { currentCompany } = useApp();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [execByTask, setExecByTask] = useState<Record<string, {user_id: string;member_role?: string | null;}[]>>({});
  const [ccByTask, setCcByTask] = useState<Record<string, {user_id: string;}[]>>({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{type: 'ok' | 'err';text: string;} | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [openCommentsTaskId, setOpenCommentsTaskId] = useState<string | null>(null);

  // 筛选状态
  const [filterProject, setFilterProject] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // 分页
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // 排序
  const [sortField, setSortField] = useState<'created_at' | 'acceptor_deadline' | 'task_name'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [userOptions, setUserOptions] = useState<UserOpt[]>([]);
  const [publisherNames, setPublisherNames] = useState<Record<string, string>>({});

  const userId = user?.id ?? '';

  const companyIds = useMemo(() => {
    if (!currentCompany) return [] as string[];
    const isParent = !currentCompany.parent_id || currentCompany.parent_id === '0';
    if (isParent) {
      const ch = (currentCompany as {child_companies?: {id: string;}[];}).child_companies;
      return ch?.length ? ch.map((c) => c.id) : [currentCompany.id];
    }
    return [currentCompany.id];
  }, [currentCompany]);

  useEffect(() => {
    if (!currentCompany) return;
    void (async () => {
      const { data } = await supabase.
      from('projects').
      select('id,name').
      in('company_id', companyIds).
      order('name');
      setProjects((data ?? []) as ProjectOpt[]);
    })();
  }, [currentCompany, companyIds]);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from('users').select('id,real_name,username').order('real_name');
      setUserOptions((data ?? []) as UserOpt[]);
    })();
  }, []);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const list = await fetchInvolvedTasks(userId);
      setTasks(list);
      const ids = list.map((t) => t.id);
      if (!ids.length) {
        setExecByTask({});
        setCcByTask({});
        setPublisherNames({});
        return;
      }
      const [execResult, ccResult, taskData] = await Promise.all([
      supabase.from('task_executors').select('task_id,user_id,member_role').in('task_id', ids),
      supabase.from('task_cc').select('task_id,user_id').in('task_id', ids),
      supabase.from('tasks').select('id,publisher_id').in('id', ids)]
      );

      // 构建执行人映射
      const execMap: Record<string, {user_id: string;member_role?: string | null;}[]> = {};
      for (const r of execResult.data ?? []) {
        const tid = r.task_id as string;
        if (!execMap[tid]) execMap[tid] = [];
        execMap[tid].push({
          user_id: r.user_id as string,
          member_role: (r as {member_role?: string | null;}).member_role
        });
      }
      setExecByTask(execMap);

      // 构建抄送人映射
      const ccMap: Record<string, {user_id: string;}[]> = {};
      for (const r of ccResult.data ?? []) {
        const tid = r.task_id as string;
        if (!ccMap[tid]) ccMap[tid] = [];
        ccMap[tid].push({ user_id: r.user_id as string });
      }
      setCcByTask(ccMap);

      // 构建发布人名称映射
      const publisherIds = new Set<string>();
      for (const t of taskData.data ?? []) {
        publisherIds.add(t.publisher_id as string);
      }
      if (publisherIds.size > 0) {
        const { data: publishers } = await supabase.
        from('users').
        select('id,real_name,username').
        in('id', Array.from(publisherIds));
        const nameMap: Record<string, string> = {};
        for (const u of publishers ?? []) {
          nameMap[u.id as string] = (u.real_name || u.username || u.id.slice(0, 8)) as string;
        }
        setPublisherNames(nameMap);
      }
    } catch (e) {
      setToast({ type: 'err', text: (e as Error).message || '加载失败' });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  // 排序和筛选
  const filteredAndSorted = useMemo(() => {
    let result = [...tasks];

    // 文本搜索
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter((t) =>
      t.task_name.toLowerCase().includes(query) ||
      t.description && t.description.toLowerCase().includes(query)
      );
    }

    // 项目筛选
    if (filterProject) {
      result = result.filter((t) => t.project_id === filterProject);
    }

    // 状态筛选
    if (filterStatus !== 'all') {
      result = result.filter((t) => {
        const ui = resolveUiStatus(t);
        return ui === filterStatus;
      });
    }

    // 优先级筛选
    if (filterPriority !== 'all') {
      result = result.filter((t) => t.priority === filterPriority);
    }

    // 日期筛选
    if (dateFrom) {
      result = result.filter((t) => t.created_at.slice(0, 10) >= dateFrom);
    }
    if (dateTo) {
      result = result.filter((t) => t.created_at.slice(0, 10) <= dateTo);
    }

    // 排序
    result.sort((a, b) => {
      let valA: string | number;
      let valB: string | number;

      switch (sortField) {
        case 'created_at':
          valA = a.created_at;
          valB = b.created_at;
          break;
        case 'acceptor_deadline':
          valA = a.acceptor_deadline;
          valB = b.acceptor_deadline;
          break;
        case 'task_name':
          valA = a.task_name.toLowerCase();
          valB = b.task_name.toLowerCase();
          break;
        default:
          valA = a.created_at;
          valB = b.created_at;
      }

      if (sortOrder === 'asc') {
        return (() => {if (valA < valB) {return -1;} else {if (valA > valB) {return 1;} else {return 0;}}})();
      } else {
        return (() => {if (valA > valB) {return -1;} else {if (valA < valB) {return 1;} else {return 0;}}})();
      }
    });

    return result;
  }, [tasks, searchQuery, filterProject, filterStatus, filterPriority, dateFrom, dateTo, sortField, sortOrder]);

  // 分页
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSorted.slice(start, start + pageSize);
  }, [filteredAndSorted, currentPage]);

  const totalPages = Math.ceil(filteredAndSorted.length / pageSize);

  function userLabel(id: string) {
    const u = userOptions.find((x) => x.id === id);
    return u?.real_name || u?.username || id.slice(0, 8);
  }

  // 判断用户在任务中的角色
  function getUserRole(task: TaskRow) {
    if (task.publisher_id === userId) return '发布人';
    const exs = execByTask[task.id] ?? [];
    const mine = exs.find((e) => e.user_id === userId);
    if (mine) {
      return mine.member_role === 'co_assistant' ? '协办' : '负责人';
    }
    const isCc = (ccByTask[task.id] ?? []).some((c) => c.user_id === userId);
    if (isCc) return '抄送人';
    return '参与人';
  }

  // 准备看板数据
  const kanbanData = useMemo(() => {
    const executorsByTask: Record<string, {user_id: string;name: string;}[]> = {};
    Object.entries(execByTask).forEach(([taskId, executors]) => {
      executorsByTask[taskId] = executors.map((e) => ({
        user_id: e.user_id,
        name: userLabel(e.user_id)
      }));
    });

    const projectNames: Record<string, string> = {};
    projects.forEach((p) => {
      projectNames[p.id] = p.name || '';
    });

    return { executorsByTask, projectNames };
  }, [execByTask, projects, userOptions]);

  const priorityConfig: Record<TaskPriority, {label: string;color: string;}> = {
    urgent: { label: '紧急', color: 'bg-red-100 text-red-700' },
    high: { label: '高', color: 'bg-orange-100 text-orange-700' },
    medium: { label: '中', color: 'bg-blue-100 text-blue-700' },
    low: { label: '低', color: 'bg-gray-100 text-gray-700' }
  };

  const involvedProjectFilterOptions = useMemo(
    () => projectSelectOptions(projects.map((p) => ({ id: p.id, name: p.name || p.id })), '全部'),
    [projects]
  );

  const sortSelectOptions = useMemo(
    () => [
    { value: 'created_at-desc', label: '最新创建' },
    { value: 'created_at-asc', label: '最早创建' },
    { value: 'acceptor_deadline-asc', label: '验收日升序' },
    { value: 'acceptor_deadline-desc', label: '验收日降序' },
    { value: 'task_name-asc', label: '任务名称' }],

    []
  );

  const sortComposite = `${sortField}-${sortOrder}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-gray-800">我参与的任务</h2>
        {/* 视图切换 */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 transition-all ${
            viewMode === 'list' ?
            'bg-white text-blue-600 shadow-sm' :
            'text-gray-600 hover:text-gray-800'}`
            }>
            
            <FaList className="w-4 h-4" />
            <span className="hidden sm:inline">列表</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('kanban')}
            className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 transition-all ${
            viewMode === 'kanban' ?
            'bg-white text-blue-600 shadow-sm' :
            'text-gray-600 hover:text-gray-800'}`
            }>
            
            <FaThLarge className="w-4 h-4" />
            <span className="hidden sm:inline">看板</span>
          </button>
        </div>
      </div>

      {/* 筛选区域 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <FaSearch className="w-3 h-3" />
              搜索
            </span>
            <input
              className="mt-1 block w-48 border rounded-lg px-2 py-1.5 text-gray-800"
              placeholder="任务名称/描述"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)} />
            
          </label>
          <div className="min-w-[10rem]">
            <span className="mb-1 block text-sm text-gray-600">项目</span>
            <SearchableSelect
              value={filterProject}
              onChange={setFilterProject}
              options={involvedProjectFilterOptions}
              placeholder="全部"
              emptyLabel="全部"
              searchPlaceholder="搜索项目…"
              metricsContext="page:involved_tasks:filter_project"
              searchThreshold={6} />
            
          </div>
          <div className="min-w-0">
            <span className="mb-1 block text-sm text-gray-600">状态</span>
            <SegmentedControl
              value={filterStatus}
              onChange={setFilterStatus}
              options={[
              { value: 'all', label: '全部' },
              { value: 'in_progress', label: '进行中' },
              { value: 'pending_acceptance', label: '待验收' },
              { value: 'completed', label: '已完成' },
              { value: 'overdue', label: '已逾期' }]
              }
              metricsContext="page:involved_tasks:filter_status"
              aria-label="任务状态" />
            
          </div>
          <div className="min-w-0">
            <span className="mb-1 block text-sm text-gray-600">优先级</span>
            <SegmentedControl
              value={filterPriority}
              onChange={setFilterPriority}
              options={[
              { value: 'all', label: '全部' },
              { value: 'urgent', label: '紧急' },
              { value: 'high', label: '高' },
              { value: 'medium', label: '中' },
              { value: 'low', label: '低' }]
              }
              metricsContext="page:involved_tasks:filter_priority"
              aria-label="优先级" />
            
          </div>
          <label className="text-sm text-gray-600">
            创建日起
            <input
              type="date"
              className="mt-1 block border rounded-lg px-2 py-1.5 text-gray-800"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)} />
            
          </label>
          <label className="text-sm text-gray-600">
            创建日止
            <input
              type="date"
              className="mt-1 block border rounded-lg px-2 py-1.5 text-gray-800"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)} />
            
          </label>
          <div className="min-w-[12rem] flex-1">
            <span className="mb-1 block text-sm text-gray-600">排序</span>
            <SearchableSelect
              allowEmpty={false}
              value={sortComposite}
              onChange={(v) => {
                const i = v.lastIndexOf('-');
                const field = v.slice(0, i) as 'created_at' | 'acceptor_deadline' | 'task_name';
                const order = v.slice(i + 1) as 'asc' | 'desc';
                setSortField(field);
                setSortOrder(order);
              }}
              options={sortSelectOptions}
              placeholder="排序"
              searchThreshold={10}
              metricsContext="page:involved_tasks:sort" />
            
          </div>
        </div>
      </div>

      {/* 主视图 */}
      {viewMode === 'list' ?
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
          {loading ?
        <div className="p-8 text-center text-gray-500">加载中…</div> :

        <>
              <table className="w-full min-w-[1000px] text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left py-3 px-3">任务名称</th>
                    <th className="text-left py-3 px-3">我的角色</th>
                    <th className="text-left py-3 px-3">发布人</th>
                    <th className="text-left py-3 px-3">优先级</th>
                    <th className="text-left py-3 px-3">验收日期</th>
                    <th className="text-left py-3 px-3 w-40">进度</th>
                    <th className="text-center py-3 px-3">状态</th>
                    <th className="text-center py-3 px-3 w-24">评论</th>
                    <th className="text-left py-3 px-3">创建时间</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ?
              <tr>
                      <td colSpan={9} className="text-center py-10 text-gray-400">
                        暂无任务
                      </td>
                    </tr> :

              paginated.map((t) => {
                const ui = resolveUiStatus(t);
                const pct = Math.min(100, Math.max(0, Number(t.total_progress) || 0));
                const priority = (t.priority || 'medium') as TaskPriority;
                const priorityStyle = priorityConfig[priority];
                const exRows = execByTask[t.id] ?? [];
                const canCommentHere =
                isSuperAdmin ||
                userId === t.publisher_id ||
                exRows.some((e) => e.user_id === userId);
                const commentsOpen = openCommentsTaskId === t.id;
                return (
                  <Fragment key={t.id}>
                          <tr className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-3">
                            <button
                          type="button"
                          className="text-blue-600 hover:underline font-medium text-left"
                          onClick={() => navigate('/tasks/' + t.id)}>
                          
                              {t.task_name}
                            </button>
                          </td>
                          <td className="py-3 px-3 text-gray-700">
                            <span className="flex items-center gap-1">
                              <FaUserTie className="w-3 h-3" />
                              {getUserRole(t)}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-gray-700">
                            {publisherNames[t.publisher_id] || '—'}
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-1 rounded text-xs ${priorityStyle.color}`}>
                              {priorityStyle.label}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-gray-700">{t.acceptor_deadline?.slice(0, 10)}</td>
                          <td className="py-3 px-3">
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                            className={(() => {if (
                              ui === 'completed') {return (
                                  'h-full bg-green-500 rounded-full');} else {if (
                                ui === 'overdue' || t.last_reject_opinion && t.status === 'in_progress') {return (
                                    'h-full bg-orange-500 rounded-full');} else {return (
                                    'h-full bg-blue-500 rounded-full');}}})()
                            }
                            style={{ width: `${pct}%` }} />
                          
                            </div>
                            <span className="text-xs text-gray-500">{pct.toFixed(0)}%</span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className={'px-2 py-1 rounded text-xs ' + uiStatusClass(ui)}>{uiStatusLabel(ui)}</span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <button
                          type="button"
                          className={
                          'p-2 rounded-lg ' + (
                          commentsOpen ? 'bg-blue-100 text-blue-800' : 'text-blue-600 hover:bg-blue-50')
                          }
                          title="任务评论"
                          aria-expanded={commentsOpen}
                          onClick={() => setOpenCommentsTaskId(commentsOpen ? null : t.id)}>
                          
                              <FaComments className="w-4 h-4 mx-auto" />
                            </button>
                          </td>
                          <td className="py-3 px-3 text-gray-600">
                            {t.created_at.slice(0, 16).replace('T', ' ')}
                          </td>
                        </tr>
                        {commentsOpen &&
                    <tr className="bg-slate-50/80">
                            <td colSpan={9} className="px-4 py-3 border-t border-gray-100">
                              <TaskCommentsPanel
                          taskId={t.id}
                          currentUserId={userId}
                          canPost={canCommentHere}
                          compact
                          onPosted={() => void load()} />
                        
                            </td>
                          </tr>
                    }
                      </Fragment>);

              })
              }
                </tbody>
              </table>

              {/* 分页 */}
              {totalPages > 1 &&
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    共 {filteredAndSorted.length} 条，第 {currentPage}/{totalPages} 页
                  </span>
                  <div className="flex gap-2">
                    <button
                type="button"
                disabled={currentPage <= 1}
                className="px-3 py-1 rounded border border-gray-300 text-sm text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
                
                      上一页
                    </button>
                    <button
                type="button"
                disabled={currentPage >= totalPages}
                className="px-3 py-1 rounded border border-gray-300 text-sm text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>
                
                      下一页
                    </button>
                  </div>
                </div>
          }
            </>
        }
        </div> :

      <TaskKanbanView
        tasks={filteredAndSorted}
        executorsByTask={kanbanData.executorsByTask}
        projectNames={kanbanData.projectNames}
        loading={loading} />

      }

      {/* Toast */}
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