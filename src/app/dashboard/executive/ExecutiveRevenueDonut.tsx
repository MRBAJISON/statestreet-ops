'use client';

import { SimpleDonutChart } from '@/components/charts/Charts';
import { useMetrics } from '@/lib/api';

const fmt = (n: number) =>
  n >= 1_000_000
    ? `GHS ${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
    ? `GHS ${(n / 1_000).toFixed(0)}K`
    : `GHS ${Math.round(n).toLocaleString()}`;

interface FinanceMetricsData {
  revenueMtd: number;
  revenueByBrand: { name: string; value: number }[];
}

// Revenue-by-brand donut for the Executive dashboard, driven live by the
// Finance revenue entries in the database.
export default function ExecutiveRevenueDonut({ height = 160 }: { height?: number }) {
  const { data } = useMetrics<FinanceMetricsData>('finance');
  return (
    <SimpleDonutChart
      data={data?.revenueByBrand ?? []}
      height={height}
      centerLabel="Total"
      centerValue={fmt(data?.revenueMtd ?? 0)}
    />
  );
}
