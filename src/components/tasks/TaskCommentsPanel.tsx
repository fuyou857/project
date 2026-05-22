import { useCallback, useEffect, useState } from 'react';
import { FaChevronDown, FaChevronUp, FaComments } from 'react-icons/fa';
import { fetchTaskCommentsWithAuthors, type TaskCommentWithAuthor } from '../../services/taskCommentService';
import { submitTaskComment } from '../../services/taskService';

const PREVIEW = 3;

function avatarLetter(name: string) {
  const s = name.trim();
  if (!s) return '?';
  return s.slice(0, 1).toUpperCase();
}

export default function TaskCommentsPanel(props: {
  taskId: string;
  currentUserId: string;
  canPost: boolean;
  /** 列表内嵌时略紧凑 */
  compact?: boolean;
  onPosted?: () => void;
}) {
  const { taskId, currentUserId, canPost, compact, onPosted } = props;
  const [rows, setRows] = useState<TaskCommentWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const list = await fetchTaskCommentsWithAuthors(taskId);
      setRows(list);
    } catch (e) {
      setErr((e as Error).message || '加载评论失败');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSend() {
    if (!canPost || !currentUserId) return;
    const t = draft.trim();
    if (!t) return;
    setSending(true);
    setErr(null);
    try {
      await submitTaskComment(taskId, currentUserId, t);
      setDraft('');
      await load();
      onPosted?.();
    } catch (e) {
      setErr((e as Error).message || '发送失败');
    } finally {
      setSending(false);
    }
  }

  const displayList = expanded ? rows : rows.slice(-PREVIEW);
  const hasMore = rows.length > PREVIEW;

  return (
    <div
      className={
      compact ?
      'rounded-lg border border-gray-200 bg-gray-50/80 p-3 space-y-2' :
      'rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3'
      }>
      
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-gray-800 font-medium text-sm">
          <FaComments className="text-blue-600" />
          任务交流与评论
          {!loading && <span className="text-xs font-normal text-gray-400">（{rows.length} 条）</span>}
        </div>
        {hasMore &&
        <button
          type="button"
          className="text-xs text-blue-600 flex items-center gap-1 hover:underline"
          onClick={() => setExpanded(!expanded)}>
          
            {expanded ?
          <>
                收起 <FaChevronUp className="w-3 h-3" />
              </> :

          <>
                查看全部 <FaChevronDown className="w-3 h-3" />
              </>
          }
          </button>
        }
      </div>

      {!expanded && hasMore &&
      <p className="text-xs text-gray-500">默认显示最新 {PREVIEW} 条，点击「查看全部」展开。</p>
      }

      {(() => {if (loading) {return (
            <div className="text-sm text-gray-500 py-2">加载中…</div>);} else {if (
          err) {return (
              <div className="text-sm text-red-600">{err}</div>);} else {return (

              <ul className="space-y-3 max-h-72 overflow-y-auto">
          {displayList.length === 0 ?
                <li className="text-sm text-gray-400">暂无评论</li> :

                displayList.map((c) => {
                  const au = c.author;
                  const display = au?.real_name || au?.username || c.author_id.slice(0, 8);
                  return (
                    <li key={c.id} className="flex gap-3 text-sm border-b border-gray-100 pb-3 last:border-0">
                  <div
                        className={
                        'shrink-0 rounded-full bg-blue-100 text-blue-800 font-semibold flex items-center justify-center ' + (
                        compact ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm')
                        }
                        title={display}>
                        
                    {avatarLetter(display)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="font-medium text-gray-900">{display}</span>
                      <span className="text-xs text-gray-400">
                        {c.created_at?.slice(0, 19).replace('T', ' ')}
                      </span>
                    </div>
                    <p className="text-gray-700 whitespace-pre-wrap mt-1 break-words">{c.body}</p>
                  </div>
                </li>);

                })
                }
        </ul>);}}})()
      }

      {canPost && currentUserId &&
      <div className="pt-1 border-t border-gray-100 space-y-2">
          <label className="block text-xs text-gray-600">
            发表评论
            <textarea
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm text-gray-800 min-h-[64px]"
            placeholder="对任务办理情况进行说明或指导…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={5000} />
          
          </label>
          <button
          type="button"
          disabled={sending || !draft.trim()}
          onClick={() => void onSend()}
          className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm disabled:opacity-50">
          
            {sending ? '发送中…' : '发送'}
          </button>
        </div>
      }

      {!canPost && currentUserId &&
      <p className="text-xs text-gray-400">您当前为只读视角，仅发布人与执行团队可发表评论。</p>
      }
    </div>);

}