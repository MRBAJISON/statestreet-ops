'use client';

import DashboardHeader from '@/components/layout/DashboardHeader';
import KPICard from '@/components/ui/KPICard';
import Section from '@/components/ui/Section';
import EmptyState from '@/components/ui/EmptyState';
import RecentEntries from '@/components/ui/RecentEntries';
import { SimpleBarChart, SimpleDonutChart, CandlestickChart } from '@/components/charts/Charts';
import BrandedLoader from '@/components/ui/BrandedLoader';
import { useState } from 'react';
import PeriodTabs from '@/components/ui/PeriodTabs';
import { useMetrics, type Period } from '@/lib/api';
import { TARGETS, ragStatus } from '@/lib/targets';
import { useOrg } from '@/components/providers/OrgProvider';
import { toLabelMap, brandOfStore } from '@/lib/org';
import { ShowMoreRows, ShowMoreGrid } from '@/components/ui/ShowMore';

const fmtGHS = (n: number) =>
  n >= 1_000_000
    ? `GHS ${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
    ? `GHS ${(n / 1_000).toFixed(0)}K`
    : `GHS ${Math.round(n).toLocaleString()}`;
const dash = (n: number, f: (x: number) => string) => (n ? f(n) : '—');
const pct = (n: number) => (n ? `${n}%` : '—');

interface SkuRow {
  sku: string;
  name: string;
  category: string;
  salesValue: number;
  unitsSold: number;
  stock: number;
  daysInStock: number;
  status: string;
}
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
  achievementTrend: { name: string; open: number; high: number; low: number; close: number }[];
  salesByStore: { name: string; value: number }[];
  topSelling: SkuRow[];
  lowMoving: SkuRow[];
  deadStock: SkuRow[];
  skuInsights: { name: string; category: string; sellThrough: number; performance: string; promo: string; insight: string }[];
  newArrivals: { date: string; brand: string; category: string; qty: number; stockValue: number; store: string; supplier: string }[];
  deploymentByStore: { name: string; value: number }[];
  accountability: { member: string; role: string; kpi: string; target: string; actual: string; status: string }[];
  weeklyReview: {
    count: number;
    reviews: WeeklyReviewRecord[];
    revenueByCategory: { name: string; value: number }[];
    ratingCounts: { name: string; value: number }[];
    stockAtRisk: number;
    atRiskCategories: number;
    latest: { store: string; weekEnd: string; manager: string; achievement: number; actualSales: number; salesTarget: number } | null;
    ceo: Record<string, string> | null;
  };
  managerVoices: { store: string; manager: string; weekEnd: string; answers: { q: string; a: string }[] }[];
  categoryTargets: { name: string; actualRev: number; targetRev: number; actualUnits: number; targetUnits: number; revAch: number; unitAch: number }[];
  leads: { date: string; name: string; leadBuyer: string; occupation: string; number: string; size: string; item: string; source: string; sourceDetail: string; staff: string; store: string }[];
  leadsBySource: { name: string; value: number }[];
  leadsTotal: number;
  buyersCount: number;
  leadsOnly: number;
}
interface WeeklyReviewRecord {
  id: number;
  store: string;
  weekEnd: string;
  manager: string;
  achievement: number;
  actualSales: number;
  salesTarget: number;
  submittedAt: string;
  ceo: Record<string, string> | null;
  revenueByCategory: { name: string; value: number }[];
  ratingCounts: { name: string; value: number }[];
  stockAtRisk: number;
  atRiskCategories: number;
}

export default function CommercialPage() {
  const [period, setPeriod] = useState<Period>('mtd');
  const [anchor, setAnchor] = useState('');
  const [store, setStore] = useState('');
  const { org } = useOrg();
  const { data: m, loading } = useMetrics<CommercialLive>('commercial', period, anchor, store);
  const categorySales = m?.categorySales ?? [];
  const sellThroughCat = m?.sellThroughByCategory ?? [];
  const salesByStore = m?.salesByStore ?? [];
  const skuInsights = m?.skuInsights ?? [];
  const topSelling = m?.topSelling ?? [];
  const lowMoving = m?.lowMoving ?? [];
  const deadStock = m?.deadStock ?? [];
  const accountability = m?.accountability ?? [];
  const leads = m?.leads ?? [];
  const leadsBySource = m?.leadsBySource ?? [];
  const managerVoices = m?.managerVoices ?? [];
  const categoryTargets = m?.categoryTargets ?? [];

  // Brand Performance — every store belongs to a brand, so roll the daily store
  // sales up to brand via the store (Brand → Stores mapping in Settings).
  const storeLabelToValue = new Map(org.stores.map((s) => [s.label, s.value]));
  const brandLabels = toLabelMap(org.brands);
  const brandAgg = new Map<string, number>();
  for (const ss of salesByStore) {
    const storeVal = storeLabelToValue.get(ss.name) ?? ss.name;
    const bv = brandOfStore(org, storeVal);
    const name = bv ? (brandLabels[bv] ?? bv) : 'Unassigned';
    brandAgg.set(name, (brandAgg.get(name) ?? 0) + ss.value);
  }
  const brandPerformance = [...brandAgg].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const brandTotal = brandPerformance.reduce((s, b) => s + b.value, 0);
  const wr = m?.weeklyReview;
  const wrReviews = wr?.reviews ?? [];
  const [wrWeek, setWrWeek] = useState<number | 'all'>('all');
  const wrSel = typeof wrWeek === 'number' ? wrReviews.find((r) => r.id === wrWeek) : undefined;
  // Displayed slice: a single week when selected, else the all-weeks aggregate.
  const wrView = wrSel
    ? {
        revenueByCategory: wrSel.revenueByCategory,
        ratingCounts: wrSel.ratingCounts,
        stockAtRisk: wrSel.stockAtRisk,
        atRiskCategories: wrSel.atRiskCategories,
        achievement: wrSel.achievement,
        heading: `${wrSel.store} · week ending ${wrSel.weekEnd}`,
      }
    : wr
    ? {
        revenueByCategory: wr.revenueByCategory,
        ratingCounts: wr.ratingCounts,
        stockAtRisk: wr.stockAtRisk,
        atRiskCategories: wr.atRiskCategories,
        achievement: wr.latest?.achievement ?? 0,
        heading: `All weeks · ${wr.count} review${wr.count === 1 ? '' : 's'}`,
      }
    : null;

  const skuTable = (title: string, rows: SkuRow[], hint: string) => (
    <div>
      <div className="text-xs text-gray-400 mb-2">{title}</div>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--c-border)] text-gray-500">
                <th className="text-left py-2 pr-3 font-medium">SKU</th>
                <th className="text-right py-2 px-2 font-medium">Sales</th>
                <th className="text-right py-2 px-2 font-medium">Units</th>
                <th className="text-right py-2 pl-2 font-medium">Days</th>
              </tr>
            </thead>
            <tbody>
              <ShowMoreRows items={rows} limit={7} colSpan={4}>
                {(s) => (
                <tr key={s.sku + s.name} className="border-b border-[var(--c-hover)]">
                  <td className="py-2 pr-3 truncate max-w-[10rem]">{s.name || s.sku}</td>
                  <td className="py-2 px-2 text-right">{fmtGHS(s.salesValue)}</td>
                  <td className="py-2 px-2 text-right">{s.unitsSold || '—'}</td>
                  <td className="py-2 pl-2 text-right">{s.daysInStock || '—'}</td>
                </tr>
                )}
              </ShowMoreRows>
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState message="No SKU data yet" hint={hint} height={140} />
      )}
    </div>
  );

  if (loading && !m) return <BrandedLoader fullScreen />;

  return (
    <div className="bg-[var(--c-bg)] min-h-screen text-[var(--c-fg)]">
      <DashboardHeader
        title="COMMERCIAL COMMAND CENTER"
        subtitle="RIGHT PRODUCT, RIGHT STORE. RIGHT PRICE, RIGHT TIME."
        mission="Commercial Mission"
        missionDetail="Drive profitable sell-through across every store and category."
      />

      <div className="px-6 pt-4 flex justify-end">
        <PeriodTabs value={period} date={anchor} onChange={setPeriod} onDateChange={setAnchor} store={store} stores={org.stores} onStoreChange={setStore} />
      </div>
      <div className="px-6 py-3">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <KPICard
            label="Group Sales"
            value={dash(m?.groupSales ?? 0, fmtGHS)}
            target={TARGETS.commercial.groupSales ? fmtGHS(TARGETS.commercial.groupSales) : undefined}
            status={ragStatus(m?.groupSales ?? 0, TARGETS.commercial.groupSales) ?? 'green'}
            small
          />
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <div>
              <div className="text-xs text-gray-400 mb-2">Brand Performance</div>
              {brandPerformance.length ? (
                <SimpleBarChart data={brandPerformance} height={240} color="#3b82f6" horizontal prefix="GHS " />
              ) : (
                <EmptyState message="No brand sales yet" hint="Map Brand → Categories in Settings, then submit Category Performance." height={240} />
              )}
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-2">Brand Share of Sales</div>
              {brandPerformance.length ? (
                <ShowMoreGrid items={brandPerformance} limit={7} wrapClass="grid grid-cols-1 gap-2">
                  {(b) => (
                    <div key={b.name} className="bg-[var(--c-card2)] border border-[var(--c-border)] rounded-lg p-3 flex justify-between items-center">
                      <span className="text-xs text-gray-400">{b.name}</span>
                      <span className="text-sm font-bold text-[#c8a951]">{fmtGHS(b.value)} <span className="text-gray-500 font-normal">· {brandTotal ? Math.round((b.value / brandTotal) * 100) : 0}%</span></span>
                    </div>
                  )}
                </ShowMoreGrid>
              ) : (
                <EmptyState height={240} />
              )}
            </div>
          </div>
        </Section>

        <Section number={2} title="Sell-Through by Category">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div>
              {sellThroughCat.length ? (
                <SimpleDonutChart data={sellThroughCat} height={200} centerLabel="Categories" centerValue={String(sellThroughCat.length)} />
              ) : (
                <EmptyState message="No sell-through data yet" height={200} />
              )}
            </div>
            <div className="lg:col-span-2">
              {sellThroughCat.length ? (
                <ShowMoreGrid items={sellThroughCat} limit={7} wrapClass="grid grid-cols-2 gap-2">
                  {(c) => (
                    <div key={c.name} className="bg-[var(--c-card2)] border border-[var(--c-border)] rounded-lg p-3 flex justify-between items-center">
                      <span className="text-xs text-gray-400 capitalize">{c.name}</span>
                      <span className="text-sm font-bold text-[#c8a951]">{c.value}%</span>
                    </div>
                  )}
                </ShowMoreGrid>
              ) : (
                <EmptyState height={200} />
              )}
            </div>
          </div>
        </Section>

        <Section number={3} title="SKU Performance">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {skuTable('Top Selling', topSelling, 'Submit SKU Performance in the Commercial form.')}
            {skuTable('Low Moving (60–180d)', lowMoving, 'SKUs aging 60–180 days appear here.')}
            {skuTable('Dead Stock (180d+)', deadStock, 'SKUs over 180 days or flagged dead appear here.')}
          </div>

          <div className="mt-4">
            <div className="text-xs text-gray-400 mb-2">Commercial Insight on Items</div>
            {skuInsights.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--c-border)] text-gray-500">
                      <th className="text-left py-2 pr-3 font-medium">Item</th>
                      <th className="text-left py-2 pr-3 font-medium">Category</th>
                      <th className="text-right py-2 px-3 font-medium">Sell-Through</th>
                      <th className="text-left py-2 pr-3 font-medium">Performance</th>
                      <th className="text-left py-2 pr-3 font-medium">Promo</th>
                      <th className="text-left py-2 font-medium">Insight</th>
                    </tr>
                  </thead>
                  <tbody>
                    <ShowMoreRows items={skuInsights} limit={7} colSpan={6}>
                      {(s, i) => {
                      const tone = s.performance === 'strong' ? 'text-green-400' : s.performance === 'underperforming' ? 'text-red-400' : 'text-[#c8a951]';
                      return (
                        <tr key={i} className="border-b border-[var(--c-hover)]">
                          <td className="py-2 pr-3">{s.name}</td>
                          <td className="py-2 pr-3 text-gray-400">{s.category}</td>
                          <td className="py-2 px-3 text-right">{s.sellThrough ? `${s.sellThrough}%` : '—'}</td>
                          <td className={`py-2 pr-3 capitalize ${tone}`}>{s.performance || '—'}</td>
                          <td className="py-2 pr-3 text-gray-400">{s.promo || '—'}</td>
                          <td className="py-2 text-gray-300 max-w-[20rem] truncate" title={s.insight}>{s.insight || '—'}</td>
                        </tr>
                      );
                      }}
                    </ShowMoreRows>
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState message="No commercial insights yet" hint="Add Commercial Insight on the SKU form." height={120} />
            )}
          </div>
        </Section>

        <Section number={4} title="Accountability">
          {accountability.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--c-border)] text-gray-500">
                    <th className="text-left py-2 pr-3 font-medium">Member</th>
                    <th className="text-left py-2 px-3 font-medium">Role</th>
                    <th className="text-left py-2 px-3 font-medium">KPI</th>
                    <th className="text-left py-2 px-3 font-medium">Target</th>
                    <th className="text-left py-2 px-3 font-medium">Actual</th>
                    <th className="text-left py-2 pl-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <ShowMoreRows items={accountability} limit={7} colSpan={6}>
                    {(a, i) => (
                    <tr key={i} className="border-b border-[var(--c-hover)]">
                      <td className="py-2 pr-3">{a.member}</td>
                      <td className="py-2 px-3 capitalize">{a.role || '—'}</td>
                      <td className="py-2 px-3">{a.kpi}</td>
                      <td className="py-2 px-3">{a.target || '—'}</td>
                      <td className="py-2 px-3">{a.actual || '—'}</td>
                      <td className="py-2 pl-3 capitalize">{a.status || '—'}</td>
                    </tr>
                    )}
                  </ShowMoreRows>
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="No accountability entries yet" hint="Submit Accountability Update in the Commercial form." height={120} />
          )}
        </Section>

        <Section number={5} title="Store Manager Weekly Review" subtitle={wrView ? wrView.heading : undefined}>
          {wr && wr.count > 0 && wrView ? (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {/* Week history list */}
              <div className="lg:col-span-1">
                <div className="text-xs text-gray-400 mb-2">History</div>
                <div className="space-y-1 max-h-[360px] overflow-y-auto pr-1">
                  <button
                    onClick={() => setWrWeek('all')}
                    className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-colors ${wrWeek === 'all' ? 'bg-[#c8a951] text-black border-[#c8a951] font-semibold' : 'bg-[var(--c-card2)] border-[var(--c-border)] text-gray-300 hover:border-[#c8a951]'}`}
                  >
                    <div>All weeks</div>
                    <div className={wrWeek === 'all' ? 'text-black/70' : 'text-gray-500'}>{wr.count} review{wr.count === 1 ? '' : 's'}</div>
                  </button>
                  {wrReviews.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setWrWeek(r.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-colors ${wrWeek === r.id ? 'bg-[#c8a951] text-black border-[#c8a951] font-semibold' : 'bg-[var(--c-card2)] border-[var(--c-border)] text-gray-300 hover:border-[#c8a951]'}`}
                    >
                      <div>Week ending {r.weekEnd || '—'}</div>
                      <div className={wrWeek === r.id ? 'text-black/70' : 'text-gray-500'}>{r.store}{r.achievement ? ` · ${r.achievement}%` : ''}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Selected week / aggregate detail */}
              <div className="lg:col-span-3 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <KPICard label={wrSel ? 'Selected Week' : 'Reviews Submitted'} value={wrSel ? '1' : String(wr.count)} small />
                  <KPICard label="Achievement" value={wrView.achievement ? `${wrView.achievement}%` : '—'} status={ragStatus(wrView.achievement, 100) ?? 'green'} small />
                  <KPICard label="Stock at Risk" value={dash(wrView.stockAtRisk, fmtGHS)} small />
                  <KPICard label="At-Risk Categories" value={wrView.atRiskCategories ? String(wrView.atRiskCategories) : '—'} small />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2">
                    <div className="text-xs text-gray-400 mb-2">Revenue by Category (top 12)</div>
                    {wrView.revenueByCategory.length ? (
                      <SimpleBarChart data={wrView.revenueByCategory} height={260} color="#c8a951" prefix="GHS " />
                    ) : (
                      <EmptyState message="No category revenue captured" height={260} />
                    )}
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-2">Category Ratings</div>
                    {wrView.ratingCounts.some((r) => r.value > 0) ? (
                      <SimpleDonutChart data={wrView.ratingCounts} height={200} innerRadius={45} outerRadius={65} centerLabel="Rated" centerValue={String(wrView.ratingCounts.reduce((s, r) => s + r.value, 0))} />
                    ) : (
                      <EmptyState message="No ratings yet" height={200} />
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState message="No weekly reviews yet" hint="Submit a Weekly Review in the Commercial form." height={160} />
          )}
        </Section>

        <Section title="Weekly Review Submissions" subtitle="all stores">
          {wrReviews.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--c-border)] text-gray-500">
                    <th className="text-left py-2 pr-3 font-medium">Week Ending</th>
                    <th className="text-left py-2 pr-3 font-medium">Store</th>
                    <th className="text-left py-2 pr-3 font-medium">Manager</th>
                    <th className="text-right py-2 px-3 font-medium">Actual Sales</th>
                    <th className="text-right py-2 px-3 font-medium">Target</th>
                    <th className="text-right py-2 px-3 font-medium">Achievement</th>
                    <th className="text-left py-2 font-medium">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  <ShowMoreRows items={[...wrReviews].sort((a, b) => (a.weekEnd < b.weekEnd ? 1 : -1))} limit={7} colSpan={7}>
                    {(r) => (
                    <tr key={r.id} className="border-b border-[var(--c-hover)]">
                      <td className="py-2 pr-3 whitespace-nowrap">{r.weekEnd || '—'}</td>
                      <td className="py-2 pr-3">{r.store || '—'}</td>
                      <td className="py-2 pr-3">{r.manager || '—'}</td>
                      <td className="py-2 px-3 text-right">{r.actualSales ? fmtGHS(r.actualSales) : '—'}</td>
                      <td className="py-2 px-3 text-right">{r.salesTarget ? fmtGHS(r.salesTarget) : '—'}</td>
                      <td className="py-2 px-3 text-right font-semibold text-[#c8a951]">{r.achievement ? `${r.achievement}%` : '—'}</td>
                      <td className="py-2 whitespace-nowrap text-gray-500">{String(r.submittedAt || '').slice(0, 10) || '—'}</td>
                    </tr>
                    )}
                  </ShowMoreRows>
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="No weekly review submissions yet" hint="Submit a Weekly Review on the Commercial form (or have a store manager submit theirs)." height={160} />
          )}
        </Section>

        <Section title="Category Target vs Actual" subtitle="From weekly reviews">
          {categoryTargets.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--c-border)] text-gray-500">
                    <th className="text-left py-2 pr-3 font-medium">Category</th>
                    <th className="text-right py-2 px-3 font-medium">Target Rev</th>
                    <th className="text-right py-2 px-3 font-medium">Actual Rev</th>
                    <th className="text-right py-2 px-3 font-medium">Rev %</th>
                    <th className="text-right py-2 px-3 font-medium">Target Units</th>
                    <th className="text-right py-2 px-3 font-medium">Actual Units</th>
                    <th className="text-right py-2 font-medium">Unit %</th>
                  </tr>
                </thead>
                <tbody>
                  <ShowMoreRows items={categoryTargets} limit={7} colSpan={7}>
                    {(c) => {
                    const achCls = (a: number) => (!a ? 'text-gray-500' : a >= 100 ? 'text-green-400' : a >= 80 ? 'text-[#c8a951]' : 'text-red-400');
                    return (
                      <tr key={c.name} className="border-b border-[var(--c-hover)]">
                        <td className="py-2 pr-3 whitespace-nowrap">{c.name}</td>
                        <td className="py-2 px-3 text-right">{c.targetRev ? fmtGHS(c.targetRev) : '—'}</td>
                        <td className="py-2 px-3 text-right">{c.actualRev ? fmtGHS(c.actualRev) : '—'}</td>
                        <td className={`py-2 px-3 text-right font-semibold ${achCls(c.revAch)}`}>{c.revAch ? `${c.revAch}%` : '—'}</td>
                        <td className="py-2 px-3 text-right">{c.targetUnits || '—'}</td>
                        <td className="py-2 px-3 text-right">{c.actualUnits || '—'}</td>
                        <td className={`py-2 text-right font-semibold ${achCls(c.unitAch)}`}>{c.unitAch ? `${c.unitAch}%` : '—'}</td>
                      </tr>
                    );
                    }}
                  </ShowMoreRows>
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="No category targets yet" hint="Set Revenue/Unit targets per category in Section 3 of the Weekly Review." height={160} />
          )}
        </Section>

        <Section title="Manager Voices" subtitle="Latest strategic answers per store">
          {managerVoices.length ? (
            <ShowMoreGrid items={managerVoices} limit={7} wrapClass="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(v) => (
                <div key={`${v.store}-${v.weekEnd}`} className="bg-[var(--c-card2)] border border-[var(--c-border)] rounded-lg p-3">
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-sm font-semibold">{v.store}</span>
                    <span className="text-xs text-gray-500">{v.manager}{v.weekEnd ? ` · ${v.weekEnd}` : ''}</span>
                  </div>
                  <div className="space-y-2">
                    {v.answers.map((ans, i) => (
                      <div key={i}>
                        <div className="text-xs text-[#c8a951]">{ans.q}</div>
                        <div className="text-xs text-gray-300">{ans.a}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </ShowMoreGrid>
          ) : (
            <EmptyState message="No manager input yet" hint="The Manager Questions in Section 1 of the Weekly Review feed this." height={160} />
          )}
        </Section>

        <Section number={6} title="Sales Achievement Trend" subtitle="Weekly target achievement — forex view">
          {(m?.achievementTrend?.length ?? 0) >= 2 ? (
            <>
              <div className="text-xs text-gray-500 mb-3">
                Each candle is one week. Body = open→close achievement, wick = best/worst store that week.{' '}
                <span className="text-green-500">Green</span> = improving on the prior week,{' '}
                <span className="text-red-500">red</span> = declining. Gold line marks the 100% target.
              </div>
              <CandlestickChart data={m!.achievementTrend} height={300} suffix="%" target={100} />
            </>
          ) : (
            <EmptyState message="Not enough weekly reviews yet" hint="Two or more weeks of reviews build the trend." height={200} />
          )}
        </Section>

        <Section number={7} title="Customer Database" subtitle="Walk-in captures">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            <KPICard label="Captured" value={(m?.leadsTotal ?? 0) ? String(m?.leadsTotal) : '—'} small />
            <KPICard label="Buyers" value={(m?.buyersCount ?? 0) ? String(m?.buyersCount) : '—'} small />
            <KPICard label="Leads" value={(m?.leadsOnly ?? 0) ? String(m?.leadsOnly) : '—'} small />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-gray-400 mb-2">By Source</div>
              {leadsBySource.length ? (
                <SimpleBarChart data={leadsBySource} height={220} color="#3b82f6" horizontal />
              ) : (
                <EmptyState message="No captures yet" hint="Stores log walk-ins on the Customer Capture form." height={220} />
              )}
            </div>
            <div className="lg:col-span-2">
              <div className="text-xs text-gray-400 mb-2">Recent Customers</div>
              {leads.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[var(--c-border)] text-gray-500">
                        <th className="text-left py-2 pr-3 font-medium">Date</th>
                        <th className="text-left py-2 pr-3 font-medium">Name</th>
                        <th className="text-left py-2 pr-3 font-medium">Type</th>
                        <th className="text-left py-2 pr-3 font-medium">Phone</th>
                        <th className="text-left py-2 pr-3 font-medium">Item</th>
                        <th className="text-left py-2 pr-3 font-medium">Source</th>
                        <th className="text-left py-2 pr-3 font-medium">Store</th>
                        <th className="text-left py-2 font-medium">Staff</th>
                      </tr>
                    </thead>
                    <tbody>
                      <ShowMoreRows items={leads} limit={7} colSpan={8}>
                        {(l, i) => (
                        <tr key={i} className="border-b border-[var(--c-hover)]">
                          <td className="py-2 pr-3 whitespace-nowrap">{l.date || '—'}</td>
                          <td className="py-2 pr-3">{l.name || '—'}</td>
                          <td className="py-2 pr-3 capitalize">{l.leadBuyer || '—'}</td>
                          <td className="py-2 pr-3 whitespace-nowrap">{l.number || '—'}</td>
                          <td className="py-2 pr-3">{l.item || '—'}</td>
                          <td className="py-2 pr-3">{l.source}{l.sourceDetail ? ` · ${l.sourceDetail}` : ''}</td>
                          <td className="py-2 pr-3">{l.store}</td>
                          <td className="py-2">{l.staff || '—'}</td>
                        </tr>
                        )}
                      </ShowMoreRows>
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState message="No customers captured yet" height={220} />
              )}
            </div>
          </div>
        </Section>

        <Section number={8} title="Recent Entries">
          <RecentEntries department="commercial" />
        </Section>
      </div>
    </div>
  );
}
