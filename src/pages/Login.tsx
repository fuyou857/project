import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaBuilding, FaLock, FaUser } from 'react-icons/fa';
import { useAuth } from '../hooks/useAuth';
import { addLog, logModule, logAction } from '../services/logService';
import WechatWorkLogin from '../components/WechatWorkLogin';

export default function Login() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const DEFAULT_DOMAIN = 'ciond.com';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('请输入用户名和密码');
      return;
    }
    setLoading(true);
    setError('');

    let loginEmail = email.trim();
    if (!loginEmail.includes('@')) {
      loginEmail = `${loginEmail}@${DEFAULT_DOMAIN}`;
    }

    try {
      const { error: authError } = await signIn(loginEmail, password);
      
      if (authError) {
        console.error('登录错误:', authError);
        let errorMsg = '用户名或密码错误';
        if (authError.message?.includes('email not confirmed')) {
          errorMsg = '邮箱未验证，请先验证邮箱';
        } else if (authError.message?.includes('invalid credentials')) {
          errorMsg = '邮箱或密码不正确';
        } else if (authError.message) {
          errorMsg = authError.message;
        }
        setError(errorMsg);
        addLog(logModule.SYSTEM, logAction.LOGIN, `登录失败: ${loginEmail}`, { email: loginEmail }, 'failed');
        setLoading(false);
        return;
      }

      addLog(logModule.SYSTEM, logAction.LOGIN, `登录成功: ${loginEmail}`, { email: loginEmail });
      navigate('/dashboard');

    } catch (err: unknown) {
      console.error('登录异常:', err);
      setError('登录失败，请稍后重试');
      addLog(logModule.SYSTEM, logAction.LOGIN, `登录异常: ${loginEmail}`, { email: loginEmail }, 'failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-slate-800 rounded-2xl shadow-2xl p-8 border border-slate-700">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <FaBuilding className="text-white text-2xl" />
            </div>
            <h1 className="text-2xl font-bold text-white">建筑管理平台</h1>
            <p className="text-slate-400 mt-2">请登录您的账号</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-slate-400 text-sm mb-2">用户名 / 邮箱</label>
              <div className="relative">
                <FaUser className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                  placeholder="请输入用户名或邮箱"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                  {!email.includes('@') && email.trim() && `@${DEFAULT_DOMAIN}`}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-slate-400 text-sm mb-2">密码</label>
              <div className="relative">
                <FaLock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                  placeholder="请输入密码"
                />
              </div>
            </div>

            {error && (
              <div className="text-red-400 text-sm text-center bg-red-500/10 py-2 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : null}
              {loading ? '登录中...' : '登录'}
            </button>
          </form>
          
          <WechatWorkLogin />
        </div>
      </motion.div>
    </div>
  );
}
