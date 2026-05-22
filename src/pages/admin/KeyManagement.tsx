import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaKey, FaExclamationTriangle, FaCheckCircle, FaClock, FaBell, FaBellSlash, FaRedo } from 'react-icons/fa';
import { generateKeyMetadata, checkKeyExpiryStatus, formatDaysRemaining, getKeyStatusColor } from '../../config/keyManagement';
import { getActiveAlerts, acknowledgeAlert, acknowledgeAllAlerts, getAlertSummary, getSeverityColor, getSeverityLabel, type Alert } from '../../services/monitoringService';

const mockKeyMetadata = [
generateKeyMetadata('supabase_anon', 'anon'),
generateKeyMetadata('supabase_service_role', 'service_role')];


export default function KeyManagement() {
  const [keys, setKeys] = useState(mockKeyMetadata);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertSummary, setAlertSummary] = useState(getAlertSummary());

  useEffect(() => {
    const updateAlerts = () => {
      setAlerts(getActiveAlerts());
      setAlertSummary(getAlertSummary());
    };

    updateAlerts();
    const interval = setInterval(updateAlerts, 60000);

    return () => clearInterval(interval);
  }, []);

  const handleAcknowledgeAlert = (alertId: string) => {
    acknowledgeAlert(alertId);
    setAlerts(getActiveAlerts());
    setAlertSummary(getAlertSummary());
  };

  const handleAcknowledgeAll = () => {
    acknowledgeAllAlerts();
    setAlerts([]);
    setAlertSummary({ total: 0, critical: 0, high: 0, medium: 0, low: 0 });
  };

  const handleRotateKey = (keyId: string) => {
    alert(`密钥 ${keyId} 的轮换流程已启动，请在 Supabase 控制台生成新密钥并更新环境变量`);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-800">密钥管理</h3>
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-sm">轮换周期：</span>
          <span className="px-2 py-1 bg-blue-500 text-gray-800 rounded text-xs">60-90 天</span>
        </div>
      </div>

      {alertSummary.total > 0 &&
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
        
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FaBell className="text-orange-500" size={20} />
              <div>
                <p className="text-gray-800 font-medium">存在 {alertSummary.total} 个待处理告警</p>
                <p className="text-gray-500 text-sm">
                  {alertSummary.critical > 0 && <span className="text-red-500">{alertSummary.critical} 严重 </span>}
                  {alertSummary.high > 0 && <span className="text-orange-500">{alertSummary.high} 高 </span>}
                  {alertSummary.medium > 0 && <span className="text-yellow-500">{alertSummary.medium} 中</span>}
                </p>
              </div>
            </div>
            <button
            onClick={handleAcknowledgeAll}
            className="px-4 py-2 bg-orange-600 text-gray-800 rounded-lg hover:bg-orange-700 text-sm">
            
              全部确认
            </button>
          </div>
        </motion.div>
      }

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <FaKey className="text-blue-400" /> 密钥状态
          </h4>
          <div className="space-y-4">
            {keys.map((key) => {
              const status = checkKeyExpiryStatus(key);
              const statusColor = getKeyStatusColor(status);
              const daysRemaining = formatDaysRemaining(key.expiresAt);

              return (
                <motion.div
                  key={key.keyId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${statusColor}`} />
                      <div>
                        <p className="font-medium text-gray-800">{key.keyId}</p>
                        <p className="text-sm text-gray-500">{key.keyType}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">到期剩余</p>
                      <p className={`font-medium ${(() => {if (status === 'expired') {return 'text-red-500';} else {if (status === 'pending_rotation') {return 'text-yellow-500';} else {return 'text-gray-800';}}})()}`}>
                        {daysRemaining}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-400">
                      创建于 {new Date(key.createdAt).toLocaleDateString()}
                    </div>
                    <button
                      onClick={() => handleRotateKey(key.keyId)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-gray-500 text-gray-800 rounded text-sm hover:bg-gray-600">
                      
                      <FaRedo size={14} />
                      轮换密钥
                    </button>
                  </div>
                </motion.div>);

            })}
          </div>
        </div>

        <div>
          <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <FaExclamationTriangle className="text-yellow-400" /> 告警列表
          </h4>
          
          {alerts.length > 0 ?
          <div className="space-y-3">
              {alerts.map((alert) =>
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-4 bg-gray-50 rounded-lg border-l-4 border-gray-400"
              style={{ borderLeftColor: getSeverityColor(alert.severity) }}>
              
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full mt-2 ${getSeverityColor(alert.severity)}`} />
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-xs text-gray-800 ${getSeverityColor(alert.severity)}`}>
                            {getSeverityLabel(alert.severity)}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(alert.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-gray-700 text-sm">{alert.message}</p>
                      </div>
                    </div>
                    <button
                  onClick={() => handleAcknowledgeAlert(alert.id)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                  title="确认告警">
                  
                      <FaBellSlash size={16} />
                    </button>
                  </div>
                </motion.div>
            )}
            </div> :

          <div className="text-center py-12">
              <FaCheckCircle className="mx-auto text-green-400 mb-3" size={48} />
              <p className="text-gray-500">暂无告警</p>
              <p className="text-gray-400 text-sm mt-1">所有密钥状态正常</p>
            </div>
          }
        </div>
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
          <FaClock className="text-blue-400" /> 轮换策略说明
        </h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• 建议每 60-90 天轮换一次服务端密钥</li>
          <li>• 系统会在密钥过期前 30 天发送轮换提醒</li>
          <li>• 密钥过期前 7 天升级为高优先级告警</li>
          <li>• 建议使用 AWS KMS 或 HashiCorp Vault 管理生产环境密钥</li>
        </ul>
      </div>
    </div>);

}