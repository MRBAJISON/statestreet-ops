'use client';

import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

const COLORS = ['#c8a951', '#22c55e', '#3b82f6', '#ef4444', '#eab308', '#8b5cf6', '#f97316', '#06b6d4'];

const tooltipStyle = {
  contentStyle: { backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', fontSize: '0.75rem' },
  itemStyle: { color: '#fff' },
  labelStyle: { color: '#9ca3af' },
};

interface SimpleLineChartProps {
  data: { name: string; value: number; value2?: number }[];
  height?: number;
  color?: string;
  color2?: string;
  dataKey?: string;
  dataKey2?: string;
  showGrid?: boolean;
  showAxis?: boolean;
  area?: boolean;
  prefix?: string;
}

export function SimpleLineChart({ data, height = 200, color = '#c8a951', color2, dataKey = 'value', dataKey2 = 'value2', showGrid = true, showAxis = true, area = false, prefix = '' }: SimpleLineChartProps) {
  const Chart = area ? AreaChart : LineChart;
  const Element = area ? Area : Line;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <Chart data={data}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />}
        {showAxis && <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />}
        {showAxis && <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => prefix + (v >= 1000000 ? (v / 1000000).toFixed(1) + 'M' : v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v)} />}
        <Tooltip {...tooltipStyle} formatter={(v: number) => prefix + v.toLocaleString()} />
        {area ? (
          <>
            <defs>
              <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey={dataKey} stroke={color} fill="url(#grad1)" strokeWidth={2} />
          </>
        ) : (
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} />
        )}
        {color2 && <Line type="monotone" dataKey={dataKey2} stroke={color2} strokeWidth={2} dot={false} strokeDasharray="5 5" />}
      </Chart>
    </ResponsiveContainer>
  );
}

interface SimpleBarChartProps {
  data: { name: string; value: number; value2?: number }[];
  height?: number;
  color?: string;
  color2?: string;
  horizontal?: boolean;
  prefix?: string;
  stacked?: boolean;
}

export function SimpleBarChart({ data, height = 200, color = '#c8a951', color2, horizontal = false, prefix = '', stacked = false }: SimpleBarChartProps) {
  const layout = horizontal ? 'vertical' as const : 'horizontal' as const;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={layout}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
        {horizontal ? (
          <>
            <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => prefix + (v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v)} />
            <YAxis dataKey="name" type="category" tick={{ fill: '#6b7280', fontSize: 9 }} axisLine={false} tickLine={false} width={100} />
          </>
        ) : (
          <>
            <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => prefix + (v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v)} />
          </>
        )}
        <Tooltip {...tooltipStyle} formatter={(v: number) => prefix + v.toLocaleString()} />
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} stackId={stacked ? 'a' : undefined} />
        {color2 && <Bar dataKey="value2" fill={color2} radius={[4, 4, 0, 0]} stackId={stacked ? 'a' : undefined} />}
      </BarChart>
    </ResponsiveContainer>
  );
}

interface SimpleDonutChartProps {
  data: { name: string; value: number }[];
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
  centerLabel?: string;
  centerValue?: string;
  colors?: string[];
}

export function SimpleDonutChart({ data, height = 200, innerRadius = 50, outerRadius = 70, centerLabel, centerValue, colors = COLORS }: SimpleDonutChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={innerRadius} outerRadius={outerRadius} dataKey="value" paddingAngle={2}>
          {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
        </Pie>
        <Tooltip {...tooltipStyle} />
        {centerLabel && (
          <text x="50%" y="45%" textAnchor="middle" fill="#fff" fontSize="1.2rem" fontWeight="bold">{centerValue}</text>
        )}
        {centerLabel && (
          <text x="50%" y="58%" textAnchor="middle" fill="#6b7280" fontSize="0.6rem">{centerLabel}</text>
        )}
      </PieChart>
    </ResponsiveContainer>
  );
}

export function MiniSparkline({ data, color = '#c8a951', height = 40 }: { data: number[]; color?: string; height?: number }) {
  const chartData = data.map((v, i) => ({ name: String(i), value: v }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="value" stroke={color} fill={`url(#spark-${color.replace('#', '')})`} strokeWidth={1.5} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
