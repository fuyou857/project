import React from 'react';
import { recordUiMetric } from '../../utils/uiMetrics';

export type SegmentOption<T extends string = string> = { value: T; label: string; disabled?: boolean };

type SegmentedControlProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
  className?: string;
  disabled?: boolean;
  'aria-label'?: string;
  /** 埋点上下文，如 `page:todo_tasks:filter_status` */
  metricsContext?: string;
};

export default function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className = '',
  disabled = false,
  'aria-label': ariaLabel,
  metricsContext,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`flex flex-wrap gap-1.5 rounded-lg border border-gray-200 bg-gray-100 p-1 ${className}`}
    >
      {options.map(opt => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled || opt.disabled}
            onClick={() => {
              if (disabled || opt.disabled) return;
              if (metricsContext && opt.value !== value) {
                recordUiMetric('segmented_change', { context: metricsContext, from: value, to: opt.value });
              }
              onChange(opt.value);
            }}
            className={`min-h-[40px] rounded-md px-3 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${
              active
                ? 'border border-gray-200 bg-white text-blue-800 shadow-sm'
                : 'border border-transparent text-gray-600 hover:text-gray-900'
            } ${disabled || opt.disabled ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
