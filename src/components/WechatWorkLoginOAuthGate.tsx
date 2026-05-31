import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getOAuthCallbackParams, loginWithWechatWork } from '../services/wechatWorkService';
import { addLog, logModule, logAction } from '../services/logService';

/**
 * 全局企微 OAuth 登录回调（App 层挂载，不依赖 Login 懒加载）。
 * 企微 redirect_uri 回调为 /login?code=…，须在任意路由下都能处理。
 */
export default function WechatWorkLoginOAuthGate() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshUser, user } = useAuth();
  const [status, setStatus] = useState<'idle' | 'processing' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const startedRef = useRef(false);

  // URL 已无 OAuth 参数时关闭遮罩（防止登录成功后 overlay 残留）
  useEffect(() => {
    if (getOAuthCallbackParams()) return;
    if (status === 'processing' && user) {
      setStatus('idle');
    }
  }, [location.pathname, location.search, location.hash, user, status]);

  useEffect(() => {
    const params = getOAuthCallbackParams();
    if (!params || params.state !== 'login') {
      return;
    }

    if (startedRef.current) {
      return;
    }

    startedRef.current = true;
    setStatus('processing');

    void (async () => {
      try {
        const result = await loginWithWechatWork(params.code);

        if (!result.success) {
          setStatus('error');
          setErrorMessage(result.message);
          addLog(logModule.SYSTEM, logAction.LOGIN, `企业微信登录失败: ${result.message}`, {}, 'failed');
          return;
        }

        await refreshUser();

        const cachedUser = localStorage.getItem('user');
        if (!cachedUser) {
          setStatus('error');
          setErrorMessage('用户信息加载失败，请刷新页面或联系管理员');
          return;
        }

        addLog(
          logModule.SYSTEM,
          logAction.LOGIN,
          `企业微信登录成功: ${result.user?.wechat_name || ''}`,
          {
            userId: result.user?.id,
            wechatUserid: result.user?.wechat_userid,
          },
        );

        navigate('/dashboard', { replace: true });
        setStatus('idle');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '登录失败';
        setStatus('error');
        setErrorMessage(msg);
        addLog(logModule.SYSTEM, logAction.LOGIN, `企业微信登录异常: ${msg}`, {}, 'failed');
      }
    })();
  }, [navigate, refreshUser]);

  if (status === 'idle') {
    return null;
  }

  if (status === 'error') {
    return (
      <div
        role="alert"
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/80 p-4"
      >
        <div className="max-w-md w-full rounded-xl bg-slate-800 border border-red-500/30 p-6 text-center">
          <p className="text-red-400 text-sm mb-4">{errorMessage}</p>
          <button
            type="button"
            onClick={() => {
              setStatus('idle');
              navigate('/login', { replace: true });
            }}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
          >
            返回登录页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-900/90"
    >
      <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-slate-300 text-sm">企业微信登录中，请稍候…</p>
    </div>
  );
}
