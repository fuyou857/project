import { SegmentedControl } from '../../../../components/ui';

type Props = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
};

export default function CostInvoicePagination({ page, pageSize, total, onPageChange, onPageSizeChange }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-3 border-t border-gray-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
        <span>共 {total} 条</span>
        <div className="flex items-center gap-2">
          <span>每页</span>
          <SegmentedControl
            value={String(pageSize)}
            onChange={(v) => onPageSizeChange(Number(v))}
            options={[
              { value: '10', label: '10条' },
              { value: '20', label: '20条' },
              { value: '50', label: '50条' },
            ]}
            aria-label="每页条数"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="min-h-[44px] rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
        >
          上一页
        </button>
        <span className="px-2 text-sm text-gray-600">
          第
          <input
            type="number"
            min={1}
            max={totalPages}
            value={page}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isNaN(n) && n >= 1 && n <= totalPages) onPageChange(n);
            }}
            className="ui-input mx-2 inline-block w-14 min-h-[44px] py-1 text-center"
          />
          / {totalPages} 页
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="min-h-[44px] rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
        >
          下一页
        </button>
      </div>
    </div>
  );
}
