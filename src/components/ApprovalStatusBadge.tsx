import { useState, useEffect, useCallback } from 'react';
import { FaCheckCircle, FaClock, FaTimesCircle } from 'react-icons/fa';
import { getApprovalBySource, getApprovalHistory } from '../services/approvalService';
import { Modal } from './Modal';

interface ApprovalStatusBadgeProps {
  sourceType: string;
  sourceId: string;
  sourceName: string;
}

interface ApprovalSummary {
  id: string;
  status: string;
  current_step?: number;
}

interface HistoryRecord {
  action: string;
  step_name: string;
  approver_name: string;
  created_at: string;
  comment?: string | null;
}

export default function ApprovalStatusBadge({ sourceType, sourceId, sourceName }: ApprovalStatusBadgeProps) {
  const [approval, setApproval] = useState<ApprovalSummary | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const fetchApproval = useCallback(async () => {
    try {
      const data = await getApprovalBySource(sourceType, sourceId);
      setApproval(data as ApprovalSummary | null);
      if (data) {
        const hist = await getApprovalHistory(data.id);
        setHistory(hist as HistoryRecord[]);
      }
    } catch (error) {
      console.error('获取审批状态失败:', error);
    }
  }, [sourceType, sourceId]);

  useEffect(() => {
    void fetchApproval();
  }, [fetchApproval]);

  const getStatusInfo = () => {
    if (!approval) {
      return { text: '未提交审批', color: 'bg-gray-100 text-gray-500', icon: FaClock };
    }
    
    switch (approval.status) {
      case 'pending':
        return { text: `审批中 (第${approval.current_step}步)`, color: 'bg-yellow-100 text-yellow-600', icon: FaClock };
      case 'approved':
        return { text: '已通过', color: 'bg-green-100 text-green-600', icon: FaCheckCircle };
      case 'rejected':
        return { text: '已驳回', color: 'bg-red-100 text-red-600', icon: FaTimesCircle };
      case 'withdrawn':
        return { text: '已撤回', color: 'bg-gray-100 text-gray-500', icon: FaTimesCircle };
      default:
        return { text: '未知', color: 'bg-gray-100 text-gray-500', icon: FaClock };
    }
  };

  const status = getStatusInfo();
  const StatusIcon = status.icon;

  return (
    <>
      <button 
        onClick={() => approval && setShowHistory(true)}
        className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${status.color} ${approval ? 'cursor-pointer hover:opacity-80' : ''}`}
      >
        <StatusIcon className="w-3 h-3" />
        {status.text}
      </button>

      <Modal isOpen={showHistory} title={`审批历史 - ${sourceName}`} onClose={() => setShowHistory(false)}>
          <div className="space-y-3">
            {history.length === 0 ? (
              <div className="text-center text-gray-500 py-8">暂无审批记录</div>
            ) : (
              history.map((record, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
                    record.action === 'reject' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
                  }`}>
                    {record.action === 'reject' ? <FaTimesCircle className="w-3 h-3" /> : <FaCheckCircle className="w-3 h-3" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800">{record.step_name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        record.action === 'reject' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                      }`}>
                        {record.action === 'reject'
                          ? '驳回'
                          : record.action === 'skip'
                            ? '自动跳过'
                            : record.action === 'resubmit'
                              ? '重新提交'
                              : '通过'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {record.approver_name} · {new Date(record.created_at).toLocaleString('zh-CN')}
                    </div>
                    {record.comment && (
                      <div className="text-sm text-gray-600 mt-1">备注: {record.comment}</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Modal>
    </>
  );
}