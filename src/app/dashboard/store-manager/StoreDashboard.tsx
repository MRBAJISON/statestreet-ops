'use client';

import { useState } from 'react';
import DashboardHeader from '@/components/layout/DashboardHeader';
import KPICard from '@/components/ui/KPICard';
import Section from '@/components/ui/Section';
import EmptyState from '@/components/ui/EmptyState';
import PeriodTabs from '@/components/ui/PeriodTabs';
import { SimpleBarChart, SimpleDonutChart } from '@/components/charts/Charts';
import { useMetrics, useEntries, type Period } from '@/lib/api';
import BrandedLoader from '@/components/ui/BrandedLoader';
import { STORE_LABELS, labelFor } from '@/lib/config';

const fmtGHS = (n: number) => (!n ? '—' : n >= 1_000_000 ? `GHS ${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `GHS ${(n / 1_000).toFixed(0)}K` : `GHS ${Math.round(n)}`);
const pct = (n: number) => (n ? `${n}%` : '—');

interface CommercialLite {
  groupSales: number; atv: number; upt: number; convRate: number; grossMargin: number; sellThrough: number; activeSku: number;
  categorySales: { name: string; value: number }[];
  sellThroughByCategory: { name: string; value: number }[];
  weeklyReview: { count: number; latest: { achievement: number; weekEnd: string } | null; revenueByCategory: { name: string; value: number }[] };
}
interface FinanceLite {
  revenueMtd: number; transactions: number; footfall: number; itemsSold: number;
  grossMargin: number; revenueByCategory: { name: string; value: number }[];
}

export default function StoreDashboard({ assignedStore, managerName }: { assignedStore: string; managerName: string }) {
  const [period, setPeriod] = useState<Period>('mtd');
  const [anchor, setAnchor] = useState('');
  const { data: m, loading } = useMetrics<CommercialLite>('commercial', period, anchor, assignedStore);
  // Daily sales the store actually enters live in finance/revenue — source the
  // store's sales numbers and category breakdown from there, filtered to this store.
  const { data: f } = useMetrics<FinanceLite>('finance', period, anchor, assignedStore);
  const { entries: inv } = useEntries('inventory', 5000);

  const transfers = inv.filter((e) => e.formType === 'store-transfer' && (String(e.payload.fromStore) === assignedStore || String(e.payload.toStore) === assignedStore));
  const outgoing = transfers.filter((e) => String(e.payload.fromStore) === assignedStore);
  const incoming = transfers.filter((e) => String(e.payload.toStore) === assignedStore);
  const sumUnits = (rows: typeof transfers) => rows.reduce((s, e) => s + (Number(e.payload.units) || 0), 0);

  // Sales KPIs derived from the store's daily sales (finance/revenue).
  const storeSales = f?.revenueMtd ?? 0;
  const tx = f?.transactions ?? 0;
  const atv = tx ? Math.round(storeSales / tx) : 0;
  const upt = tx ? Math.round((f?.itemsSold ?? 0) / tx * 10) / 10 : 0;
  const conv = (f?.footfall ?? 0) ? Math.round(tx / (f?.footfall ?? 1) * 1000) / 10 : 0;
  const categorySales = f?.revenueByCategory ?? [];
  const sellThroughCat = m?.sellThroughByCategory ?? [];
  const storeName = labelFor(STORE_LABELS, assignedStore);

  if (loading && !m) return <BrandedLoader fullScreen />;

  return (
    <div className="bg-[var(--c-bg)] min-h-screen text-[var(--c-fg)]">
      <DashboardHeader
        title="MY STORE"
        subtitle={`${storeName.toUpperCase()} · ${managerName.toUpperCase()}`}
        mission="Store Mission"
        missionDetail="Hit the weekly target. Keep the store sharp and selling."
      />

      <div className="px-6 pt-4 flex justify-end">
        <PeriodTabs value={period} date={anchor} onChange={setPeriod} onDateChange={setAnchor} />
      </div>

      <div className="px-6 py-3">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <KPICard label="Store Sales" value={fmtGHS(storeSales)} small />
          <KPICard label="ATV" value={fmtGHS(atv)} small />
          <KPICard label="UPT" value={upt ? String(upt) : '—'} small />
          <KPICard label="Conversion" value={pct(conv)} small />
          <KPICard label="Gross Margin" value={pct(f?.grossMargin ?? 0)} small />
          <KPICard label="Sell Through" value={pct(m?.sellThrough ?? 0)} small />
          <KPICard label="Latest Achievement" value={m?.weeklyReview?.latest?.achievement ? `${m.weeklyReview.latest.achievement}%` : '—'} small />
        </div>
      </div>

      <div className="px-6 pb-8 space-y-6">
        <Section number={1} title="Sales by Category">
          {categorySales.length ? (
            <SimpleBarChart data={categorySales} height={240} color="#c8a951" prefix="GHS " />
          ) : (
            <EmptyState message="No category sales yet" hint="Log entries on your Daily Sales form." height={240} />
          )}
        </Section>

        <Section number={2} title="Sell-Through by Category">
          {sellThroughCat.length ? (
            <SimpleDonutChart data={sellThroughCat} height={220} innerRadius={50} outerRadius={70} centerLabel="Categories" centerValue={String(sellThroughCat.length)} />
          ) : (
            <EmptyState message="No sell-through data yet" height={220} />
          )}
        </Section>

        <Section number={3} title="Stock Transfers" subtitle="My store">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            <KPICard label="Outgoing (units)" value={sumUnits(outgoing) ? String(sumUnits(outgoing)) : '—'} small />
            <KPICard label="Incoming (units)" value={sumUnits(incoming) ? String(sumUnits(incoming)) : '—'} small />
            <KPICard label="Transfers" value={transfers.length ? String(transfers.length) : '—'} small />
          </div>
          {transfers.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--c-border)] text-gray-500">
                    <th className="text-left py-2 pr-3 font-medium">Date</th>
                    <th className="text-left py-2 pr-3 font-medium">From → To</th>
                    <th className="text-left py-2 pr-3 font-medium">Item</th>
                    <th className="text-right py-2 pl-3 font-medium">Units</th>
                  </tr>
                </thead>
                <tbody>
                  {[...transfers].sort((a, b) => (String(a.payload.date) < String(b.payload.date) ? 1 : -1)).slice(0, 20).map((e) => (
                    <tr key={e.id} className="border-b border-[var(--c-hover)]">
                      <td className="py-2 pr-3 whitespace-nowrap">{String(e.payload.date || '—')}</td>
                      <td className="py-2 pr-3">{labelFor(STORE_LABELS, e.payload.fromStore)} → {labelFor(STORE_LABELS, e.payload.toStore)}</td>
                      <td className="py-2 pr-3">{String(e.payload.sku || e.payload.description || '—')}</td>
                      <td className="py-2 pl-3 text-right">{String(e.payload.units || '—')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="No transfers yet" hint="Record a transfer in your Store Manager form." height={120} />
          )}
        </Section>
      </div>
    </div>
  );
}
