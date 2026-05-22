import { useEffect, useRef, useState } from 'react';
import { FaChevronDown, FaEdit, FaEye, FaTrash, FaLink } from 'react-icons/fa';

type Props = {
  canEdit: boolean;
  canDelete: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAssociate: () => void;
};

export default function CostInvoiceActionMenu({ canEdit, canDelete, onView, onEdit, onDelete, onAssociate }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const itemClass =
    'flex min-h-[44px] w-full items-center gap-2 px-4 py-2 text-left text-sm transition hover:bg-gray-50 active:bg-gray-100';

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 active:scale-[0.98]"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        操作
        <FaChevronDown className={`h-3 w-3 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 min-w-[8.5rem] overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          <button type="button" role="menuitem" className={`${itemClass} text-gray-800`} onClick={() => { setOpen(false); onView(); }}>
            <FaEye className="text-blue-600" /> 查看
          </button>
          <button type="button" role="menuitem" className={`${itemClass} text-gray-800`} onClick={() => { setOpen(false); onAssociate(); }}>
            <FaLink className="text-blue-600" /> 关联业务
          </button>
          {canEdit && (
            <button type="button" role="menuitem" className={`${itemClass} text-gray-800`} onClick={() => { setOpen(false); onEdit(); }}>
              <FaEdit className="text-amber-600" /> 编辑
            </button>
          )}
          {canDelete && (
            <button type="button" role="menuitem" className={`${itemClass} text-red-600`} onClick={() => { setOpen(false); onDelete(); }}>
              <FaTrash /> 删除
            </button>
          )}
        </div>
      )}
    </div>
  );
}
