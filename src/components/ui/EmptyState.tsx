import React, { memo } from 'react';

type EmptyStateProps = {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

const EmptyState = memo(function EmptyState({
  title = '暂无数据',
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 py-12 px-4 text-center ${className}`}>
      <div className="text-base font-medium text-gray-600">{title}</div>
      {description ? <p className="max-w-md text-sm text-gray-500">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
});

export default EmptyState;
