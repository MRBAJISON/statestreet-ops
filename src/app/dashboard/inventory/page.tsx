'use client';

import DashboardHeader from '@/components/layout/DashboardHeader';
import KPICard from '@/components/ui/KPICard';
import Section from '@/components/ui/Section';
import EmptyState from '@/components/ui/EmptyState';
import RecentEntries from '@/components/ui/RecentEntries';
import { SimpleLineChart, SimpleDonutChart } from '@/components/charts/Charts';
import { useMetrics } from '@/lib/api';

const fmtGHS = (n: number) =>
  n >= 1_000_000
    ? `GHS ${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
    ? `GHS ${(n / 1_000).toFixed(0)}K`
    : `GHS ${Math.round(n).toLocaleString()}`;
const dash = (n: number, f: (x: number) => string) => (n ? f(n) : '—');
const pct = (n: number) => (n ? `${n}%` : '—');

interface InventoryLive {
  inventoryValue: number;
  accuracy: number;
  deadPct: number;
  outOfStock: number;
  byBrand: { name: string; value: number }[];
  accuracyDistribution: { name: string; value: number }[];
  valueTrend: { name: string; value: number }[];
}

export default function InventoryPage() {
  const { data: m } = useMetrics<InventoryLive>('inventory');
  const byBrand = m?.byBrand ?? [];
  const valueTrend = m?.valueTrend ?? [];
  const accuracyDistribution = (m?.accuracyDistribution ?? []).filter((a) => a.value > 0);

  return (
    <div className="bg-[#0a0a0a] min-h-screen text-white">
      <DashboardHeader
        title="INVENTORY COMMAND CENTER"
        subtitle="RIGHT STOCK. RIGHT PLACE. RIGHT TIME. MAXIMUM RETURNS."
        mission="Inventory Mission"
        missionDetail="Optimize inventory value, eliminate dead stock, maximize availability."
      />

      <div className="px-6 py-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPICard label="Inventory Value" value={dash(m?.inventoryValue ?? 0, fmtGHS)} status="green" small />
          <KPICard label="Stock Accuracy" value={pct(m?.accuracy ?? 0)} status={(m?.accuracy ?? 0) >= 98 ? 'green' : 'yellow'} small />
          <KPICard label="Dead Stock %" value={pct(m?.deadPct ?? 0)} status={(m?.deadPct ?? 0) < 8 ? 'green' : 'red'} small />
          <KPICard label="Replenishment Requests" value={String(m?.outOfStock ?? 0)} small />
        </div>
      </div>

      <div className="px-6 pb-8 space-y-6">
        <Section number={1} title="Inventory Value">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <div className="text-xs text-gray-400 mb-2">Goods Received by Month</div>
              {valueTrend.length ? (
                <SimpleLineChart data={valueTrend} height={220} color="#c8a951" area prefix="GHS " />
              ) : (
                <EmptyState message="No goods receipts yet" hint="Submit Goods Received in the Inventory form." height={220} />
              )}
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-2">Value by Brand</div>
              {byBrand.length ? (
                <SimpleDonutChart data={byBrand} height={200} innerRadius={45} outerRadius={65} centerLabel="Received" centerValue={fmtGHS(byBrand.reduce((s, b) => s + b.value, 0))} />
              ) : (
                <EmptyState height={200} />
              )}
            </div>
          </div>
        </Section>

        <Section number={2} title="Stock Accuracy">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-gray-400 mb-2">Accuracy Distribution</div>
              {accuracyDistribution.length ? (
                <SimpleDonutChart
                  data={accuracyDistribution}
                  height={200}
                  innerRadius={50}
                  outerRadius={70}
                  centerLabel="Accuracy"
                  centerValue={pct(m?.accuracy ?? 0)}
                  colors={['#22c55e', '#eab308', '#f97316', '#ef4444']}
                />
              ) : (
                <EmptyState message="No stock counts yet" hint="Submit Stock Count in the Inventory form." height={200} />
              )}
            </div>
            <div className="lg:col-span-2">
              {accuracyDistribution.length ? (
                <div className="grid grid-cols-2 gap-2">
                  {accuracyDistribution.map((a, i) => (
                    <div key={a.name} className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-3 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ['#22c55e', '#eab308', '#f97316', '#ef4444'][i % 4] }} />
                      <span className="text-xs text-gray-400">{a.name}</span>
                      <span className="text-sm font-bold text-white ml-auto">{a.value}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState height={200} />
              )}
            </div>
          </div>
        </Section>

        <Section number={3} title="Recent Entries">
          <RecentEntries department="inventory" />
        </Section>
      </div>
    </div>
  );
}
