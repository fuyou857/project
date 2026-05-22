import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaArrowLeft } from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth';
import {
  getTaskDetail,
  canViewTask,
  isTaskExecutor,
  isTaskPublisher,
  canSubmitTaskProgress,
  isPrimaryTaskExecutor,
  canPostTaskComment,
  executorMemberRole,
  submitProgress,
  applyAcceptanceRequest,
  submitAcceptance,
  updateTaskBasics,
  softDeleteTask,
  type TaskDetailBundle } from
'../../services/taskService';
import { resolveUiStatus, uiStatusLabel, uiStatusClass } from './taskDisplay';
import { normalizePriority, PRIORITY_COLOR, PRIORITY_LABEL } from './taskPriority';
import type { TaskPriority } from '../../services/taskService';
import PublisherTaskManagePanel from '../../components/tasks/PublisherTaskManagePanel';
import TaskCommentsPanel from '../../components/tasks/TaskCommentsPanel';
import { supabase } from '../../supabase/client';
import { SegmentedControl } from '../../components/ui';

export default function TaskDetailPage() {
  const { taskId } = useParams<{taskId: string;}>();
  const navigate = useNavigate();
  const { user, isSuperAdmin } = useAuth();
  const uid = user?.id ?? '';

  const [detail, setDetail] = useState<TaskDetailBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [progVal, setProgVal] = useState(0);
  const [progNote, setProgNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [acceptOpen, setAcceptOpen] = useState(false);
  const [acceptPass, setAcceptPass] = useState(true);
  const [acceptOpinion, setAcceptOpinion] = useState('');

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [editPriority, setEditPriority] = useState<TaskPriority>('medium');

  const captureInputRef = useRef<HTMLInputElement>(null);

  const [manageUsers, setManageUsers] = useState<{id: string;real_name: string | null;username: string;}[]>([]);

  const reload = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    setErr(null);
    try {
      const d = await getTaskDetail(taskId);
      if (!d) {
        setErr('任务不存在');
        setDetail(null);
        return;
      }
      if (!canViewTask(d, uid, isSuperAdmin)) {
        setErr('无权查看此任务');
        setDetail(null);
        return;
      }
      setDetail(d);
      setProgVal(Math.round(Number(d.task.total_progress) || 0));
    } catch (e) {
      setErr((e as Error).message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [taskId, uid, isSuperAdmin]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from('users').select('id,real_name,username').order('real_name');
      setManageUsers((data ?? []) as {id: string;real_name: string | null;username: string;}[]);
    })();
  }, []);

  useEffect(() => {
    if (!detail) return;
    setEditName(detail.task.task_name);
    setEditDesc(detail.task.description ?? '');
    setEditDeadline(detail.task.acceptor_deadline?.slice(0, 10) ?? '');
    setEditPriority(normalizePriority(detail.task.priority));
  }, [detail]);

  if (loading) {
    return <div className="p-8 text-center text-gray-500">加载中…</div>;
  }
  if (err || !detail) {
    return (
      <div className="space-y-4">
        <button type="button" className="text-blue-600 flex items-center gap-2" onClick={() => navigate(-1)}>
          <FaArrowLeft /> 返回
        </button>
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 px-4 py-3">{err || '未找到'}</div>
      </div>);

  }

  const { task, project, executors, reports, acceptances, logs, userMap } = detail;
  const ui = resolveUiStatus(task);
  const publisher = isTaskPublisher(detail, uid);
  const executor = isTaskExecutor(detail, uid);
  const canSubmit = canSubmitTaskProgress(detail, uid);
  const primaryExec = isPrimaryTaskExecutor(detail, uid);

  async function onSubmitProgress() {
    if (!taskId || !canSubmit) return;
    setSubmitting(true);
    try {
      await submitProgress(taskId, uid, progVal, progNote, []);
      setProgNote('');
      await reload();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function onApplyAcceptance() {
    if (!taskId || !primaryExec) return;
    if (!window.confirm('确认申请验收？')) return;
    setSubmitting(true);
    try {
      await applyAcceptanceRequest(taskId, uid);
      await reload();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmitAcceptance() {
    if (!taskId || !publisher) return;
    if (!acceptPass && !acceptOpinion.trim()) {
      alert('验收不通过须填写驳回意见');
      return;
    }
    setSubmitting(true);
    try {
      await submitAcceptance(taskId, uid, acceptPass, acceptOpinion, null);
      setAcceptOpen(false);
      setAcceptOpinion('');
      await reload();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function onSaveEdit() {
    if (!taskId || !publisher) return;
    setSubmitting(true);
    try {
      await updateTaskBasics(taskId, uid, {
        task_name: editName.trim(),
        description: editDesc,
        acceptor_deadline: editDeadline,
        priority: editPriority
      });
      setEditOpen(false);
      await reload();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete() {
    if (!taskId || !publisher) return;
    const ok = window.confirm('确定删除或归档该任务？已有汇报时将归档为删除标记。');
    if (!ok) return;
    setSubmitting(true);
    try {
      const r = await softDeleteTask(taskId, uid);
      alert(r === 'archived' ? '已归档' : '已删除');
      navigate('/tasks/published');
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function nameOf(userId: string) {
    const u = userMap.get(userId) as {real_name?: string | null;username?: string;} | undefined;
    return u?.real_name || u?.username || userId.slice(0, 8);
  }

  function startVoiceToNote() {
    const w = window as Window & {
      SpeechRecognition?: new () => SpeechRecognition;
      webkitSpeechRecognition?: new () => SpeechRecognition;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      alert('当前浏览器不支持语音识别（可尝试 Chrome / 安卓 Chrome）');
      return;
    }
    const rec = new SR();
    rec.lang = 'zh-CN';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (event: SpeechRecognitionEvent) => {
      const text = event.results[0]?.[0]?.transcript?.trim();
      if (text) setProgNote((prev) => (prev ? `${prev}\n` : '') + text);
    };
    rec.onerror = () => {};
    try {
      rec.start();
    } catch {
      alert('无法启动语音识别');
    }
  }

  function onCapturePhoto(ev: React.ChangeEvent<HTMLInputElement>) {
    const f = ev.target.files?.[0];
    if (f?.name) {
      setProgNote((prev) => (prev ? `${prev}\n` : '') + `[照片: ${f.name}，待对接 Storage 上传]`);
    }
    ev.target.value = '';
  }

  const pct = Math.min(100, Math.max(0, Number(task.total_progress) || 0));
  const pr = normalizePriority(task.priority);

  return (
    <div className="space-y-6 max-w-4xl">
      <button type="button" className="text-blue-600 flex items-center gap-2" onClick={() => navigate(-1)}>
        <FaArrowLeft /> 返回
      </button>

      {executor && task.last_reject_opinion && task.status === 'in_progress' &&
      <div className="rounded-lg border border-orange-300 bg-orange-50 text-orange-900 px-4 py-3 text-sm">
          <strong>验收不通过</strong>，驳回原因：{task.last_reject_opinion}。请修改后重新申请验收。
        </div>
      }

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{task.task_name}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-600">
            <span
              className={
              'px-2 py-1 rounded text-xs font-medium ' + (
              pr === 'high' ? 'text-gray-900' : 'text-white')
              }
              style={{ backgroundColor: PRIORITY_COLOR[pr] }}>
              
              {PRIORITY_LABEL[pr]}
            </span>
            <span className={'px-2 py-1 rounded text-xs ' + uiStatusClass(ui)}>{uiStatusLabel(ui)}</span>
            {project &&
            <button
              type="button"
              className="text-blue-600 hover:underline"
              onClick={() => navigate('/projects/' + project.id)}>
              
                项目：{project.name}
              </button>
            }
          </div>
        </div>
        {publisher && task.status !== 'completed' &&
        <div className="flex flex-wrap gap-2">
            <button
            type="button"
            className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-sm"
            onClick={() => setEditOpen(true)}>
            
              编辑
            </button>
            <button
            type="button"
            className="px-3 py-1.5 rounded-lg border border-red-300 text-red-700 text-sm"
            onClick={() => void onDelete()}>
            
              删除/归档
            </button>
            {task.status === 'pending_acceptance' &&
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg bg-orange-600 text-white text-sm"
            onClick={() => setAcceptOpen(true)}>
            
                验收
              </button>
          }
          </div>
        }
      </div>

      <section className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-2 text-sm">
        <h3 className="font-semibold text-gray-800">基本信息</h3>
        <p>
          <span className="text-gray-500">优先级：</span>
          <span
            className={
            'inline-block px-2 py-0.5 rounded text-xs font-medium ' + (
            pr === 'high' ? 'text-gray-900' : 'text-white')
            }
            style={{ backgroundColor: PRIORITY_COLOR[pr] }}>
            
            {PRIORITY_LABEL[pr]}
          </span>
        </p>
        <p>
          <span className="text-gray-500">发布人：</span>
          {nameOf(task.publisher_id)}
        </p>
        <p>
          <span className="text-gray-500">验收日期：</span>
          {task.acceptor_deadline?.slice(0, 10)}
        </p>
        <p>
          <span className="text-gray-500">负责人：</span>
          {executors.filter((e) => executorMemberRole(e) === 'executor').map((e) => nameOf(e.user_id)).join('、') || '—'}
        </p>
        {executors.some((e) => executorMemberRole(e) === 'co_assistant') &&
        <p>
            <span className="text-gray-500">协办：</span>
            {executors.filter((e) => executorMemberRole(e) === 'co_assistant').map((e) => nameOf(e.user_id)).join('、')}
          </p>
        }
        <p>
          <span className="text-gray-500">抄送人：</span>
          {(detail.cc as {user_id: string;}[]).length ?
          (detail.cc as {user_id: string;}[]).map((c) => nameOf(c.user_id)).join('、') :
          '—'}
        </p>
        <p className="text-gray-700 whitespace-pre-wrap">{task.description || '无描述'}</p>
        <div className="pt-2">
          <span className="text-gray-500 text-sm">整体进度</span>
          <div className="mt-1 h-3 bg-gray-100 rounded-full overflow-hidden max-w-md">
            <div
              className={(() => {if (
                ui === 'completed') {return (
                    'h-full bg-green-500');} else {if (
                  task.last_reject_opinion && task.status === 'in_progress') {return (
                      'h-full bg-orange-500');} else {return (
                      'h-full bg-blue-500');}}})()
              }
              style={{ width: `${pct}%` }} />
            
          </div>
          <span className="text-xs text-gray-500">{pct.toFixed(0)}%</span>
        </div>
      </section>

      {publisher && task.status !== 'completed' &&
      <PublisherTaskManagePanel
        detail={detail}
        publisherId={uid}
        userOptions={manageUsers}
        onRefresh={() => void reload()} />

      }

      {canSubmit && task.status !== 'completed' &&
      <section className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3">
      <h3 className="font-semibold text-gray-800">进度汇报</h3>
      <div className="text-xs text-orange-600 mb-2">提示：进度只能增加，不能回退</div>
      <label className="block text-sm text-gray-600">
        进度 {progVal}%
        <input
            type="range"
            min={Math.round(Number(detail.task.total_progress) || 0)}
            max={100}
            value={progVal}
            onChange={(e) => setProgVal(Number(e.target.value))}
            className="block w-full max-w-md mt-1" />
          
      </label>
          <label className="block text-sm text-gray-600">
            汇报说明（必填）
            <textarea
            className="mt-1 w-full border rounded-lg px-3 py-2 min-h-[80px] text-gray-800"
            value={progNote}
            onChange={(e) => setProgNote(e.target.value)} />
          
          </label>
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <button
            type="button"
            className="px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
            onClick={() => startVoiceToNote()}>
            
              语音填入说明
            </button>
            <input
            ref={captureInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onCapturePhoto} />
          
            <button
            type="button"
            className="px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
            onClick={() => captureInputRef.current?.click()}>
            
              拍照（备注文件名）
            </button>
            <span className="text-gray-400 w-full sm:w-auto">PWA 安装后移动端相机权限由系统管理；文件实际上传可接 Supabase Storage。</span>
          </div>
          <button
          type="button"
          disabled={submitting}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50"
          onClick={() => void onSubmitProgress()}>
          
            提交汇报
          </button>
          {task.status === 'in_progress' && pct >= 100 && primaryExec &&
        <button
          type="button"
          disabled={submitting}
          className="ml-2 px-4 py-2 rounded-lg bg-orange-600 text-white disabled:opacity-50"
          onClick={() => void onApplyAcceptance()}>
          
              申请验收
            </button>
        }
        </section>
      }

      <TaskCommentsPanel
        taskId={task.id}
        currentUserId={uid}
        canPost={canPostTaskComment(detail, uid, isSuperAdmin)}
        onPosted={() => void reload()} />
      

      <section className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <h3 className="font-semibold text-gray-800 mb-2">进度与验收记录</h3>
        <ul className="space-y-3 text-sm">
          {reports.map((r: {id: string;report_time: string;progress_after: number;report_content: string;}) =>
          <li key={r.id} className="border-b border-gray-100 pb-2">
              <div className="text-gray-500 text-xs">{r.report_time?.slice(0, 19).replace('T', ' ')}</div>
              <div>
                进度 → {r.progress_after}%：{r.report_content}
              </div>
            </li>
          )}
          {acceptances.map(
            (a: {
              id: string;
              accept_time: string;
              result: string;
              opinion: string;
            }) =>
            <li key={a.id} className="border-b border-gray-100 pb-2">
                <div className="text-gray-500 text-xs">{a.accept_time?.slice(0, 19).replace('T', ' ')}</div>
                <div className={a.result === 'pass' ? 'text-green-700' : 'text-red-700'}>
                  验收{a.result === 'pass' ? '通过' : '不通过'}：{a.opinion}
                </div>
              </li>

          )}
          {!reports.length && !acceptances.length && <li className="text-gray-400">暂无记录</li>}
        </ul>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <h3 className="font-semibold text-gray-800 mb-2">操作日志</h3>
        <ul className="text-xs text-gray-600 space-y-1 max-h-48 overflow-y-auto">
          {logs.map((l: {id: string;action: string;created_at: string;actor_id: string | null;}) =>
          <li key={l.id}>
              {l.created_at?.slice(0, 19).replace('T', ' ')} {l.actor_id ? nameOf(l.actor_id) : '系统'}{' '}
              {l.action}
            </li>
          )}
        </ul>
      </section>

      {acceptOpen &&
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-semibold">验收</h3>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={acceptPass} onChange={() => setAcceptPass(true)} />
                通过
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={!acceptPass} onChange={() => setAcceptPass(false)} />
                不通过
              </label>
            </div>
            <label className="block text-sm text-gray-600">
              {acceptPass ? '验收意见（可选）' : '驳回意见（必填）'}
              <textarea
              className="mt-1 w-full border rounded-lg px-3 py-2 min-h-[80px]"
              value={acceptOpinion}
              onChange={(e) => setAcceptOpinion(e.target.value)} />
            
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" className="px-4 py-2 border rounded-lg" onClick={() => setAcceptOpen(false)}>
                取消
              </button>
              <button
              type="button"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white"
              onClick={() => void onSubmitAcceptance()}>
              
                确定
              </button>
            </div>
          </div>
        </div>
      }

      {editOpen &&
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-semibold">编辑任务</h3>
            <label className="block text-sm">
              名称
              <input
              className="mt-1 w-full border rounded-lg px-3 py-2"
              value={editName}
              onChange={(e) => setEditName(e.target.value)} />
            
            </label>
            <label className="block text-sm">
              描述
              <textarea
              className="mt-1 w-full border rounded-lg px-3 py-2 min-h-[80px]"
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)} />
            
            </label>
            <label className="block text-sm">
              验收日
              <input
              type="date"
              className="mt-1 w-full border rounded-lg px-3 py-2"
              value={editDeadline}
              onChange={(e) => setEditDeadline(e.target.value)} />
            
            </label>
            <div className="block text-sm">
              <span className="block mb-1">优先级</span>
              <SegmentedControl
              value={editPriority}
              onChange={(v) => setEditPriority(v as TaskPriority)}
              options={[
              { value: 'urgent', label: '紧急' },
              { value: 'high', label: '高' },
              { value: 'medium', label: '中' },
              { value: 'low', label: '低' }]
              }
              className="mt-1"
              aria-label="优先级" />
            
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="px-4 py-2 border rounded-lg" onClick={() => setEditOpen(false)}>
                取消
              </button>
              <button
              type="button"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white"
              onClick={() => void onSaveEdit()}>
              
                保存
              </button>
            </div>
          </div>
        </div>
      }
    </div>);

}