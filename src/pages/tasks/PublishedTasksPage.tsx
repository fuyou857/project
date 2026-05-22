import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaPlus, FaBell, FaComments } from 'react-icons/fa';
import { supabase } from '../../supabase/client';
import { useAuth } from '../../hooks/useAuth';
import { useApp } from '../../stores';
import {
  fetchPublishedTasks,
  publishTask,
  remindTask,
  sendTaskUrge,
  type TaskRow } from
'../../services/taskService';
import TaskCommentsPanel from '../../components/tasks/TaskCommentsPanel';
import { SearchableSelect, SegmentedControl } from '../../components/ui';
import { projectSelectOptions } from '../../components/ui/options';
import { resolveUiStatus, uiStatusLabel, uiStatusClass } from './taskDisplay';
import {
  normalizePriority,
  PRIORITY_COLOR,
  PRIORITY_LABEL,
  sortPublishedTasks,
  type TaskSortMode } from
'./taskPriority';

interface ProjectOpt {
  id: string;
  name: string | null;
}

interface UserOpt {
  id: string;
  real_name: string | null;
  username: string;
}

export default function PublishedTasksPage() {
  const navigate = useNavigate();
  const { user, isSuperAdmin } = useAuth();
  const { currentCompany } = useApp();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [execByTask, setExecByTask] = useState<Record<string, {user_id: string;member_role?: string | null;}[]>>({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{type: 'ok' | 'err';text: string;} | null>(null);
  const [openCommentsTaskId, setOpenCommentsTaskId] = useState<string | null>(null);
  const [urgeModal, setUrgeModal] = useState<{taskId: string;text: string;} | null>(null);
  const [urgeSaving, setUrgeSaving] = useState(false);

  const [filterProject, setFilterProject] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterExecutor, setFilterExecutor] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [sortMode, setSortMode] = useState<TaskSortMode>('smart');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [userOptions, setUserOptions] = useState<UserOpt[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    task_name: '',
    project_id: '',
    description: '',
    acceptor_deadline: '',
    executor_ids: [] as string[],
    cc_ids: [] as string[],
    priority: 'medium' as 'urgent' | 'high' | 'medium' | 'low'
  });

  const publisherId = user?.id ?? '';

  const publishedProjectFilterOptions = useMemo(
    () => projectSelectOptions(projects.map((p) => ({ id: p.id, name: p.name || p.id })), '全部'),
    [projects]
  );
  const publishFormProjectOptions = useMemo(
    () => projects.map((p) => ({ value: p.id, label: p.name || p.id })),
    [projects]
  );
  const sortModeOptions = useMemo(
    () =>
    [
    { value: 'smart', label: '智能（优先级↓+日期↑）' },
    { value: 'priority_desc', label: '优先级从高到低' },
    { value: 'priority_asc', label: '优先级从低到高' },
    { value: 'deadline_asc', label: '验收日升序' }] as
    {value: TaskSortMode;label: string;}[],
    []
  );

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
    if (!publisherId) return;
    setLoading(true);
    try {
      const list = await fetchPublishedTasks(publisherId);
      setTasks(list);
      const ids = list.map((t) => t.id);
      if (!ids.length) {
        setExecByTask({});
        return;
      }
      const { data: rows } = await supabase.from('task_executors').select('task_id,user_id,member_role').in('task_id', ids);
      const map: Record<string, {user_id: string;member_role?: string | null;}[]> = {};
      for (const r of rows ?? []) {
        const tid = r.task_id as string;
        if (!map[tid]) map[tid] = [];
        map[tid].push({ user_id: r.user_id as string, member_role: (r as {member_role?: string | null;}).member_role });
      }
      setExecByTask(map);
    } catch (e) {
      setToast({ type: 'err', text: (e as Error).message || '加载失败' });
    } finally {
      setLoading(false);
    }
  }, [publisherId]);

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
      if (dateFrom && t.acceptor_deadline.slice(0, 10) < dateFrom) return false;
      if (dateTo && t.acceptor_deadline.slice(0, 10) > dateTo) return false;
      if (filterExecutor.trim()) {
        const ex = execByTask[t.id] ?? [];
        const names = ex.
        map((e) => userOptions.find((u) => u.id === e.user_id)).
        map((u) => (u?.real_name || u?.username || '') as string).
        join(' ');
        if (!names.includes(filterExecutor.trim())) return false;
      }
      if (filterPriority !== 'all' && normalizePriority(t.priority) !== filterPriority) return false;
      return true;
    });
  }, [tasks, filterProject, filterStatus, dateFrom, dateTo, filterExecutor, filterPriority, execByTask, userOptions]);

  const displayRows = useMemo(
    () => sortPublishedTasks(filtered, sortMode),
    [filtered, sortMode]
  );

  function userLabel(id: string) {
    const u = userOptions.find((x) => x.id === id);
    return u?.real_name || u?.username || id.slice(0, 8);
  }

  async function handlePublish() {
    if (!publisherId) return;
    if (!form.task_name.trim() || form.task_name.length > 100) {
      setToast({ type: 'err', text: '任务名称必填且不超过 100 字' });
      return;
    }
    if (!form.project_id || !form.acceptor_deadline) {
      setToast({ type: 'err', text: '请选择项目并填写验收日期' });
      return;
    }
    if (!form.executor_ids.length) {
      setToast({ type: 'err', text: '请至少选择一名执行人' });
      return;
    }
    setSaving(true);
    try {
      await publishTask({
        task_name: form.task_name.trim(),
        description: form.description || null,
        project_id: form.project_id,
        publisher_id: publisherId,
        acceptor_deadline: form.acceptor_deadline,
        priority: form.priority,
        executor_user_ids: form.executor_ids,
        cc_user_ids: form.cc_ids,
        attachments: []
      });
      setToast({ type: 'ok', text: '发布成功' });
      setShowModal(false);
      setForm({
        task_name: '',
        project_id: '',
        description: '',
        acceptor_deadline: '',
        executor_ids: [],
        cc_ids: [],
        priority: 'medium'
      });
      await load();
    } catch (e) {
      setToast({ type: 'err', text: (e as Error).message || '发布失败' });
    } finally {
      setSaving(false);
    }
  }

  async function handleRemindClick(taskId: string) {
    setUrgeModal({ taskId, text: '' });
  }

  async function confirmUrge() {
    if (!publisherId || !urgeModal) return;
    const t = urgeModal.text.trim();
    if (!t) {
      setToast({ type: 'err', text: '请填写催办说明' });
      return;
    }
    if (!window.confirm('确认发送催办？执行团队将收到站内通知。')) return;
    setUrgeSaving(true);
    try {
      await sendTaskUrge(urgeModal.taskId, publisherId, t);
      setUrgeModal(null);
      setToast({ type: 'ok', text: '催办已发送' });
    } catch (e) {
      setToast({ type: 'err', text: (e as Error).message || '催办失败' });
    } finally {
      setUrgeSaving(false);
    }
  }

  async function handleQuickRemind(taskId: string) {
    if (!publisherId) return;
    if (!window.confirm('确认发送快捷催办？将使用默认说明并通知执行团队。')) return;
    try {
      await remindTask(taskId, publisherId);
      setToast({ type: 'ok', text: '已发送快捷催办' });
    } catch (e) {
      setToast({ type: 'err', text: (e as Error).message || '催办失败' });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-gray-800">我发布的任务</h2>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
          
          <FaPlus /> 发布任务
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-wrap gap-3 items-end">
        <div className="min-w-[10rem]">
          <span className="mb-1 block text-sm text-gray-600">项目</span>
          <SearchableSelect
            value={filterProject}
            onChange={setFilterProject}
            options={publishedProjectFilterOptions}
            placeholder="全部"
            emptyLabel="全部"
            searchPlaceholder="搜索项目…"
            metricsContext="page:published_tasks:filter_project"
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
            metricsContext="page:published_tasks:filter_status"
            aria-label="任务状态" />
          
        </div>
        <label className="text-sm text-gray-600">
          验收日起
          <input
            type="date"
            className="mt-1 block border rounded-lg px-2 py-1.5 text-gray-800"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)} />
          
        </label>
        <label className="text-sm text-gray-600">
          验收日止
          <input
            type="date"
            className="mt-1 block border rounded-lg px-2 py-1.5 text-gray-800"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)} />
          
        </label>
        <label className="text-sm text-gray-600">
          执行人
          <input
            className="mt-1 block w-40 border rounded-lg px-2 py-1.5 text-gray-800"
            placeholder="姓名筛选"
            value={filterExecutor}
            onChange={(e) => setFilterExecutor(e.target.value)} />
          
        </label>
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
            metricsContext="page:published_tasks:filter_priority"
            aria-label="优先级" />
          
        </div>
        <div className="min-w-[12rem] flex-1">
          <span className="mb-1 block text-sm text-gray-600">排序</span>
          <SearchableSelect
            allowEmpty={false}
            value={sortMode}
            onChange={(v) => setSortMode(v as TaskSortMode)}
            options={sortModeOptions}
            placeholder="排序"
            searchThreshold={10}
            metricsContext="page:published_tasks:sort" />
          
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        {loading ?
        <div className="p-8 text-center text-gray-500">加载中…</div> :

        <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left py-3 px-3">任务名称</th>
                <th className="text-center py-3 px-3 w-24">优先级</th>
                <th className="text-left py-3 px-3">执行人</th>
                <th className="text-left py-3 px-3">验收日期</th>
                <th className="text-left py-3 px-3 w-40">进度</th>
                <th className="text-center py-3 px-3">状态</th>
                <th className="text-left py-3 px-3">最新汇报</th>
                <th className="text-center py-3 px-3 w-28">评论</th>
                <th className="text-center py-3 px-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.length === 0 ?
            <tr>
                  <td colSpan={9} className="text-center py-10 text-gray-400">
                    暂无任务
                  </td>
                </tr> :

            displayRows.map((t) => {
              const ui = resolveUiStatus(t);
              const pct = Math.min(100, Math.max(0, Number(t.total_progress) || 0));
              const pr = normalizePriority(t.priority);
              const urgentRow = pr === 'urgent' && ui !== 'completed';
              const exRows = execByTask[t.id] ?? [];
              const canCommentHere =
              isSuperAdmin ||
              publisherId === t.publisher_id ||
              exRows.some((e) => e.user_id === publisherId);
              const commentsOpen = openCommentsTaskId === t.id;
              return (
                <Fragment key={t.id}>
                      <tr
                    className={
                    'border-t border-gray-100 hover:bg-gray-50' + (urgentRow ? ' task-row-urgent' : '')
                    }>
                    
                      <td className="py-3 px-3">
                        <button
                        type="button"
                        className="text-blue-600 hover:underline font-medium text-left"
                        onClick={() => navigate('/tasks/' + t.id)}>
                        
                          {t.task_name}
                        </button>
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
                      <td className="py-3 px-3 text-gray-700">
                        {(execByTask[t.id] ?? []).map((e) => userLabel(e.user_id)).join('、') || '—'}
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
                      <td className="py-3 px-3 text-gray-600">
                        {t.last_report_time ? t.last_report_time.slice(0, 16).replace('T', ' ') : '—'}
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
                      <td className="py-3 px-3 text-center">
                        {t.status !== 'completed' &&
                      <div className="flex justify-center gap-1">
                            <button
                          type="button"
                          className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg"
                          title="快捷催办"
                          onClick={() => void handleQuickRemind(t.id)}>
                          
                              <FaBell />
                            </button>
                            <button
                          type="button"
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg text-xs"
                          title="自定义催办"
                          onClick={() => handleRemindClick(t.id)}>
                          
                              催办
                            </button>
                          </div>
                      }
                      </td>
                    </tr>
                    {commentsOpen &&
                  <tr className="bg-slate-50/80">
                        <td colSpan={9} className="px-4 py-3 border-t border-gray-100">
                          <TaskCommentsPanel
                        taskId={t.id}
                        currentUserId={publisherId}
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
        }
      </div>

      {showModal &&
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl p-6 space-y-4">
          
            <h3 className="text-lg font-semibold text-gray-800">发布任务</h3>
            <label className="block text-sm text-gray-600">
              任务名称 *
              <input
              className="mt-1 w-full border rounded-lg px-3 py-2 text-gray-800"
              maxLength={100}
              value={form.task_name}
              onChange={(e) => setForm((f) => ({ ...f, task_name: e.target.value }))} />
            
            </label>
            <label className="block text-sm text-gray-600">
              关联项目 *
              <SearchableSelect
              className="mt-1"
              required
              allowEmpty={false}
              value={form.project_id}
              onChange={(v) => setForm((f) => ({ ...f, project_id: v }))}
              options={publishFormProjectOptions}
              placeholder="请选择"
              searchPlaceholder="搜索项目…"
              metricsContext="page:published_tasks:form_project" />
            
            </label>
            <label className="block text-sm text-gray-600">
              任务描述
              <textarea
              className="mt-1 w-full border rounded-lg px-3 py-2 text-gray-800 min-h-[80px]"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            
            </label>
            <div>
              <span className="block text-sm text-gray-600 mb-1">优先级</span>
              <SegmentedControl
              value={form.priority}
              onChange={(v) => setForm((f) => ({ ...f, priority: v }))}
              options={[
              { value: 'urgent', label: '紧急' },
              { value: 'high', label: '高' },
              { value: 'medium', label: '中' },
              { value: 'low', label: '低' }]
              }
              metricsContext="page:published_tasks:form_priority"
              aria-label="任务优先级" />
            
            </div>
            <label className="block text-sm text-gray-600">
              验收日期 *
              <input
              type="date"
              className="mt-1 w-full border rounded-lg px-3 py-2 text-gray-800"
              value={form.acceptor_deadline}
              onChange={(e) => setForm((f) => ({ ...f, acceptor_deadline: e.target.value }))} />
            
            </label>
            <div className="text-sm text-gray-600">
              <span className="block mb-1">执行人 *（可多选）</span>
              <div className="mt-1 max-h-[140px] overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-2 space-y-1.5">
                {userOptions.map((u) =>
              <label key={u.id} className="flex items-center gap-2 cursor-pointer text-gray-800">
                    <input
                  type="checkbox"
                  checked={form.executor_ids.includes(u.id)}
                  onChange={() =>
                  setForm((f) => ({
                    ...f,
                    executor_ids: f.executor_ids.includes(u.id) ?
                    f.executor_ids.filter((id) => id !== u.id) :
                    [...f.executor_ids, u.id]
                  }))
                  }
                  className="rounded border-gray-300 text-blue-600" />
                
                    <span>{u.real_name || u.username}</span>
                  </label>
              )}
              </div>
            </div>
            <div className="text-sm text-gray-600">
              <span className="block mb-1">抄送人（可多选）</span>
              <div className="mt-1 max-h-[120px] overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-2 space-y-1.5">
                {userOptions.map((u) =>
              <label key={u.id} className="flex items-center gap-2 cursor-pointer text-gray-800">
                    <input
                  type="checkbox"
                  checked={form.cc_ids.includes(u.id)}
                  onChange={() =>
                  setForm((f) => ({
                    ...f,
                    cc_ids: f.cc_ids.includes(u.id) ? f.cc_ids.filter((id) => id !== u.id) : [...f.cc_ids, u.id]
                  }))
                  }
                  className="rounded border-gray-300 text-blue-600" />
                
                    <span>{u.real_name || u.username}</span>
                  </label>
              )}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
              type="button"
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700"
              onClick={() => setShowModal(false)}>
              
                取消
              </button>
              <button
              type="button"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50"
              onClick={() => void handlePublish()}>
              
                {saving ? '提交中…' : '发布'}
              </button>
            </div>
          </motion.div>
        </div>
      }

      {urgeModal &&
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-3">
            <h3 className="text-lg font-semibold text-gray-800">自定义催办</h3>
            <textarea
            className="w-full border rounded-lg px-3 py-2 min-h-[100px] text-sm text-gray-800"
            placeholder="催办说明（必填）"
            value={urgeModal.text}
            onChange={(e) => setUrgeModal((m) => m ? { ...m, text: e.target.value } : m)} />
          
            <div className="flex justify-end gap-2">
              <button
              type="button"
              className="px-4 py-2 rounded-lg border border-gray-300"
              onClick={() => setUrgeModal(null)}>
              
                取消
              </button>
              <button
              type="button"
              disabled={urgeSaving}
              className="px-4 py-2 rounded-lg bg-amber-600 text-white disabled:opacity-50"
              onClick={() => void confirmUrge()}>
              
                {urgeSaving ? '发送中…' : '确认发送'}
              </button>
            </div>
          </div>
        </div>
      }

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