import { type RefObject } from 'react';
import { FaPlus, FaFileExcel, FaUpload } from 'react-icons/fa';

interface ContractListToolbarProps {
  title: string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExport: () => void;
  onAdd: () => void;
  addLabel?: string;
}

/** 合同列表页：标题 + 导入/导出/新增 */
export default function ContractListToolbar({
  title,
  fileInputRef,
  onImport,
  onExport,
  onAdd,
  addLabel = '新增合同',
}: ContractListToolbarProps) {
  return (
    <div className="flex justify-between items-center">
      <h3 className="text-xl font-bold text-gray-800">{title}</h3>
      <div className="flex gap-2">
        <input
          type="file"
          ref={fileInputRef}
          accept=".xlsx,.xls"
          onChange={onImport}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-gray-800 rounded-lg"
        >
          <FaUpload /> 导入Excel
        </button>
        <button
          type="button"
          onClick={onExport}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-gray-800 rounded-lg"
        >
          <FaFileExcel /> 导出Excel
        </button>
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-gray-800 rounded-lg"
        >
          <FaPlus /> {addLabel}
        </button>
      </div>
    </div>
  );
}
