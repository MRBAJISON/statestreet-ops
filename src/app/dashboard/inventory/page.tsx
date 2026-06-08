'use client';

import DashboardHeader from '@/components/layout/DashboardHeader';
import KPICard from '@/components/ui/KPICard';
import Section from '@/components/ui/Section';
import EmptyState from '@/components/ui/EmptyState';
import RecentEntries from '@/components/ui/RecentEntries';
import { SimpleLineChart, SimpleDonutChart, SimpleBarChart } from '@/components/charts/Charts';
import { useState } from 'react';
import PeriodTabs from '@/components/ui/PeriodTabs';
import { useMetrics, type Period } from '@/lib/api';
import { STORES } from '@/lib/config';

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
  movement: {
    receivedUnits: number;
    receivedValue: number;
    transferredUnits: number;
    transferredValue: number;
    deadStockValue: number;
    replenishmentRequests: number;
    countedValue: number;
  };
  supplierPerformance: { name: string; value: number }[];
  replenishments: { sku: string; description: string; currentStock: number; reorderQty: number; urgency: string; store: string }[];
}

export default function InventoryPage() {
  const [period, setPeriod] = useState<Period>('mtd');
  const [anchor, setAnchor] = useState('');
  const [store, setStore] = useState('');
  const { data: m } = useMetrics<InventoryLive>('inventory', period, anchor, store);
  const byBrand = m?.byBrand ?? [];
  const valueTrend = m?.valueTrend ?? [];
  const accuracyDistribution = (m?.accuracyDistribution ?? []).filter((a) => a.value > 0);
  const mv = m?.movement ?? { receivedUnits: 0, receivedValue: 0, transferredUnits: 0, transferredValue: 0, deadStockValue: 0, replenishmentRequests: 0, countedValue: 0 };
  const hasMovement = !!(mv.receivedUnits || mv.transferredUnits || mv.deadStockValue || mv.countedValue);
  const supplierPerformance = m?.supplierPerformance ?? [];
  const replenishments = m?.replenishments ?? [];

  return (
    <div className="bg-[var(--c-bg)] min-h-screen text-[var(--c-fg)]">
      <DashboardHeader
        title="INVENTORY COMMAND CENTER"
        subtitle="RIGHT STOCK. RIGHT PLACE. RIGHT TIME. MAXIMUM RETURNS."
        mission="Inventory Mission"
        missionDetail="Optimize inventory value, eliminate dead stock, maximize availability."
      />

      <div className="px-6 pt-4 flex justify-end">
        <PeriodTabs value={period} date={anchor} onChange={setPeriod} onDateChange={setAnchor} store={store} stores={STORES} onStoreChange={setStore} />
      </div>
      <div className="px-6 py-3">
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
                    <div key={a.name} className="bg-[var(--c-card2)] border border-[var(--c-border)] rounded-lg p-3 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ['#22c55e', '#eab308', '#f97316', '#ef4444'][i % 4] }} />
                      <span className="text-xs text-gray-400">{a.name}</span>
                      <span className="text-sm font-bold text-[var(--c-fg)] ml-auto">{a.value}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState height={200} />
              )}
            </div>
          </div>
        </Section>

        <Section number={3} title="Stock Movement">
          {hasMovement ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="bg-[var(--c-card2)] border border-[var(--c-border)] rounded-lg p-3">
                <div className="text-[0.65rem] text-gray-500 uppercase tracking-wider">Counted On-Hand</div>
                <div className="text-base font-bold">{fmtGHS(mv.countedValue)}</div>
              </div>
              <div className="bg-[var(--c-card2)] border border-[var(--c-border)] rounded-lg p-3">
                <div className="text-[0.65rem] text-gray-500 uppercase tracking-wider">Goods Received</div>
                <div className="text-base font-bold text-green-400">{fmtGHS(mv.receivedValue)}</div>
                <div className="text-[0.6rem] text-gray-600 mt-0.5">{mv.receivedUnits.toLocaleString()} units</div>
              </div>
              <div className="bg-[var(--c-card2)] border border-[var(--c-border)] rounded-lg p-3">
                <div className="text-[0.65rem] text-gray-500 uppercase tracking-wider">Transferred</div>
                <div className="text-base font-bold text-blue-400">{fmtGHS(mv.transferredValue)}</div>
                <div className="text-[0.6rem] text-gray-600 mt-0.5">{mv.transferredUnits.toLocaleString()} units</div>
              </div>
              <div className="bg-[var(--c-card2)] border border-[var(--c-border)] rounded-lg p-3">
                <div className="text-[0.65rem] text-gray-500 uppercase tracking-wider">Dead Stock</div>
                <div className="text-base font-bold text-red-400">{fmtGHS(mv.deadStockValue)}</div>
              </div>
              <div className="bg-[var(--c-card2)] border border-[var(--c-border)] rounded-lg p-3">
                <div className="text-[0.65rem] text-gray-500 uppercase tracking-wider">Replenishment Reqs</div>
                <div className="text-base font-bold">{mv.replenishmentRequests}</div>
              </div>
            </div>
          ) : (
            <EmptyState message="No stock movement yet" hint="Goods Received, Stock Transfer & Dead Stock entries feed this." height={120} />
          )}
        </Section>

        <Section number={4} title="Suppliers & Replenishment">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-gray-400 mb-2">Goods Received by Supplier</div>
              {supplierPerformance.length ? (
                <SimpleBarChart data={supplierPerformance} height={200} color="#c8a951" horizontal prefix="GHS " />
              ) : (
                <EmptyState message="No supplier data yet" hint="Submit Goods Received (with supplier) in the Inventory form." height={200} />
              )}
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-2">Replenishment Requests</div>
              {replenishments.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[var(--c-border)] text-gray-500">
                        <th className="text-left py-2 pr-3 font-medium">SKU</th>
                        <th className="text-right py-2 px-2 font-medium">In Stock</th>
                        <th className="text-right py-2 px-2 font-medium">Reorder</th>
                        <th className="text-left py-2 pl-2 font-medium">Urgency</th>
                      </tr>
                    </thead>
                    <tbody>
                      {replenishments.map((r, i) => (
                        <tr key={i} className="border-b border-[var(--c-hover)]">
                          <td className="py-2 pr-3 truncate max-w-[10rem]">{r.description || r.sku}</td>
                          <td className="py-2 px-2 text-right">{r.currentStock}</td>
                          <td className="py-2 px-2 text-right">{r.reorderQty}</td>
                          <td className="py-2 pl-2 capitalize">{r.urgency || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState message="No replenishment requests yet" hint="Submit Replenishment Request in the Inventory form." height={200} />
              )}
            </div>
          </div>
        </Section>

        <Section number={5} title="Recent Entries">
          <RecentEntries department="inventory" />
        </Section>
      </div>
    </div>
  );
}
