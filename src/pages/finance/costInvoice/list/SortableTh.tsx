import { FaSort, FaSortDown, FaSortUp } from 'react-icons/fa';
import type { SortField, SortState } from './types';

type Props = {
  label: string;
  field: SortField;
  sort: SortState;
  onSort: (field: SortField) => void;
  className?: string;
  align?: 'left' | 'right' | 'center';
};

export default function SortableTh({ label, field, sort, onSort, className = '', align = 'left' }: Props) {
  const active = sort.field === field;
  let Icon = FaSort;
  if (active && sort.direction === 'asc') Icon = FaSortUp;
  if (active && sort.direction === 'desc') Icon = FaSortDown;

  const alignClass =
    align === 'right' ? 'text-right justify-end' : align === 'center' ? 'text-center justify-center' : 'text-left';

  return (
    <th className={`${className} ${alignClass}`}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`inline-flex min-h-[44px] w-full items-center gap-1 font-medium text-gray-600 transition hover:text-blue-600 active:scale-[0.98] ${alignClass}`}
      >
        {label}
        <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-blue-600' : 'text-gray-400'}`} aria-hidden />
      </button>
    </th>
  );
}
