'use client';

import { useMetrics } from '@/lib/api';

const fmtGHS = (n: number) =>
  n >= 1_000_000 ? (n / 1_000_000).toFixed(2) + 'M' : n >= 1_000 ? (n / 1_000).toFixed(0) + 'K' : n.toLocaleString();

// Live group revenue (finance revenue MTD) for the Executive dashboard tile.
export default function ExecutiveGroupRevenue() {
  const { data } = useMetrics<{ revenueMtd: number }>('finance');
  return <>{fmtGHS(data?.revenueMtd ?? 0)}</>;
}
