import { type RefObject } from 'react';
import { FaPlus, FaFileExcel, FaUpload, FaSpinner } from 'react-icons/fa';

interface ToolbarAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'success';
  tooltip?: string;
}

function ToolbarButton({ label, icon, onClick, disabled, loading, variant = 'primary', tooltip }: ToolbarAction) {
  const baseClass = variant === 'success'
    ? 'bg-green-600 hover:bg-green-700 text-white'
    : 'bg-blue-600 hover:bg-blue-700 text-white';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      title={tooltip}
      aria-label={tooltip || label}
      aria-pressed={loading}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${baseClass} disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {loading ? <FaSpinner className="w-3.5 h-3.5 animate-spin" /> : icon}
      {label}
    </button>
  );
}

interface ContractListToolbarProps {
  title: string;
  fileInputRef: RefObject<HTMLInputElement>;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExport: () => void;
  onAdd: () => void;
  addLabel?: string;
  exportLoading?: boolean;
  importLoading?: boolean;
}

export default function ContractListToolbar({
  title,
  fileInputRef,
  onImport,
  onExport,
  onAdd,
  addLabel = '新增合同',
  exportLoading = false,
  importLoading = false,
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
          className="ui-file-input-safe" data-file-upload-field="true"
          aria-label="选择 Excel 文件导入"
        />
        <ToolbarButton
          label="导入Excel"
          icon={<FaUpload className="w-3.5 h-3.5" />}
          onClick={() => fileInputRef.current?.click()}
          disabled={importLoading}
          loading={importLoading}
          variant="success"
          tooltip="从 Excel 文件批量导入合同数据"
        />
        <ToolbarButton
          label="导出Excel"
          icon={<FaFileExcel className="w-3.5 h-3.5" />}
          onClick={onExport}
          disabled={exportLoading}
          loading={exportLoading}
          variant="success"
          tooltip="将当前列表数据导出为 Excel"
        />
        <ToolbarButton
          label={addLabel}
          icon={<FaPlus className="w-3.5 h-3.5" />}
          onClick={onAdd}
          variant="primary"
          tooltip={`新建${addLabel}`}
        />
      </div>
    </div>
  );
}