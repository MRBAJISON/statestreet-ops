'use client';

import { ChartNoAxesCombined } from 'lucide-react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import type { CategoryPerformanceRow, NamedValue, StorePerformanceRow, TradingTrendPoint } from '@/lib/contracts/analytics';
import { formatCurrency, formatNumber, formatShortDate } from './format';

const revenueConfig = {
  revenue: { label: 'Net revenue', color: 'var(--chart-1)' },
  target: { label: 'Target', color: 'var(--chart-2)' },
  grossProfit: { label: 'Gross profit', color: 'var(--chart-4)' },
} satisfies ChartConfig;

function ChartEmptyState({ className }: { className: string }) {
  return (
    <div className={`flex w-full flex-col items-center justify-center gap-2 text-center text-muted-foreground ${className}`} role="status">
      <span className="flex size-9 items-center justify-center rounded-md bg-muted">
        <ChartNoAxesCombined className="size-4" />
      </span>
      <span className="text-xs font-medium">No recorded data for this period</span>
    </div>
  );
}

export function RevenueTrendChart({ data, currency }: { data: TradingTrendPoint[]; currency: string }) {
  if (!data.length) {
    return <ChartEmptyState className="h-[310px]" />;
  }
  return (
    <ChartContainer config={revenueConfig} className="h-[310px] w-full aspect-auto" initialDimension={{ width: 760, height: 310 }}>
      <ComposedChart data={data} margin={{ top: 14, right: 8, left: 0, bottom: 0 }} accessibilityLayer>
        <CartesianGrid vertical={false} strokeDasharray="3 5" />
        <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={28} tickFormatter={formatShortDate} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={58}
          tickFormatter={(value) => formatNumber(Number(value), true)}
        />
        <ChartTooltip
          cursor={{ stroke: 'var(--border)' }}
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => formatShortDate(String(payload[0]?.payload?.date ?? ''))}
              formatter={(value, name) => (
                <div className="flex min-w-44 items-center justify-between gap-5">
                  <span className="text-muted-foreground">{revenueConfig[String(name) as keyof typeof revenueConfig]?.label}</span>
                  <span className="font-mono font-medium">{formatCurrency(Number(value), currency, false)}</span>
                </div>
              )}
            />
          }
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="var(--color-revenue)"
          fill="var(--color-revenue)"
          fillOpacity={0.13}
          strokeWidth={2.4}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, fill: 'var(--card)' }}
          isAnimationActive
          animationDuration={550}
        />
        <Area
          type="monotone"
          dataKey="grossProfit"
          stroke="var(--color-grossProfit)"
          fill="transparent"
          strokeWidth={1.7}
          dot={false}
          isAnimationActive
          animationDuration={500}
        />
        <Area
          type="stepAfter"
          dataKey="target"
          stroke="var(--color-target)"
          fill="transparent"
          strokeWidth={1.6}
          strokeDasharray="5 5"
          dot={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ChartContainer>
  );
}

const storeConfig = { revenue: { label: 'Revenue', color: 'var(--chart-1)' } } satisfies ChartConfig;

export function StoreRankingChart({ data, currency }: { data: StorePerformanceRow[]; currency: string }) {
  if (!data.length) {
    return <ChartEmptyState className="h-[320px]" />;
  }
  return (
    <ChartContainer config={storeConfig} className="h-[320px] w-full aspect-auto" initialDimension={{ width: 700, height: 320 }}>
      <BarChart data={data.slice(0, 8)} layout="vertical" margin={{ top: 6, right: 14, left: 18, bottom: 0 }} accessibilityLayer>
        <CartesianGrid horizontal={false} strokeDasharray="3 5" />
        <XAxis type="number" hide />
        <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={112} tick={{ fontSize: 11 }} />
        <ChartTooltip
          cursor={{ fill: 'var(--muted)', opacity: 0.65 }}
          content={<ChartTooltipContent hideLabel formatter={(value) => <span className="font-mono font-medium">{formatCurrency(Number(value), currency, false)}</span>} />}
        />
        <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[0, 5, 5, 0]} barSize={18} isAnimationActive animationDuration={450} />
      </BarChart>
    </ChartContainer>
  );
}

const categoryColors = ['var(--chart-1)', 'var(--chart-4)', 'var(--chart-2)', 'var(--chart-5)', 'var(--chart-3)'];
const categoryConfig = { value: { label: 'Revenue' } } satisfies ChartConfig;

export function CategoryContributionChart({ data }: { data: CategoryPerformanceRow[] }) {
  const chartData = data.slice(0, 5).map((item) => ({ name: item.name, value: item.revenue }));
  if (!chartData.length) {
    return <ChartEmptyState className="h-[220px]" />;
  }
  return (
    <ChartContainer config={categoryConfig} className="mx-auto h-[220px] w-full max-w-[320px] aspect-auto" initialDimension={{ width: 300, height: 220 }}>
      <PieChart accessibilityLayer>
        <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
        <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={2} strokeWidth={0} isAnimationActive animationDuration={500}>
          {chartData.map((item, index) => <Cell key={item.name} fill={categoryColors[index % categoryColors.length]} />)}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}

const namedConfig = { value: { label: 'Value', color: 'var(--chart-4)' } } satisfies ChartConfig;

export function NamedBarChart({ data, valueFormatter = formatNumber }: { data: NamedValue[]; valueFormatter?: (value: number) => string }) {
  if (!data.length) {
    return <ChartEmptyState className="h-[260px]" />;
  }
  return (
    <ChartContainer config={namedConfig} className="h-[260px] w-full aspect-auto" initialDimension={{ width: 520, height: 260 }}>
      <BarChart data={data.slice(0, 8)} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} accessibilityLayer>
        <CartesianGrid vertical={false} strokeDasharray="3 5" />
        <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 10 }} />
        <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(value) => formatNumber(Number(value), true)} />
        <ChartTooltip content={<ChartTooltipContent hideLabel formatter={(value) => <span className="font-mono font-medium">{valueFormatter(Number(value))}</span>} />} />
        <Bar dataKey="value" fill="var(--color-value)" radius={[5, 5, 0, 0]} maxBarSize={34} isAnimationActive animationDuration={450} />
      </BarChart>
    </ChartContainer>
  );
}

export function HorizontalBarChart({ data, valueFormatter = formatNumber }: { data: NamedValue[]; valueFormatter?: (value: number) => string }) {
  if (!data.length) {
    return <ChartEmptyState className="h-[270px]" />;
  }
  return (
    <ChartContainer config={namedConfig} className="h-[270px] w-full aspect-auto" initialDimension={{ width: 520, height: 270 }}>
      <BarChart data={data.slice(0, 9)} layout="vertical" margin={{ top: 8, right: 12, left: 22, bottom: 0 }} accessibilityLayer>
        <CartesianGrid horizontal={false} strokeDasharray="3 5" />
        <XAxis type="number" hide />
        <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={112} tick={{ fontSize: 10 }} />
        <ChartTooltip content={<ChartTooltipContent hideLabel formatter={(value) => <span className="font-mono font-medium">{valueFormatter(Number(value))}</span>} />} />
        <Bar dataKey="value" fill="var(--color-value)" radius={[0, 5, 5, 0]} barSize={17} isAnimationActive animationDuration={450} />
      </BarChart>
    </ChartContainer>
  );
}

const donutConfig = { value: { label: 'Value' } } satisfies ChartConfig;

export function DonutChart({
  data,
  valueFormatter = formatNumber,
}: {
  data: NamedValue[];
  valueFormatter?: (value: number) => string;
}) {
  const chartData = data.slice(0, 8);
  if (!chartData.length) {
    return <ChartEmptyState className="h-[230px]" />;
  }
  return (
    <ChartContainer config={donutConfig} className="mx-auto h-[230px] w-full max-w-[340px] aspect-auto" initialDimension={{ width: 320, height: 230 }}>
      <PieChart accessibilityLayer>
        <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel formatter={(value) => <span className="font-mono font-medium">{valueFormatter(Number(value))}</span>} />} />
        <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={90} paddingAngle={2} strokeWidth={0}>
          {chartData.map((item, index) => <Cell key={item.name} fill={categoryColors[index % categoryColors.length]} />)}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}

export interface ComparisonDatum {
  name: string;
  primary: number;
  secondary: number;
}

const comparisonConfig = {
  primary: { label: 'Actual', color: 'var(--chart-1)' },
  secondary: { label: 'Target', color: 'var(--chart-2)' },
} satisfies ChartConfig;

export function ComparisonBarChart({
  data,
  primaryLabel = 'Actual',
  secondaryLabel = 'Target',
  valueFormatter = formatNumber,
}: {
  data: ComparisonDatum[];
  primaryLabel?: string;
  secondaryLabel?: string;
  valueFormatter?: (value: number) => string;
}) {
  const config = {
    primary: { ...comparisonConfig.primary, label: primaryLabel },
    secondary: { ...comparisonConfig.secondary, label: secondaryLabel },
  } satisfies ChartConfig;
  if (!data.length) {
    return <ChartEmptyState className="h-[290px]" />;
  }
  return (
    <ChartContainer config={config} className="h-[290px] w-full aspect-auto" initialDimension={{ width: 650, height: 290 }}>
      <BarChart data={data.slice(0, 10)} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} accessibilityLayer>
        <CartesianGrid vertical={false} strokeDasharray="3 5" />
        <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 10 }} />
        <YAxis tickLine={false} axisLine={false} width={50} tickFormatter={(value) => formatNumber(Number(value), true)} />
        <ChartTooltip content={<ChartTooltipContent formatter={(value, name) => (
          <div className="flex min-w-40 items-center justify-between gap-4">
            <span className="text-muted-foreground">{config[String(name) as keyof typeof config]?.label}</span>
            <span className="font-mono font-medium">{valueFormatter(Number(value))}</span>
          </div>
        )} />} />
        <Bar dataKey="primary" fill="var(--color-primary)" radius={[4, 4, 0, 0]} maxBarSize={24} />
        <Bar dataKey="secondary" fill="var(--color-secondary)" radius={[4, 4, 0, 0]} maxBarSize={24} />
      </BarChart>
    </ChartContainer>
  );
}

const trendConfig = { value: { label: 'Value', color: 'var(--chart-1)' } } satisfies ChartConfig;

export function ValueTrendChart({ data, valueFormatter = formatNumber }: { data: Array<{ date: string; value: number }>; valueFormatter?: (value: number) => string }) {
  if (!data.length) {
    return <ChartEmptyState className="h-[270px]" />;
  }
  return (
    <ChartContainer config={trendConfig} className="h-[270px] w-full aspect-auto" initialDimension={{ width: 640, height: 270 }}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} accessibilityLayer>
        <CartesianGrid vertical={false} strokeDasharray="3 5" />
        <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={28} tickFormatter={formatShortDate} />
        <YAxis tickLine={false} axisLine={false} width={50} tickFormatter={(value) => formatNumber(Number(value), true)} />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, payload) => formatShortDate(String(payload[0]?.payload?.date ?? ''))} formatter={(value) => <span className="font-mono font-medium">{valueFormatter(Number(value))}</span>} />} />
        <Line type="monotone" dataKey="value" stroke="var(--color-value)" strokeWidth={2.4} dot={false} activeDot={{ r: 4 }} />
      </LineChart>
    </ChartContainer>
  );
}

const sentimentConfig = {
  positive: { label: 'Positive', color: 'var(--chart-4)' },
  neutral: { label: 'Neutral', color: 'var(--chart-2)' },
  negative: { label: 'Negative', color: 'var(--chart-3)' },
} satisfies ChartConfig;

export function SentimentTrendChart({ data }: { data: Array<{ date: string; positive: number; neutral: number; negative: number }> }) {
  if (!data.length) {
    return <ChartEmptyState className="h-[270px]" />;
  }
  return (
    <ChartContainer config={sentimentConfig} className="h-[270px] w-full aspect-auto" initialDimension={{ width: 640, height: 270 }}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} accessibilityLayer>
        <CartesianGrid vertical={false} strokeDasharray="3 5" />
        <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={28} tickFormatter={formatShortDate} />
        <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(value) => formatNumber(Number(value), true)} />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, payload) => formatShortDate(String(payload[0]?.payload?.date ?? ''))} />} />
        <Legend />
        <Line type="monotone" dataKey="positive" stroke="var(--color-positive)" strokeWidth={2.2} dot={false} />
        <Line type="monotone" dataKey="neutral" stroke="var(--color-neutral)" strokeWidth={1.8} dot={false} />
        <Line type="monotone" dataKey="negative" stroke="var(--color-negative)" strokeWidth={1.8} dot={false} />
      </LineChart>
    </ChartContainer>
  );
}

const cashConfig = {
  inflow: { label: 'Inflow', color: 'var(--chart-4)' },
  outflow: { label: 'Outflow', color: 'var(--chart-3)' },
} satisfies ChartConfig;

export function CashFlowChart({
  data,
  currency,
}: {
  data: Array<{ date: string; inflow: number; outflow: number }>;
  currency: string;
}) {
  if (!data.length) {
    return <ChartEmptyState className="h-[280px]" />;
  }
  return (
    <ChartContainer config={cashConfig} className="h-[280px] w-full aspect-auto" initialDimension={{ width: 680, height: 280 }}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} accessibilityLayer>
        <CartesianGrid vertical={false} strokeDasharray="3 5" />
        <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={26} tickFormatter={formatShortDate} />
        <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={(value) => formatNumber(Number(value), true)} />
        <ChartTooltip
          content={<ChartTooltipContent labelFormatter={(_, payload) => formatShortDate(String(payload[0]?.payload?.date ?? ''))} formatter={(value, name) => (
            <div className="flex min-w-40 items-center justify-between gap-4">
              <span className="capitalize text-muted-foreground">{String(name)}</span>
              <span className="font-mono font-medium">{formatCurrency(Number(value), currency, false)}</span>
            </div>
          )} />}
        />
        <Bar dataKey="inflow" fill="var(--color-inflow)" radius={[4, 4, 0, 0]} maxBarSize={20} />
        <Bar dataKey="outflow" fill="var(--color-outflow)" radius={[4, 4, 0, 0]} maxBarSize={20} />
      </BarChart>
    </ChartContainer>
  );
}
