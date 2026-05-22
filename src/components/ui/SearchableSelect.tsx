import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FaChevronDown, FaSearch, FaTimes } from 'react-icons/fa';
import { useMediaQueryMaxWidth } from '../../hooks/useMediaQuery';
import { recordUiMetric } from '../../utils/uiMetrics';

export type UiSelectOption = { value: string; label: string; disabled?: boolean };

export type SearchableSelectProps = {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  options: UiSelectOption[];
  /** Shown on trigger when value is empty */
  placeholder?: string;
  /** Placeholder inside search field (list / sheet) */
  searchPlaceholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  /** When true, empty string is valid and shows placeholder on trigger */
  allowEmpty?: boolean;
  emptyLabel?: string;
  /** Open search input when option count >= this (default: 8) */
  searchThreshold?: number;
  /** 埋点上下文，如 `page:receipt_registration:filter_project` */
  metricsContext?: string;
};

function normalize(s: string) {
  return s.trim().toLowerCase();
}

export default function SearchableSelect({
  id: idProp,
  name,
  value,
  onChange,
  options,
  placeholder = '请选择',
  searchPlaceholder = '输入关键字筛选…',
  disabled = false,
  required = false,
  className = '',
  allowEmpty = true,
  emptyLabel = '请选择',
  searchThreshold = 8,
  metricsContext,
}: SearchableSelectProps) {
  const reactId = useId();
  const listboxId = idProp ?? `ui-select-${reactId}`;
  const isMobile = useMediaQueryMaxWidth(767);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 280, maxH: 320 });

  const labelByValue = useMemo(() => {
    const m = new Map<string, string>();
    options.forEach(o => m.set(o.value, o.label));
    return m;
  }, [options]);

  const hasEmptyInOptions = useMemo(() => options.some(o => o.value === ''), [options]);
  const showSyntheticEmpty = allowEmpty && !hasEmptyInOptions;

  const displayLabel =
    value === '' && (allowEmpty || hasEmptyInOptions)
      ? labelByValue.get('') ?? placeholder
      : labelByValue.get(value) ?? placeholder;

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return options;
    return options.filter(o => normalize(o.label).includes(q) || normalize(o.value).includes(q));
  }, [options, query]);

  const showSearch = options.length >= searchThreshold;

  const updateDropdownRect = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const maxH = Math.min(360, window.innerHeight - r.bottom - 12);
    setDropdownPos({
      top: r.bottom + window.scrollY + 4,
      left: r.left + window.scrollX,
      width: Math.max(r.width, 200),
      maxH: Math.max(120, maxH),
    });
  }, []);

  useLayoutEffect(() => {
    if (open && !isMobile) {
      updateDropdownRect();
      const onScroll = () => updateDropdownRect();
      window.addEventListener('scroll', onScroll, true);
      window.addEventListener('resize', onScroll);
      return () => {
        window.removeEventListener('scroll', onScroll, true);
        window.removeEventListener('resize', onScroll);
      };
    }
  }, [open, isMobile, updateDropdownRect]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  useEffect(() => () => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (listRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const pick = (v: string) => {
    if (metricsContext) {
      recordUiMetric('select_value_commit', { context: metricsContext, value: v, prev: value });
    }
    onChange(v);
    setOpen(false);
  };

  const triggerClass =
    'ui-input flex w-full min-h-[44px] items-center justify-between gap-2 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-left text-sm text-gray-800 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-50';

  const listContent = (
    <>
      {showSearch && (
        <div className="border-b border-gray-200 p-2">
          <div className="relative">
            <FaSearch className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              autoFocus={!isMobile}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-md border border-gray-200 py-2 pl-9 pr-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      )}
      <div
        ref={listRef}
        id={listboxId}
        role="listbox"
        className="overflow-y-auto overscroll-contain p-1"
        style={{ maxHeight: isMobile ? '50vh' : dropdownPos.maxH - (showSearch ? 52 : 0) }}
      >
        {showSyntheticEmpty && (
          <button
            type="button"
            role="option"
            aria-selected={value === ''}
            onClick={() => pick('')}
            className={`flex w-full rounded-md px-3 py-2.5 text-left text-sm ${
              value === '' ? 'bg-blue-50 font-medium text-blue-800' : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            {emptyLabel}
          </button>
        )}
        {filtered.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-gray-500">无匹配项</div>
        ) : (
          filtered.map((opt, idx) => (
            <button
              key={`${opt.value || '__empty__'}-${idx}`}
              type="button"
              role="option"
              aria-selected={opt.value === value}
              disabled={opt.disabled}
              onClick={() => !opt.disabled && pick(opt.value)}
              className={`flex w-full rounded-md px-3 py-2.5 text-left text-sm ${
                opt.value === value ? 'bg-blue-50 font-medium text-blue-800' : 'text-gray-700 hover:bg-gray-50'
              } ${opt.disabled ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              {opt.label}
            </button>
          ))
        )}
      </div>
    </>
  );

  return (
    <div className={`relative ${className}`}>
      {name ? <input type="hidden" name={name} value={value} readOnly /> : null}
      <button
        ref={triggerRef}
        type="button"
        id={listboxId + '-trigger'}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        disabled={disabled}
        aria-required={required || undefined}
        onClick={() => {
          if (disabled) return;
          setOpen(o => {
            const next = !o;
            if (next && metricsContext) {
              recordUiMetric('select_panel_open', { context: metricsContext });
            }
            return next;
          });
        }}
        className={triggerClass}
      >
        <span
          className={`min-w-0 flex-1 truncate ${
            value === '' && (allowEmpty || hasEmptyInOptions) ? 'text-gray-500' : ''
          }`}
        >
          {displayLabel}
        </span>
        <FaChevronDown className={`h-3.5 w-3.5 shrink-0 text-gray-500 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && isMobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/40"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="max-h-[85vh] overflow-hidden rounded-t-2xl bg-white shadow-xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                <span className="text-base font-semibold text-gray-800">{placeholder}</span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
                  aria-label="关闭"
                >
                  <FaTimes className="h-4 w-4" />
                </button>
              </div>
              {listContent}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {open &&
        !isMobile &&
        createPortal(
          <div
            className="fixed z-[100] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl"
            style={{
              top: dropdownPos.top,
              left: dropdownPos.left,
              width: dropdownPos.width,
              maxHeight: dropdownPos.maxH,
            }}
          >
            {listContent}
          </div>,
          document.body,
        )}
    </div>
  );
}
