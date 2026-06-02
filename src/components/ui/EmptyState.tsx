import React, { memo } from 'react';

type EmptyStateType = 'default' | 'search' | 'no-permission' | 'error';

const presetIcons: Record<EmptyStateType, string> = {
  default: '\u{1F4ED}',
  search: '\u{1F50D}',
  'no-permission': '\u{1F512}',
  error: '\u26A0\uFE0F',
};

type EmptyStateProps = {
  title?: string;
  description?: string;
  type?: EmptyStateType;
  action?: React.ReactNode;
  actionText?: string;
  onAction?: () => void;
  className?: string;
};

const EmptyState = memo(function EmptyState({
  title = '暂无数据',
  description,
  type = 'default',
  action,
  actionText,
  onAction,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 py-12 px-4 text-center ${className}`}>
      {type ? (
        <div className="text-4xl mb-1 leading-none">{presetIcons[type]}</div>
      ) : null}
      <div className="text-base font-medium text-gray-600">{title}</div>
      {description ? <p className="max-w-md text-sm text-gray-500">{description}</p> : null}
      {action ? (
        <div className="mt-2">{action}</div>
      ) : actionText && onAction ? (
        <button
          onClick={onAction}
          className="mt-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
        >
          {actionText}
        </button>
      ) : null}
    </div>
  );
});

export default EmptyState;
