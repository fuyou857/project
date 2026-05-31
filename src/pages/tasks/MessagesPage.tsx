import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaCheck, FaCheckDouble } from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getReminderDays,
  saveReminderDays,
  type NotificationRow,
} from '../../services/notificationService';
import { useSingleToast } from '../../hooks/useSingleToast';
import { errorMessageFromUnknown } from '../../utils/httpErrorMessage';

export default function MessagesPage() {
  const { user } = useAuth();
  const uid = user?.id ?? '';
  const [list, setList] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [daysStr, setDaysStr] = useState('1,3,7');
  const [prefsSaved, setPrefsSaved] = useState(false);
  const { showToast } = useSingleToast();

  const load = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const [rows, days] = await Promise.all([fetchNotifications(uid), getReminderDays(uid)]);
      setList(rows);
      setDaysStr(days.join(','));
    } catch (e) {
      console.error(e);
      showToast('error', '加载通知失败');
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onMarkRead(n: NotificationRow) {
    if (!uid || n.read_at) return;
    try {
      await markNotificationRead(n.id, uid);
      await load();
    } catch (e) {
      showToast('error', errorMessageFromUnknown(e, '标记已读失败'));
    }
  }

  async function onMarkAll() {
    if (!uid) return;
    try {
      await markAllNotificationsRead(uid);
      await load();
    } catch (e) {
      showToast('error', errorMessageFromUnknown(e, '全部已读失败'));
    }
  }

  async function onSavePrefs() {
    if (!uid) return;
    const parts = daysStr
      .split(/[,，\s]+/)
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !Number.isNaN(n));
    try {
      await saveReminderDays(uid, parts);
      setPrefsSaved(true);
      setTimeout(() => setPrefsSaved(false), 2000);
    } catch (e) {
      showToast('error', errorMessageFromUnknown(e, '保存偏好失败'));
    }
  }

  if (!uid) {
    return <div className="p-6 text-gray-500">请先登录</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">消息中心</h1>
        <button
          type="button"
          onClick={() => void onMarkAll()}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          <FaCheckDouble className="w-4 h-4" />
          全部标为已读
        </button>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-2">
        <h2 className="text-sm font-medium text-gray-800">任务截止提醒偏好</h2>
        <p className="text-xs text-gray-500">
          在首页进入时，系统会按「距离验收日剩余天数」等于下列数值时各生成一条提醒（同一天不重复）。与 Dashboard「即将到期」列表逻辑一致。
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm text-gray-600">
            提前天数（逗号分隔）
            <input
              className="mt-1 block w-48 border rounded-lg px-3 py-2 text-gray-900"
              value={daysStr}
              onChange={e => setDaysStr(e.target.value)}
              placeholder="例如 1,3,7"
            />
          </label>
          <button
            type="button"
            onClick={() => void onSavePrefs()}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm"
          >
            保存偏好
          </button>
          {prefsSaved && <span className="text-sm text-green-600">已保存</span>}
        </div>
      </section>

      {loading ? (
        <div className="text-gray-500">加载中…</div>
      ) : (
        <ul className="space-y-2">
          {list.map(n => {
            const taskId = (n.payload as { task_id?: string })?.task_id;
            const unread = !n.read_at;
            return (
              <li
                key={n.id}
                className={`rounded-xl border p-4 shadow-sm ${unread ? 'border-blue-200 bg-blue-50/40' : 'border-gray-200 bg-white'}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-gray-900">{n.title}</div>
                    {n.body && <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{n.body}</p>}
                    <div className="text-xs text-gray-400 mt-2">
                      {n.created_at?.slice(0, 19).replace('T', ' ')} · {n.category}
                    </div>
                    {taskId && (
                      <Link to={`/tasks/${taskId}`} className="text-sm text-blue-600 mt-2 inline-block">
                        查看任务
                      </Link>
                    )}
                  </div>
                  {unread && (
                    <button
                      type="button"
                      onClick={() => void onMarkRead(n)}
                      className="shrink-0 inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-gray-300 text-gray-700 hover:bg-white"
                    >
                      <FaCheck className="w-3 h-3" />
                      已读
                    </button>
                  )}
                </div>
              </li>
            );
          })}
          {!list.length && <li className="text-gray-400 text-sm">暂无消息</li>}
        </ul>
      )}
    </div>
  );
}
