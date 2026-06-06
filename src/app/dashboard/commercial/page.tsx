'use client';

import DashboardHeader from '@/components/layout/DashboardHeader';
import KPICard from '@/components/ui/KPICard';
import Section from '@/components/ui/Section';
import EmptyState from '@/components/ui/EmptyState';
import RecentEntries from '@/components/ui/RecentEntries';
import { SimpleBarChart, SimpleDonutChart } from '@/components/charts/Charts';
import { useState } from 'react';
import PeriodTabs from '@/components/ui/PeriodTabs';
import { useMetrics, type Period } from '@/lib/api';
import { TARGETS, ragStatus } from '@/lib/targets';

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
  salesByStore: { name: string; value: number }[];
  topSelling: SkuRow[];
  lowMoving: SkuRow[];
  deadStock: SkuRow[];
  newArrivals: { date: string; brand: string; category: string; qty: number; stockValue: number; store: string; supplier: string }[];
  deploymentByStore: { name: string; value: number }[];
  accountability: { member: string; role: string; kpi: string; target: string; actual: string; status: string }[];
}

export default function CommercialPage() {
  const [period, setPeriod] = useState<Period>('mtd');
  const [anchor, setAnchor] = useState('');
  const { data: m } = useMetrics<CommercialLive>('commercial', period, anchor);
  const categorySales = m?.categorySales ?? [];
  const sellThroughCat = m?.sellThroughByCategory ?? [];
  const salesByStore = m?.salesByStore ?? [];
  const topSelling = m?.topSelling ?? [];
  const lowMoving = m?.lowMoving ?? [];
  const deadStock = m?.deadStock ?? [];
  const newArrivals = m?.newArrivals ?? [];
  const deploymentByStore = m?.deploymentByStore ?? [];
  const accountability = m?.accountability ?? [];

  const skuTable = (title: string, rows: SkuRow[], hint: string) => (
    <div>
      <div className="text-xs text-gray-400 mb-2">{title}</div>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#2a2a2a] text-gray-500">
                <th className="text-left py-2 pr-3 font-medium">SKU</th>
                <th className="text-right py-2 px-2 font-medium">Sales</th>
                <th className="text-right py-2 px-2 font-medium">Units</th>
                <th className="text-right py-2 pl-2 font-medium">Days</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.sku + s.name} className="border-b border-[#1a1a1a]">
                  <td className="py-2 pr-3 truncate max-w-[10rem]">{s.name || s.sku}</td>
                  <td className="py-2 px-2 text-right">{fmtGHS(s.salesValue)}</td>
                  <td className="py-2 px-2 text-right">{s.unitsSold || '—'}</td>
                  <td className="py-2 pl-2 text-right">{s.daysInStock || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState message="No SKU data yet" hint={hint} height={140} />
      )}
    </div>
  );

  return (
    <div className="bg-[#0a0a0a] min-h-screen text-white">
      <DashboardHeader
        title="COMMERCIAL COMMAND CENTER"
        subtitle="RIGHT PRODUCT, RIGHT STORE. RIGHT PRICE, RIGHT TIME."
        mission="Commercial Mission"
        missionDetail="Drive profitable sell-through across every store and category."
      />

      <div className="px-6 pt-4 flex justify-end">
        <PeriodTabs value={period} date={anchor} onChange={setPeriod} onDateChange={setAnchor} />
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

        <Section number={3} title="SKU Performance">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {skuTable('Top Selling', topSelling, 'Submit SKU Performance in the Commercial form.')}
            {skuTable('Low Moving (60–180d)', lowMoving, 'SKUs aging 60–180 days appear here.')}
            {skuTable('Dead Stock (180d+)', deadStock, 'SKUs over 180 days or flagged dead appear here.')}
          </div>
        </Section>

        <Section number={4} title="New Arrivals & Deployment">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <div className="text-xs text-gray-400 mb-2">Recent New Arrivals</div>
              {newArrivals.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[#2a2a2a] text-gray-500">
                        <th className="text-left py-2 pr-3 font-medium">Date</th>
                        <th className="text-left py-2 pr-3 font-medium">Brand</th>
                        <th className="text-left py-2 pr-3 font-medium">Category</th>
                        <th className="text-right py-2 px-2 font-medium">Qty</th>
                        <th className="text-right py-2 px-2 font-medium">Value</th>
                        <th className="text-left py-2 pl-2 font-medium">Store</th>
                      </tr>
                    </thead>
                    <tbody>
                      {newArrivals.map((a, i) => (
                        <tr key={i} className="border-b border-[#1a1a1a]">
                          <td className="py-2 pr-3 whitespace-nowrap">{a.date || '—'}</td>
                          <td className="py-2 pr-3">{a.brand}</td>
                          <td className="py-2 pr-3">{a.category}</td>
                          <td className="py-2 px-2 text-right">{a.qty || '—'}</td>
                          <td className="py-2 px-2 text-right">{a.stockValue ? fmtGHS(a.stockValue) : '—'}</td>
                          <td className="py-2 pl-2">{a.store}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState message="No new arrivals logged" hint="Submit New Arrivals in the Commercial form." height={160} />
              )}
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-2">Deployment by Store (units)</div>
              {deploymentByStore.length ? (
                <SimpleBarChart data={deploymentByStore} height={200} color="#c8a951" horizontal />
              ) : (
                <EmptyState message="No deployment yet" height={200} />
              )}
            </div>
          </div>
        </Section>

        <Section number={5} title="Accountability">
          {accountability.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#2a2a2a] text-gray-500">
                    <th className="text-left py-2 pr-3 font-medium">Member</th>
                    <th className="text-left py-2 px-3 font-medium">Role</th>
                    <th className="text-left py-2 px-3 font-medium">KPI</th>
                    <th className="text-left py-2 px-3 font-medium">Target</th>
                    <th className="text-left py-2 px-3 font-medium">Actual</th>
                    <th className="text-left py-2 pl-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {accountability.map((a, i) => (
                    <tr key={i} className="border-b border-[#1a1a1a]">
                      <td className="py-2 pr-3">{a.member}</td>
                      <td className="py-2 px-3 capitalize">{a.role || '—'}</td>
                      <td className="py-2 px-3">{a.kpi}</td>
                      <td className="py-2 px-3">{a.target || '—'}</td>
                      <td className="py-2 px-3">{a.actual || '—'}</td>
                      <td className="py-2 pl-3 capitalize">{a.status || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="No accountability entries yet" hint="Submit Accountability Update in the Commercial form." height={120} />
          )}
        </Section>

        <Section number={6} title="Recent Entries">
          <RecentEntries department="commercial" />
        </Section>
      </div>
    </div>
  );
}
