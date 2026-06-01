import { memo } from 'react';

interface ContractListPaginationProps {
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/** 合同列表页底部分页条（收入/支出合同列表共用） */
const ContractListPagination = memo(function ContractListPagination({
  total,
  page,
  totalPages,
  onPageChange,
}: ContractListPaginationProps) {
  if (total <= 0) return null;

  return (
    <div className="flex items-center justify-between pt-4 border-t border-gray-200">
      <div className="text-gray-500 text-sm">共 {total} 条</div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="px-3 py-1 bg-gray-50 rounded text-gray-800 disabled:opacity-50"
        >
          上一页
        </button>
        <span className="text-gray-500">
          {page} / {totalPages || 1}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="px-3 py-1 bg-gray-50 rounded text-gray-800 disabled:opacity-50"
        >
          下一页
        </button>
      </div>
    </div>
  );
});

export default ContractListPagination;
