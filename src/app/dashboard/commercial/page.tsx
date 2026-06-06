'use client';

import DashboardHeader from '@/components/layout/DashboardHeader';
import KPICard from '@/components/ui/KPICard';
import Section from '@/components/ui/Section';
import EmptyState from '@/components/ui/EmptyState';
import RecentEntries from '@/components/ui/RecentEntries';
import { SimpleBarChart, SimpleDonutChart } from '@/components/charts/Charts';
import { useMetrics } from '@/lib/api';

const fmtGHS = (n: number) =>
  n >= 1_000_000
    ? `GHS ${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
    ? `GHS ${(n / 1_000).toFixed(0)}K`
    : `GHS ${Math.round(n).toLocaleString()}`;
const dash = (n: number, f: (x: number) => string) => (n ? f(n) : '—');
const pct = (n: number) => (n ? `${n}%` : '—');

interface CommercialLive {
  groupSales: number;
  atv: number;
  upt: number;
  convRate: number;
  grossMargin: number;
  sellThrough: number;
  activeSku: number;
  categorySales: { name: string; value: number }[];
  sellThroughByCategory: { name: string; value: number }[];
  salesByStore: { name: string; value: number }[];
}

export default function CommercialPage() {
  const { data: m } = useMetrics<CommercialLive>('commercial');
  const categorySales = m?.categorySales ?? [];
  const sellThroughCat = m?.sellThroughByCategory ?? [];
  const salesByStore = m?.salesByStore ?? [];

  return (
    <div className="bg-[#0a0a0a] min-h-screen text-white">
      <DashboardHeader
        title="COMMERCIAL COMMAND CENTER"
        subtitle="RIGHT PRODUCT, RIGHT STORE. RIGHT PRICE, RIGHT TIME."
        mission="Commercial Mission"
        missionDetail="Drive profitable sell-through across every store and category."
      />

      <div className="px-6 py-4">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <KPICard label="Group Sales" value={dash(m?.groupSales ?? 0, fmtGHS)} status="green" small />
          <KPICard label="ATV" value={dash(m?.atv ?? 0, fmtGHS)} small />
          <KPICard label="UPT" value={(m?.upt ?? 0) ? String(m?.upt) : '—'} small />
          <KPICard label="Conversion Rate" value={pct(m?.convRate ?? 0)} small />
          <KPICard label="Gross Margin" value={pct(m?.grossMargin ?? 0)} small />
          <KPICard label="Sell Through" value={pct(m?.sellThrough ?? 0)} small />
          <KPICard label="Active SKUs" value={(m?.activeSku ?? 0) ? String(m?.activeSku) : '—'} small />
        </div>
      </div>

      <div className="px-6 pb-8 space-y-6">
        <Section number={1} title="Sales Performance" subtitle="MTD">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-gray-400 mb-2">Sales by Store</div>
              {salesByStore.length ? (
                <SimpleBarChart data={salesByStore} height={240} color="#c8a951" horizontal prefix="GHS " />
              ) : (
                <EmptyState message="No store sales yet" hint="Submit Daily Store Sales in the Commercial form." height={240} />
              )}
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-2">Category Sales Mix</div>
              {categorySales.length ? (
                <SimpleBarChart data={categorySales} height={240} color="#c8a951" prefix="GHS " />
              ) : (
                <EmptyState message="No category sales yet" hint="Submit Category Performance in the Commercial form." height={240} />
              )}
            </div>
          </div>
        </Section>

        <Section number={2} title="Sell-Through by Category">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div>
              {sellThroughCat.length ? (
                <SimpleDonutChart data={sellThroughCat} height={200} innerRadius={45} outerRadius={65} centerLabel="Categories" centerValue={String(sellThroughCat.length)} />
              ) : (
                <EmptyState message="No sell-through data yet" height={200} />
              )}
            </div>
            <div className="lg:col-span-2">
              {sellThroughCat.length ? (
                <div className="grid grid-cols-2 gap-2">
                  {sellThroughCat.map((c) => (
                    <div key={c.name} className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-3 flex justify-between items-center">
                      <span className="text-xs text-gray-400 capitalize">{c.name}</span>
                      <span className="text-sm font-bold text-[#c8a951]">{c.value}%</span>
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
          <RecentEntries department="commercial" />
        </Section>
      </div>
    </div>
  );
}
