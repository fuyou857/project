import React from 'react';

interface DrillDownButtonProps {
  count: number | string;
  label?: string;
  onClick: () => void;
  className?: string;
}

export const DrillDownButton: React.FC<DrillDownButtonProps> = ({
  count,
  label,
  onClick,
  className,
}) => {
  return (
    <button
      onClick={onClick}
      className={`cursor-pointer hover:text-blue-600 transition-colors ${className || ''}`}
      title="点击查看明细"
      type="button"
    >
      <span className="font-semibold">{count}</span>
      {label && <span className="ml-1 text-sm">{label}</span>}
    </button>
  );
};