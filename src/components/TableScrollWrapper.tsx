import { type ReactNode } from 'react';

interface TableScrollWrapperProps {
  children: ReactNode;
  className?: string;
}

/**
 * 横向滚动表格容器（用于移动端适配）
 * 包裹原生 `<table>` 使其在小屏时可左右滑动
 *
 * @example
 * <TableScrollWrapper>
 *   <table>...</table>
 * </TableScrollWrapper>
 */
export default function TableScrollWrapper({ children, className = '' }: TableScrollWrapperProps) {
  return (
    <div className={`overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm ${className}`}>
      <div className="inline-block min-w-full align-middle">
        {children}
      </div>
      <div className="md:hidden text-center text-[10px] text-gray-400 py-1 border-t border-gray-100 select-none">
        ← 左右滑动查看更多 →
      </div>
    </div>
  );
}