import { List } from 'react-window';
import { Loading } from './Loading';

interface ColumnType {
  title: string;
  dataIndex: string;
  key?: string;
  width?: number;
  render?: (value: unknown, record: unknown, index: number) => React.ReactNode;
}

interface VirtualTableProps {
  columns: ColumnType[];
  dataSource: Record<string, unknown>[];
  loading?: boolean;
  rowHeight?: number;
  height?: number;
  onRowClick?: (record: Record<string, unknown>) => void;
}

const VirtualTable = ({
  columns,
  dataSource,
  loading = false,
  rowHeight = 48,
  height = 500,
  onRowClick,
}: VirtualTableProps) => {
  if (loading) {
    return <Loading size="md" />;
  }

  if (dataSource.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <div>暂无数据</div>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid #f0f0f0',
          backgroundColor: '#fafafa',
          fontWeight: 600,
          height: 40,
        }}
      >
        {columns.map((col, index) => (
          <div
            key={col.dataIndex || index}
            style={{
              flex: col.width ? `0 0 ${col.width}px` : 1,
              padding: '8px 12px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {col.title}
          </div>
        ))}
      </div>
      <div style={{ height }}>
        <List
          rowCount={dataSource.length}
          rowHeight={rowHeight}
          rowComponent={({ index, style, dataSource, columns: cols, onRowClick: click }) => {
          const record = dataSource[index];
          if (!record) return null;

          return (
            <div
              style={{
                ...style,
                display: 'flex',
                alignItems: 'center',
                borderBottom: '1px solid #f0f0f0',
                cursor: click ? 'pointer' : 'default',
              }}
              onClick={() => click?.(record)}
            >
              {cols.map((col, colIndex) => (
                <div
                  key={col.dataIndex || colIndex}
                  style={{
                    flex: col.width ? `0 0 ${col.width}px` : 1,
                    padding: '8px 12px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={String(record[col.dataIndex] ?? '')}
                >
                  {col.render
                    ? col.render(record[col.dataIndex], record, index)
                    : String(record[col.dataIndex] ?? '')}
                </div>
              ))}
            </div>
          );
        }}
        rowProps={{ dataSource, columns, onRowClick }}
      />
    </div>
    </div>
  );
};

export default VirtualTable;