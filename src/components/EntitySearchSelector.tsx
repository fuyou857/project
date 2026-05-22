import { useEffect, useRef, useState } from 'react';
import { FaPlus } from 'react-icons/fa';
import { useClickOutside } from '../hooks/useClickOutside';

export interface EntitySearchItem {
  id: string;
}

export interface EntitySearchSelectorProps<T extends EntitySearchItem> {
  value: string;
  onChange: (id: string) => void;
  items: T[];
  getLabel: (item: T) => string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  emptyListMessage: string;
  noMatchMessage: string;
  quickAddButtonLabel: string;
  onQuickAdd: () => void;
  maxVisibleWithoutSearch?: number;
}

/**
 * 实体搜索下拉 + 快速新增入口（PartyA / PartyB / 签章单位选择器共用）
 */
export default function EntitySearchSelector<T extends EntitySearchItem>({
  value,
  onChange,
  items,
  getLabel,
  label,
  placeholder = '搜索...',
  required = false,
  emptyListMessage,
  noMatchMessage,
  quickAddButtonLabel,
  onQuickAdd,
  maxVisibleWithoutSearch = 10,
}: EntitySearchSelectorProps<T>) {
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredList, setFilteredList] = useState<T[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = search.trim().toLowerCase();
    if (q) {
      setFilteredList(items.filter((item) => getLabel(item).toLowerCase().includes(q)));
    } else {
      setFilteredList(items.slice(0, maxVisibleWithoutSearch));
    }
  }, [search, items, getLabel, maxVisibleWithoutSearch]);

  useEffect(() => {
    const selected = items.find((item) => item.id === value);
    if (selected) {
      setSearch(getLabel(selected));
    }
  }, [value, items, getLabel]);

  useClickOutside(dropdownRef, () => setShowDropdown(false));

  return (
    <div>
      {label ? (
        <label className="block text-sm text-gray-600 mb-2">
          {label}
          {required ? <span className="text-red-500 ml-1">*</span> : null}
        </label>
      ) : null}
      <div className="relative" ref={dropdownRef}>
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={placeholder}
        />
        {showDropdown ? (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg max-h-48 overflow-y-auto shadow-lg">
            {filteredList.length === 0 ? (
              <div className="p-3 text-gray-500 text-sm">
                {items.length === 0 ? emptyListMessage : noMatchMessage}
              </div>
            ) : (
              filteredList.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onChange(item.id);
                    setSearch(getLabel(item));
                    setShowDropdown(false);
                  }}
                  className={
                    'w-full text-left px-4 py-2 text-sm ' +
                    (value === item.id
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50')
                  }
                >
                  {getLabel(item)}
                </button>
              ))
            )}
            <button
              type="button"
              onClick={() => {
                setShowDropdown(false);
                onQuickAdd();
              }}
              className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-gray-50 border-t border-gray-200 flex items-center gap-2"
            >
              <FaPlus className="w-3 h-3" /> {quickAddButtonLabel}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
