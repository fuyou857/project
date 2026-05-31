import { FaSpinner, FaCheckCircle, FaExclamationTriangle, FaRedo } from 'react-icons/fa';

type TaskStatus = 'running' | 'success' | 'failed' | 'idle';

interface LongTaskStatusProps {
  status: TaskStatus;
  progress?: number;
  label?: string;
  errorMessage?: string;
  onRetry?: () => void;
  className?: string;
}

const statusConfig = {
  running: {
    icon: FaSpinner,
    text: '处理中…',
    barClass: 'bg-blue-500',
    textClass: 'text-blue-600',
  },
  success: {
    icon: FaCheckCircle,
    text: '已完成',
    barClass: 'bg-green-500',
    textClass: 'text-green-600',
  },
  failed: {
    icon: FaExclamationTriangle,
    text: '失败',
    barClass: 'bg-red-500',
    textClass: 'text-red-600',
  },
  idle: {
    icon: null,
    text: '',
    barClass: '',
    textClass: '',
  },
};

export default function LongTaskStatus({
  status,
  progress,
  label,
  errorMessage,
  onRetry,
  className = '',
}: LongTaskStatusProps) {
  if (status === 'idle') return null;

  const cfg = statusConfig[status];
  const Icon = cfg.icon;

  return (
    <div className={`rounded-lg border p-4 ${className} ${
      status === 'running' ? 'bg-blue-50 border-blue-200' :
      status === 'success' ? 'bg-green-50 border-green-200' :
      'bg-red-50 border-red-200'
    }`} role="status" aria-live="polite">
      <div className="flex items-center gap-2">
        {Icon && (
          <Icon className={`w-4 h-4 ${status === 'running' ? 'animate-spin' : ''} ${cfg.textClass}`} />
        )}
        <span className={`text-sm font-medium ${cfg.textClass}`}>
          {label || cfg.text}
        </span>
      </div>

      {status === 'running' && typeof progress === 'number' && (
        <div className="mt-2 w-full bg-white rounded-full h-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${cfg.barClass}`}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      )}

      {status === 'running' && typeof progress === 'number' && (
        <p className="text-xs text-gray-500 mt-1">{Math.round(progress)}%</p>
      )}

      {status === 'failed' && errorMessage && (
        <p className="text-xs text-red-600 mt-1">{errorMessage}</p>
      )}

      {status === 'failed' && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
        >
          <FaRedo className="w-3 h-3" />
          重试
        </button>
      )}
    </div>
  );
}