import { FaSearch, FaEye, FaEdit, FaTrash } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { Project, getStatusLabel, getStatusColor } from './types';
import { PAGE_SIZE } from '../../constants';
import { useUiPreferences } from '../../contexts/UiPreferencesContext';

interface ProjectListProps {
  data: Project[];
  total: number;
  page: number;
  search: string;
  onSearchChange: (search: string) => void;
  onPageChange: (page: number) => void;
  onEdit: (item: Project) => void;
  onDelete: (id: string) => void;
  isSuperAdmin: boolean;
}

export default function ProjectList({
  data,
  total,
  page,
  search,
  onSearchChange,
  onPageChange,
  onEdit,
  onDelete,
  isSuperAdmin,
}: ProjectListProps) {
  const navigate = useNavigate();
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const { tableHeadCellClass, tableCellClass } = useUiPreferences();

  return (
    <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
      <div className="relative mb-4">
        <FaSearch className="absolute left-3 top-3 text-gray-400" />
        <input
          type="text"
          placeholder="按项目名称/项目编号/项目负责人搜索"
          value={search}
          onChange={(e) => {
            onSearchChange(e.target.value);
            onPageChange(1);
          }}
          className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      <div className="mobile-table-wrapper overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead className="bg-gray-50">
            <tr className="text-gray-600">
              <th className={`sticky left-0 z-20 bg-gray-50 text-left font-medium shadow-[1px_0_0_0_rgb(229,231,235)] ${tableHeadCellClass}`}>
                项目编号
              </th>
              <th className={`text-left font-medium ${tableHeadCellClass}`}>项目名称</th>
              <th className={`text-right font-medium ${tableHeadCellClass}`}>项目金额</th>
              <th className={`text-center font-medium ${tableHeadCellClass}`}>工期(天)</th>
              <th className={`text-left font-medium ${tableHeadCellClass}`}>时间</th>
              <th className={`text-left font-medium ${tableHeadCellClass}`}>负责人</th>
              <th className={`text-center font-medium ${tableHeadCellClass}`}>状态</th>
              <th
                className={`sticky right-0 z-20 bg-gray-50 text-center font-medium shadow-[-1px_0_0_0_rgb(229,231,235)] ${tableHeadCellClass}`}
              >
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center text-gray-400 py-8">暂无项目</td>
              </tr>
            ) : (
              data.map((item) => (
                <tr key={item.id} className="group border-b border-gray-100 hover:bg-gray-50">
                  <td
                    className={`sticky left-0 z-10 bg-white text-gray-700 shadow-[1px_0_0_0_rgb(229,231,235)] group-hover:bg-gray-50 ${tableCellClass}`}
                  >
                    {(item.project_code || '-')}
                  </td>
                  <td className={`${tableCellClass}`}>
                    <button
                      onClick={() => navigate('/projects/' + item.id)}
                      className="text-left font-medium text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      {item.name}
                    </button>
                  </td>
                  <td className={`ui-numeric text-gray-700 ${tableCellClass}`}>
                    {item.bid_amount ? item.bid_amount.toLocaleString() : '-'}
                  </td>
                  <td className={`text-center text-gray-700 ${tableCellClass}`}>{item.duration || '-'}</td>
                  <td className={`text-gray-600 ${tableCellClass}`}>
                    {(item.start_date ? item.start_date.slice(0, 10) : '-') + ' ~ ' + (item.end_date ? item.end_date.slice(0, 10) : '-')}
                  </td>
                  <td className={`text-gray-700 ${tableCellClass}`}>{item.project_manager || '-'}</td>
                  <td className={`text-center ${tableCellClass}`}>
                    <span className={'inline-block rounded px-2 py-1 text-xs ' + getStatusColor(item.status ?? 'not_started')}>
                      {getStatusLabel(item.status ?? 'not_started')}
                    </span>
                  </td>
                  <td
                    className={`sticky right-0 z-10 bg-white shadow-[-1px_0_0_0_rgb(229,231,235)] group-hover:bg-gray-50 ${tableCellClass}`}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => item.id && navigate('/projects/' + item.id)}
                        className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"
                      >
                        <FaEye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => item.id && onEdit(item)}
                        className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg"
                      >
                        <FaEdit className="w-4 h-4" />
                      </button>
                      {isSuperAdmin && (
                        <button
                          onClick={() => item.id && onDelete(item.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                        >
                          <FaTrash className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {total > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-100">
          <div className="text-gray-500 text-sm">共 {total} 条</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              className="px-3 py-1 bg-gray-100 rounded text-gray-700 disabled:opacity-50 hover:bg-gray-200"
            >
              上一页
            </button>
            <span className="text-gray-500 text-sm">{page} / {totalPages || 1}</span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="px-3 py-1 bg-gray-100 rounded text-gray-700 disabled:opacity-50 hover:bg-gray-200"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
