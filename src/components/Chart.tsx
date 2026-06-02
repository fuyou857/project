import { useEffect, useState, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend,
} from 'recharts';

export type ChartType = 'line' | 'bar' | 'pie';

interface ChartProps {
  type?: ChartType;
  data: Record<string, unknown>[];
  xAxisKey?: string;
  yAxisKeys?: string[];
  title?: string;
  width?: string | number;
  height?: number;
  colors?: string[];
  style?: React.CSSProperties;
}

const DEFAULT_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

const Chart = ({
  type = 'line',
  data,
  xAxisKey = 'name',
  yAxisKeys = ['value'],
  height = 300,
  colors = DEFAULT_COLORS,
  style,
}: ChartProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  if (!isVisible) {
    return <div ref={ref} style={{ height, width: '100%', ...style }} />;
  }

  const renderChart = () => {
    if (type === 'pie') {
      return (
        <PieChart width={500} height={height}>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name }: { name: string }) => name}
            outerRadius={height / 2 - 20}
            fill="#8884d8"
            dataKey={yAxisKeys[0] as string}
          >
            {data.map((_entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      );
    }

    if (type === 'bar') {
      return (
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xAxisKey} />
          <YAxis />
          <Tooltip />
          <Legend />
          {yAxisKeys.map((key, index) => (
            <Bar key={key} dataKey={key} fill={colors[index % colors.length]} />
          ))}
        </BarChart>
      );
    }

    return (
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={xAxisKey} />
        <YAxis />
        <Tooltip />
        <Legend />
        {yAxisKeys.map((key, index) => (
          <Line key={key} type="monotone" dataKey={key} stroke={colors[index % colors.length]} />
        ))}
      </LineChart>
    );
  };

  return (
    <div ref={ref} style={{ width: '100%', height, ...style }}>
      <ResponsiveContainer width="100%" height="100%">
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
};

export default Chart;