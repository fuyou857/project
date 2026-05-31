import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaWeixin } from 'react-icons/fa';
import {
  fetchWechatWorkPublicConfig,
  getAuthUrl,
  validateWechatWorkConfig,
} from '../services/wechatWorkService';

interface WechatWorkLoginProps {
  onError?: (message: string) => void;
}

function isLoginRoute(location: ReturnType<typeof useLocation>): boolean {
  const hashRoute = location.hash.startsWith('#') ? location.hash.slice(1) : '';
  return (
    location.pathname === '/login' ||
    hashRoute === '/login' ||
    hashRoute.startsWith('/login?') ||
    window.location.pathname === '/login'
  );
}

/** 登录页企微扫码入口（OAuth 回调由 App 层 WechatWorkLoginOAuthGate 处理） */
export default function WechatWorkLogin({ onError }: WechatWorkLoginProps) {
  const location = useLocation();
  const [loading] = useState(false);
  const [error, setError] = useState('');
  const [configValid, setConfigValid] = useState(false);
  const onLoginRoute = isLoginRoute(location);

  useEffect(() => {
    if (!onLoginRoute) return;
    (async () => {
      const remote = await fetchWechatWorkPublicConfig();
      setConfigValid(remote?.configured ?? validateWechatWorkConfig());
    })();
  }, [onLoginRoute]);

  if (!onLoginRoute) {
    return null;
  }

  const handleLogin = () => {
    if (!configValid || loading) return;
    try {
      const authUrl = getAuthUrl('login');
      window.location.href = authUrl;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '跳转失败';
      setError(msg);
      onError?.(msg);
    }
  };

  if (!configValid) {
    return (
      <div className="text-center py-4">
        <p className="text-slate-500 text-sm">企业微信登录未配置（请在 API 密钥中心配置 wechat_work）</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="mt-6"
    >
      <div className="flex items-center justify-center gap-2 mb-4">
        <div className="flex-1 h-px bg-slate-600" />
        <span className="text-slate-500 text-sm">或</span>
        <div className="flex-1 h-px bg-slate-600" />
      </div>

      {error && (
        <div className="text-red-400 text-sm text-center mb-4 bg-red-500/10 py-2 rounded-lg">{error}</div>
      )}

      <motion.button
        type="button"
        onClick={handleLogin}
        disabled={loading}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <FaWeixin className="text-lg" />
        )}
        {loading ? '登录中...' : '使用企业微信登录'}
      </motion.button>
    </motion.div>
  );
}
