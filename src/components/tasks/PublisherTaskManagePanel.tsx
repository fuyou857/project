import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  sendTaskUrge,
  fetchTaskUrgeRecords,
  createTaskSupervision,
  closeTaskSupervision,
  fetchTaskSupervisionRecords,
  addTaskCoAssistant,
  removeTaskCoAssistant,
  fetchCoAssistantEvents,
  executorMemberRole,
  type TaskDetailBundle,
} from '../../services/taskService';
import { supabase } from '../../supabase/client';
import { SearchableSelect } from '../ui';

type Tab = 'urge' | 'supervision' | 'co';

interface UserPick {
  id: string;
  real_name: string | null;
  username: string;
}

export default function PublisherTaskManagePanel(props: {
  detail: TaskDetailBundle;
  publisherId: string;
  userOptions: UserPick[];
  onRefresh: () => void;
}) {
  const { detail, publisherId, userOptions, onRefresh } = props;
  const taskId = detail.task.id;

  const [tab, setTab] = useState<Tab>('urge');
  const [urgeText, setUrgeText] = useState('');
  const [supText, setSupText] = useState('');
  const [supRemind, setSupRemind] = useState('');
  const [coPick, setCoPick] = useState('');
  const [coManual, setCoManual] = useState('');
  const [coNote, setCoNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [urges, setUrges] = useState<Record<string, unknown>[]>([]);
  const [sups, setSups] = useState<Record<string, unknown>[]>([]);
  const [coEvents, setCoEvents] = useState<Record<string, unknown>[]>([]);

  const coAssistants = detail.executors.filter(e => executorMemberRole(e) === 'co_assistant');

  const coSelectOptions = useMemo(
    () => [
      { value: '', label: '请选择' },
      ...userOptions
        .filter(u => u.id !== publisherId)
        .map(u => ({ value: u.id, label: u.real_name || u.username })),
    ],
    [userOptions, publisherId],
  );

  const loadHist = useCallback(async () => {
    try {
      const [u, s, e] = await Promise.all([
        fetchTaskUrgeRecords(taskId),
        fetchTaskSupervisionRecords(taskId),
        fetchCoAssistantEvents(taskId),
      ]);
      setUrges(u as Record<string, unknown>[]);
      setSups(s as Record<string, unknown>[]);
      setCoEvents(e as Record<string, unknown>[]);
    } catch {
      /* ignore */
    }
  }, [taskId]);

  useEffect(() => {
    void loadHist();
  }, [loadHist]);

  function nameOf(uid: string) {
    const u = detail.userMap.get(uid) as { real_name?: string | null; username?: string } | undefined;
    return u?.real_name || u?.username || uid.slice(0, 8);
  }

  async function doUrge() {
    const t = urgeText.trim();
    if (!t) {
      setToast('请填写催办说明');
      return;
    }
    if (!window.confirm('确认向执行团队发送催办通知？')) return;
    setBusy(true);
    setToast(null);
    try {
      await sendTaskUrge(taskId, publisherId, t);
      setUrgeText('');
      setToast('催办已发送');
      await loadHist();
      onRefresh();
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function doSup() {
    const t = supText.trim();
    if (!t) {
      setToast('请填写督办内容');
      return;
    }
    if (!window.confirm('确认发起督办并通知执行团队？')) return;
    setBusy(true);
    setToast(null);
    try {
      await createTaskSupervision(taskId, publisherId, t, supRemind.trim() || null);
      setSupText('');
      setSupRemind('');
      setToast('督办已记录');
      await loadHist();
      onRefresh();
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function doCloseSup(id: string) {
    if (!window.confirm('确认将该督办事项标记为已办结？')) return;
    setBusy(true);
    setToast(null);
    try {
      await closeTaskSupervision(taskId, publisherId, id);
      setToast('已办结');
      await loadHist();
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function resolveCoUserId(): Promise<string | null> {
    if (coPick) return coPick;
    const q = coManual.trim();
    if (!q) return null;
    const byUser = userOptions.find(
      u => u.username.toLowerCase() === q.toLowerCase() || (u.real_name && u.real_name.includes(q))
    );
    if (byUser) return byUser.id;
    const { data, error } = await supabase.from('users').select('id').ilike('username', q).limit(1).maybeSingle();
    if (error || !data) return null;
    return data.id as string;
  }

  async function doAddCo() {
    const uid = await resolveCoUserId();
    if (!uid) {
      setToast('请选择用户或输入有效用户名');
      return;
    }
    if (!window.confirm('确认添加该用户为协办？其将收到系统通知。')) return;
    setBusy(true);
    setToast(null);
    try {
      await addTaskCoAssistant(taskId, publisherId, uid, coNote.trim() || null);
      setCoPick('');
      setCoManual('');
      setCoNote('');
      setToast('已添加协办');
      await loadHist();
      onRefresh();
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function doRemoveCo(uid: string) {
    if (!window.confirm('确认移除该协办人员？')) return;
    setBusy(true);
    setToast(null);
    try {
      await removeTaskCoAssistant(taskId, publisherId, uid, null);
      setToast('已移除');
      await loadHist();
      onRefresh();
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const tabBtn = (k: Tab, label: string) => (
    <button
      type="button"
      key={k}
      onClick={() => setTab(k)}
      className={
        'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ' +
        (tab === k ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')
      }
    >
      {label}
    </button>
  );

  return (
    <section className="bg-white rounded-xl border border-indigo-200 p-4 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 pb-3">
        <h3 className="font-semibold text-indigo-950 text-lg">综合管理（发布者）</h3>
        <p className="text-xs text-gray-500 w-full sm:w-auto">
          催办、督办、协办与下方「任务交流与评论」联动，数据全量留痕。
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabBtn('urge', '催办')}
        {tabBtn('supervision', '督办')}
        {tabBtn('co', '协办人员')}
      </div>

      {toast && (
        <div className="text-sm rounded-lg px-3 py-2 bg-amber-50 text-amber-900 border border-amber-200">
          {toast}
        </div>
      )}

      {tab === 'urge' && (
        <div className="space-y-3 text-sm">
          <p className="text-gray-600">向任务执行人及协办发送催办说明，并写入催办记录、站内通知。</p>
          <textarea
            className="w-full border rounded-lg px-3 py-2 min-h-[88px] text-gray-800"
            placeholder="催办说明（必填）"
            value={urgeText}
            onChange={e => setUrgeText(e.target.value)}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void doUrge()}
            className="px-4 py-2 rounded-lg bg-amber-600 text-white disabled:opacity-50"
          >
            确认发送催办
          </button>
          <div>
            <h4 className="font-medium text-gray-800 mb-2">催办历史</h4>
            <ul className="space-y-2 text-xs text-gray-600 max-h-40 overflow-y-auto">
              {urges.map((r: Record<string, unknown>) => (
                <li key={r.id as string} className="border-b border-gray-100 pb-1">
                  <span className="text-gray-400">
                    {(r.created_at as string)?.slice(0, 19).replace('T', ' ')}
                  </span>{' '}
                  {nameOf(r.from_user_id as string)}：{r.content as string}
                </li>
              ))}
              {!urges.length && <li className="text-gray-400">暂无记录</li>}
            </ul>
          </div>
        </div>
      )}

      {tab === 'supervision' && (
        <div className="space-y-3 text-sm">
          <p className="text-gray-600">督办事项将通知执行团队；可填写计划跟进时间（选填）。</p>
          <textarea
            className="w-full border rounded-lg px-3 py-2 min-h-[88px] text-gray-800"
            placeholder="督办内容与要求（必填）"
            value={supText}
            onChange={e => setSupText(e.target.value)}
          />
          <label className="block text-gray-600">
            计划跟进时间（选填）
            <input
              type="datetime-local"
              className="mt-1 block w-full sm:w-64 border rounded-lg px-2 py-1.5 text-gray-800"
              value={supRemind}
              onChange={e => setSupRemind(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void doSup()}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-50"
          >
            确认发起督办
          </button>
          <div>
            <h4 className="font-medium text-gray-800 mb-2">督办记录</h4>
            <ul className="space-y-2 text-xs max-h-48 overflow-y-auto">
              {sups.map((r: Record<string, unknown>) => (
                <li key={r.id as string} className="border border-gray-100 rounded-lg p-2">
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-400">
                      {(r.created_at as string)?.slice(0, 16).replace('T', ' ')}
                    </span>
                    <span
                      className={
                        r.status === 'open' ? 'text-orange-700 font-medium' : 'text-green-700 font-medium'
                      }
                    >
                      {r.status === 'open' ? '进行中' : '已办结'}
                    </span>
                  </div>
                  <p className="text-gray-800 mt-1 whitespace-pre-wrap">{r.content as string}</p>
                  {r.remind_at != null && r.remind_at !== '' ? (
                    <p className="text-gray-500 mt-1">跟进：{String(r.remind_at).slice(0, 16).replace('T', ' ')}</p>
                  ) : null}
                  {r.status === 'open' && (
                    <button
                      type="button"
                      disabled={busy}
                      className="mt-2 text-xs text-blue-600 hover:underline"
                      onClick={() => void doCloseSup(r.id as string)}
                    >
                      标记办结
                    </button>
                  )}
                </li>
              ))}
              {!sups.length && <li className="text-gray-400">暂无督办</li>}
            </ul>
          </div>
        </div>
      )}

      {tab === 'co' && (
        <div className="space-y-3 text-sm">
          <p className="text-gray-600">
            协办人员可查看任务、提交进度汇报、参与评论；不可作为负责人单独申请验收。
          </p>
          <div className="flex flex-wrap gap-2 items-end">
            <label className="flex min-w-[200px] flex-1 flex-col text-gray-600">
              从用户列表选择
              <div className="mt-1">
                <SearchableSelect
                  value={coPick}
                  onChange={setCoPick}
                  options={coSelectOptions}
                  placeholder="请选择"
                  searchPlaceholder="搜索用户…"
                  searchThreshold={5}
                />
              </div>
            </label>
            <span className="text-gray-400 self-end pb-2">或</span>
            <label className="text-gray-600 flex-1 min-w-[160px]">
              用户名 / 姓名关键词
              <input
                className="mt-1 w-full border rounded-lg px-2 py-1.5 text-gray-800"
                value={coManual}
                onChange={e => setCoManual(e.target.value)}
                placeholder="精确用户名或姓名片段"
              />
            </label>
          </div>
          <label className="block text-gray-600">
            备注（选填，写入审计）
            <input
              className="mt-1 w-full border rounded-lg px-2 py-1.5 text-gray-800"
              value={coNote}
              onChange={e => setCoNote(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void doAddCo()}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50"
          >
            添加协办
          </button>

          <div>
            <h4 className="font-medium text-gray-800 mb-2">当前协办</h4>
            <ul className="space-y-1">
              {coAssistants.length === 0 ? (
                <li className="text-gray-400 text-xs">暂无协办</li>
              ) : (
                coAssistants.map(e => (
                  <li key={e.id} className="flex justify-between items-center border border-gray-100 rounded px-2 py-1">
                    <span>{nameOf(e.user_id)}</span>
                    <button
                      type="button"
                      disabled={busy}
                      className="text-xs text-red-600 hover:underline"
                      onClick={() => void doRemoveCo(e.user_id)}
                    >
                      移除
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div>
            <h4 className="font-medium text-gray-800 mb-2">协办变更审计</h4>
            <ul className="text-xs text-gray-600 space-y-1 max-h-36 overflow-y-auto">
              {coEvents.map((ev: Record<string, unknown>) => (
                <li key={ev.id as string}>
                  {(ev.created_at as string)?.slice(0, 19).replace('T', ' ')} {nameOf(ev.actor_id as string)}{' '}
                  {ev.action === 'add' ? '添加' : '移除'} {nameOf(ev.user_id as string)}
                  {ev.note ? `（${ev.note}）` : ''}
                </li>
              ))}
              {!coEvents.length && <li className="text-gray-400">暂无记录</li>}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
