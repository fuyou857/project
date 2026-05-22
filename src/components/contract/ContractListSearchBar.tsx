import { FaSearch } from 'react-icons/fa';

interface ContractListSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/** 合同列表页搜索框 */
export default function ContractListSearchBar({
  value,
  onChange,
  placeholder = '搜索合同名称...',
}: ContractListSearchBarProps) {
  return (
    <div className="relative mb-4">
      <FaSearch className="absolute left-3 top-3 text-gray-500" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
      />
    </div>
  );
}
