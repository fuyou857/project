import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaWeixin } from 'react-icons/fa';
import { getAuthUrl, isWechatWorkAuthCallback, loginWithWechatWork, validateWechatWorkConfig } from '../services/wechatWorkService';
import { addLog, logModule, logAction } from '../services/logService';

interface WechatWorkLoginProps {
  onSuccess?: () => void;
  onError?: (message: string) => void;
}

export default function WechatWorkLogin({ onSuccess, onError }: WechatWorkLoginProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [configValid, setConfigValid] = useState(true);

  useEffect(() => {
    setConfigValid(validateWechatWorkConfig());
  }, []);

  useEffect(() => {
    const handleAuthCallback = async () => {
      if (isWechatWorkAuthCallback()) {
        setLoading(true);
        setError('');
        
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        
        if (code) {
          try {
            const result = await loginWithWechatWork(code);
            
            if (result.success) {
              addLog(logModule.SYSTEM, logAction.LOGIN, `企业微信登录成功: ${result.user?.name}`, { 
                userId: result.user?.userid, 
                userName: result.user?.name 
              });
              onSuccess?.();
              navigate('/dashboard');
            } else {
              setError(result.message);
              addLog(logModule.SYSTEM, logAction.LOGIN, `企业微信登录失败: ${result.message}`, {}, 'failed');
              onError?.(result.message);
            }
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : '登录失败';
            setError(msg);
            addLog(logModule.SYSTEM, logAction.LOGIN, `企业微信登录异常: ${msg}`, {}, 'failed');
            onError?.(msg);
          } finally {
            setLoading(false);
          }
        }
      }
    };

    handleAuthCallback();
  }, [navigate, onSuccess, onError]);

  const handleLogin = () => {
    if (!configValid || loading) return;
    
    try {
      const authUrl = getAuthUrl();
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
        <p className="text-slate-500 text-sm">企业微信登录功能暂未配置</p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-center gap-2 mb-4">
        <div className="flex-1 h-px bg-slate-600" />
        <span className="text-slate-500 text-sm">或</span>
        <div className="flex-1 h-px bg-slate-600" />
      </div>
      
      {error && (
        <div className="text-red-400 text-sm text-center mb-4 bg-red-500/10 py-2 rounded-lg">
          {error}
        </div>
      )}
      
      <motion.button
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
    </div>
  );
}