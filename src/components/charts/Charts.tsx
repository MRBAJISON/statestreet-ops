'use client';

import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, ComposedChart, ReferenceLine } from 'recharts';

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

  return (
    <ResponsiveContainer width="100%" height={height}>
      <Chart data={data}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />}
        {showAxis && <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />}
        {showAxis && <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => { const n = Number(v); return prefix + (n >= 1000000 ? (n / 1000000).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(0) + 'K' : n); }} />}
        <Tooltip {...tooltipStyle} formatter={(v) => prefix + Number(v).toLocaleString()} />
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
  barSize?: number; // fixed bar thickness (px); falls back to maxBarSize when unset
}

export function SimpleBarChart({ data, height = 200, color = '#c8a951', color2, horizontal = false, prefix = '', stacked = false, barSize }: SimpleBarChartProps) {
  const layout = horizontal ? 'vertical' as const : 'horizontal' as const;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={layout}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
        {horizontal ? (
          <>
            <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => { const n = Number(v); return prefix + (n >= 1000 ? (n / 1000).toFixed(0) + 'K' : n); }} />
            <YAxis dataKey="name" type="category" tick={{ fill: '#6b7280', fontSize: 9 }} axisLine={false} tickLine={false} width={100} />
          </>
        ) : (
          <>
            {/* interval={0} forces every category label to render (recharts otherwise drops
                labels it thinks will overlap); angling keeps long names legible. */}
            <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 9 }} axisLine={false} tickLine={false} interval={0} angle={-30} textAnchor="end" height={64} tickMargin={6} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => { const n = Number(v); return prefix + (n >= 1000 ? (n / 1000).toFixed(0) + 'K' : n); }} />
          </>
        )}
        <Tooltip {...tooltipStyle} formatter={(v) => prefix + Number(v).toLocaleString()} />
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} stackId={stacked ? 'a' : undefined} barSize={barSize} maxBarSize={barSize ?? 46} />
        {color2 && <Bar dataKey="value2" fill={color2} radius={[4, 4, 0, 0]} stackId={stacked ? 'a' : undefined} barSize={barSize} maxBarSize={barSize ?? 46} />}
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

interface Candle {
  name: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

// Forex-style candlestick. Each candle: wick = low..high, body = open..close.
// Green when close >= open (bullish/improving), red when declining.
export function CandlestickChart({ data, height = 280, suffix = '%', target }: { data: Candle[]; height?: number; suffix?: string; target?: number }) {
  const UP = '#22c55e';
  const DOWN = '#ef4444';

  // The visible Bar spans [low, high] (a recharts range bar); the custom shape uses
  // that pixel rect to interpolate the open/close body, so all scaling stays native.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderCandle = (props: any) => {
    const x = Number(props.x);
    const width = Number(props.width);
    const y = Number(props.y);
    const barH = Number(props.height);
    const p = props.payload as Candle;
    if (!p || !isFinite(y) || !isFinite(barH) || barH <= 0) return <g />;
    const { open, high, low, close } = p;
    const span = high - low || 1;
    const pxFor = (v: number) => y + ((high - v) / span) * barH;
    const up = close >= open;
    const color = up ? UP : DOWN;
    const bodyTop = pxFor(Math.max(open, close));
    const bodyBot = pxFor(Math.min(open, close));
    const cx = x + width / 2;
    const bodyW = Math.max(width * 0.6, 4);
    return (
      <g>
        <line x1={cx} x2={cx} y1={y} y2={y + barH} stroke={color} strokeWidth={1.5} />
        <rect x={cx - bodyW / 2} y={bodyTop} width={bodyW} height={Math.max(bodyBot - bodyTop, 2)} fill={color} rx={1} />
      </g>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
        <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}${suffix}`} domain={['dataMin - 5', 'dataMax + 5']} />
        <Tooltip
          {...tooltipStyle}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const c = payload[0].payload as Candle;
            return (
              <div style={{ ...tooltipStyle.contentStyle, padding: '8px 10px' }}>
                <div style={{ color: '#9ca3af', marginBottom: 4 }}>Week {c.name}</div>
                <div style={{ color: '#fff' }}>Open {c.open}{suffix} · Close {c.close}{suffix}</div>
                <div style={{ color: '#6b7280' }}>High {c.high}{suffix} · Low {c.low}{suffix}</div>
              </div>
            );
          }}
        />
        {target != null && <ReferenceLine y={target} stroke="#c8a951" strokeDasharray="4 4" />}
        <Bar dataKey={(d: Candle) => [d.low, d.high]} shape={renderCandle} isAnimationActive={false} />
      </ComposedChart>
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
