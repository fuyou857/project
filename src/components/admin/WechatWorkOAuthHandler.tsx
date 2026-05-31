import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getOAuthCallbackParams } from '../../services/wechatWorkService';
import { handleWechatBindOAuthCallback } from './WechatWorkBindPanel';

type Props = {
  showToast: (type: 'success' | 'error', message: string) => void;
};

/** 全局处理企微 OAuth 绑定回调（state=bind:用户ID） */
export default function WechatWorkOAuthHandler({ showToast }: Props) {
  const navigate = useNavigate();

  useEffect(() => {
    const params = getOAuthCallbackParams();
    if (!params?.code || !params.state.startsWith('bind:')) return;

    void (async () => {
      const handled = await handleWechatBindOAuthCallback(showToast);
      if (handled && !window.location.pathname.startsWith('/admin')) {
        navigate('/admin/users', { replace: true });
      }
    })();
  }, [navigate, showToast]);

  return null;
}
