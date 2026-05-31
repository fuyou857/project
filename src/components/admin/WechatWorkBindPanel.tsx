import { useState } from 'react';
import { FaWeixin, FaUnlink, FaSearch } from 'react-icons/fa';
import {
  bindWechatWorkUser,
  bindWechatWorkWithCode,
  getAuthUrl,
  resolveWechatWorkUser,
  unbindWechatWorkUser,
  fetchWechatWorkPublicConfig,
} from '../../services/wechatWorkService';
import { clearOAuthCallbackFromUrl, getOAuthCallbackParams } from '../../services/wechatWorkService';
import type { User } from '../../services/userService';

type Props = {
  user: User;
  onUpdated: () => void;
  showToast: (type: 'success' | 'error', message: string) => void;
  canManage: boolean;
};

export default function WechatWorkBindPanel({ user, onUpdated, showToast, canManage }: Props) {
  const [userid, setUserid] = useState(user.wechat_work_userid || '');
  const [name, setName] = useState(user.wechat_work_name || '');
  const [loading, setLoading] = useState(false);

  if (!canManage) {
    return (
      <div className="text-sm text-gray-500">
        企业微信：{user.wechat_work_userid ? `${user.wechat_work_name || ''} (${user.wechat_work_userid})` : '未绑定'}
      </div>
    );
  }

  async function handleLookup() {
    const id = userid.trim();
    if (!id) {
      showToast('error', '请输入企业微信 UserID');
      return;
    }
    setLoading(true);
    try {
      const member = await resolveWechatWorkUser(id);
      setName(member.name);
      showToast('success', `已找到成员：${member.name}`);
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : '查询失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveBind() {
    const id = userid.trim();
    if (!id) {
      showToast('error', '请输入企业微信 UserID');
      return;
    }
    setLoading(true);
    try {
      await bindWechatWorkUser(user.id, id, name.trim());
      showToast('success', '企业微信绑定成功');
      onUpdated();
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : '绑定失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleUnbind() {
    if (!window.confirm('确定解除该企业微信绑定？解除后无法扫码登录。')) return;
    setLoading(true);
    try {
      await unbindWechatWorkUser(user.id);
      setUserid('');
      setName('');
      showToast('success', '已解除绑定');
      onUpdated();
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : '解绑失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleScanBind() {
    const cfg = await fetchWechatWorkPublicConfig();
    if (!cfg?.configured) {
      showToast('error', '企业微信未配置');
      return;
    }
    sessionStorage.setItem('wechat_bind_target_user_id', user.id);
    window.location.href = getAuthUrl(`bind:${user.id}`);
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <FaWeixin className="text-green-600" />
        企业微信绑定
      </div>
      <p className="text-xs text-gray-500">
        绑定后该用户可使用「企业微信扫码登录」。UserID 可在企微管理后台成员详情中查看。
      </p>
      <div className="flex gap-2">
        <input
          value={userid}
          onChange={(e) => setUserid(e.target.value)}
          placeholder="企业微信 UserID"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
        <button
          type="button"
          disabled={loading}
          onClick={() => void handleLookup()}
          className="px-3 py-2 rounded-lg border border-gray-300 text-sm hover:bg-white disabled:opacity-50"
          title="校验 UserID"
        >
          <FaSearch />
        </button>
      </div>
      {name && <p className="text-sm text-gray-600">企微姓名：{name}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => void handleSaveBind()}
          className="px-3 py-2 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700 disabled:opacity-50"
        >
          保存绑定
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => void handleScanBind()}
          className="px-3 py-2 rounded-lg border border-green-600 text-green-700 text-sm hover:bg-green-50 disabled:opacity-50"
        >
          扫码绑定
        </button>
        {user.wechat_work_userid && (
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleUnbind()}
            className="px-3 py-2 rounded-lg border border-red-300 text-red-600 text-sm hover:bg-red-50 disabled:opacity-50 flex items-center gap-1"
          >
            <FaUnlink className="w-3 h-3" />
            解除绑定
          </button>
        )}
      </div>
    </div>
  );
}

/** 处理扫码绑定回调（挂在 Layout） */
export async function handleWechatBindOAuthCallback(
  showToast: (type: 'success' | 'error', message: string) => void,
): Promise<boolean> {
  const params = getOAuthCallbackParams();
  if (!params?.code || !params.state.startsWith('bind:')) return false;

  const targetUserId =
    params.state.slice(5) || sessionStorage.getItem('wechat_bind_target_user_id') || '';
  if (!targetUserId) {
    showToast('error', '绑定目标用户丢失，请重新操作');
    clearOAuthCallbackFromUrl();
    return true;
  }

  try {
    const result = await bindWechatWorkWithCode(params.code, targetUserId);
    sessionStorage.removeItem('wechat_bind_target_user_id');
    clearOAuthCallbackFromUrl();
    showToast('success', `已绑定企业微信：${result.wechat_work_name}`);
    return true;
  } catch (e) {
    clearOAuthCallbackFromUrl();
    showToast('error', e instanceof Error ? e.message : '扫码绑定失败');
    return true;
  }
}
