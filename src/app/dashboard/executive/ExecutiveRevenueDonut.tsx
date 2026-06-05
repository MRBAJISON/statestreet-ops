'use client';

import { SimpleDonutChart } from '@/components/charts/Charts';
import { useFinanceLive } from '@/lib/store';

const fmt = (n: number) =>
  n >= 1_000_000
    ? `GHS ${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
    ? `GHS ${(n / 1_000).toFixed(0)}K`
    : `GHS ${Math.round(n).toLocaleString()}`;

// Revenue-by-brand donut for the Executive dashboard, driven live by the Finance
// Daily Revenue Entry form (via the shared client store).
export default function ExecutiveRevenueDonut({ height = 160 }: { height?: number }) {
  const live = useFinanceLive();
  return (
    <SimpleDonutChart
      data={live.revenueByBrand}
      height={height}
      centerLabel="Total"
      centerValue={fmt(live.revenueMtd)}
    />
  );
}
