import { type HTMLAttributes } from 'react';

type SkeletonVariant = 'text' | 'card' | 'table-row' | 'avatar' | 'button';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: SkeletonVariant;
  rows?: number;
  width?: string | number;
  height?: string | number;
  className?: string;
}

const variantClasses: Record<SkeletonVariant, string> = {
  text: 'h-4 rounded',
  card: 'h-32 rounded-lg',
  'table-row': 'h-10 rounded',
  avatar: 'h-10 w-10 rounded-full',
  button: 'h-9 rounded-md',
};

export default function Skeleton({
  variant = 'text',
  rows = 1,
  width,
  height,
  className = '',
  ...rest
}: SkeletonProps) {
  const baseClass =
    'bg-gray-200 animate-pulse ' + (variantClasses[variant] || variantClasses.text);

  const items = Array.from({ length: rows }, (_, i) => (
    <div
      key={i}
      className={`${baseClass} ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
      aria-hidden="true"
      {...rest}
    />
  ));

  return rows > 1 ? <div className="space-y-2">{items}</div> : <>{items}</>;
}