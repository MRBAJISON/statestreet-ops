'use client';

import Link from 'next/link';
import DashboardHeader from '@/components/layout/DashboardHeader';
import KPICard from '@/components/ui/KPICard';
import Section from '@/components/ui/Section';
import EmptyState from '@/components/ui/EmptyState';
import { SimpleDonutChart, SimpleBarChart } from '@/components/charts/Charts';
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

export default function ExecutiveCommandCenter() {
  const [period, setPeriod] = useState<Period>('mtd');
  const [anchor, setAnchor] = useState('');
  const [store, setStore] = useState('');
  const fin = useMetrics<{ revenueMtd: number; netProfit: number; grossMargin: number; cashNet: number; revenueByBrand: { name: string; value: number }[] }>('finance', period, anchor, store).data;
  const com = useMetrics<{ groupSales: number; convRate: number; salesByStore: { name: string; value: number }[]; categorySales: { name: string; value: number }[]; sellThroughByCategory: { name: string; value: number }[] }>('commercial', period, anchor, store).data;
  const ops = useMetrics<{ opsScore: number; openIssues: number; storeScores: { store: string; ops: number; vm: number; readiness: number; cx: number }[]; priorityActions: { description: string; priority: string; owner: string; store: string; status: string }[] }>('operations', period, anchor, store).data;
  const inv = useMetrics<{ inventoryValue: number; accuracy: number }>('inventory', period, anchor, store).data;
  const brd = useMetrics<{ healthIndex: number; sentiment: { positive: number }; ceoAttention: { priority: string; issue: string; impact: string; owner: string; status: string }[] }>('brand', period, anchor, store).data;
  const mkt = useMetrics<{ totalLeads: number; actions: { task: string; owner: string; priority: string; status: string; deadline: string }[] }>('marketing', period, anchor, store).data;

  const revenueByBrand = fin?.revenueByBrand ?? [];
  const salesByStore = com?.salesByStore ?? [];
  const categorySales = com?.categorySales ?? [];
  const sellThroughByCategory = com?.sellThroughByCategory ?? [];

  // Merge commercial sales + operations audit scores into one store-performance view
  const storeMap = new Map<string, { sales: number; ops: number; vm: number }>();
  for (const s of salesByStore) storeMap.set(s.name, { sales: s.value, ops: 0, vm: 0 });
  for (const s of ops?.storeScores ?? []) {
    const cur = storeMap.get(s.store) ?? { sales: 0, ops: 0, vm: 0 };
    cur.ops = s.ops;
    cur.vm = s.vm;
    storeMap.set(s.store, cur);
  }
  const storePerformance = [...storeMap].map(([store, v]) => ({ store, ...v })).sort((a, b) => b.sales - a.sales);
  const ceoAttention = brd?.ceoAttention ?? [];

  // Cross-department action tracker (Marketing priorities + Operations maintenance actions)
  const actionTracker = [
    ...(mkt?.actions ?? []).map((a) => ({ dept: 'Marketing', task: a.task, owner: a.owner, priority: a.priority, status: a.status })),
    ...(ops?.priorityActions ?? []).map((a) => ({ dept: 'Operations', task: a.description, owner: a.owner, priority: a.priority, status: a.status })),
  ];

  const departments = [
    { name: 'Finance', href: '/dashboard/finance', metric: 'Revenue MTD', value: dash(fin?.revenueMtd ?? 0, fmtGHS) },
    { name: 'Commercial', href: '/dashboard/commercial', metric: 'Group Sales', value: dash(com?.groupSales ?? 0, fmtGHS) },
    { name: 'Marketing', href: '/dashboard/marketing', metric: 'Total Leads', value: (mkt?.totalLeads ?? 0) ? String(mkt?.totalLeads) : '—' },
    { name: 'Operations', href: '/dashboard/operations', metric: 'Ops Score', value: pct(ops?.opsScore ?? 0) },
    { name: 'Inventory', href: '/dashboard/inventory', metric: 'Inventory Value', value: dash(inv?.inventoryValue ?? 0, fmtGHS) },
    { name: 'Brand Health', href: '/dashboard/brand-health', metric: 'Health Index', value: (brd?.healthIndex ?? 0) ? String(brd?.healthIndex) : '—' },
  ];

  return (
    <div className="bg-[#0a0a0a] min-h-screen text-white">
      <DashboardHeader
        title="EXECUTIVE COMMAND CENTER"
        subtitle="ONE VISION. ONE TEAM. ONE DESTINATION."
        mission="Mission"
        missionDetail="Build Ghana's most trusted premium retail group."
      />

      {/* GROUP KPI BAR */}
      <div className="px-6 pt-4 flex justify-end">
        <PeriodTabs value={period} date={anchor} onChange={setPeriod} onDateChange={setAnchor} store={store} stores={STORES} onStoreChange={setStore} />
      </div>
      <div className="px-6 py-3">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <KPICard label="Group Revenue" value={dash(fin?.revenueMtd ?? 0, fmtGHS)} status="green" small />
          <KPICard label="Net Profit" value={dash(fin?.netProfit ?? 0, fmtGHS)} status={(fin?.netProfit ?? 0) >= 0 ? 'green' : 'red'} small />
          <KPICard label="Gross Margin" value={pct(fin?.grossMargin ?? 0)} small />
          <KPICard label="Net Cash Flow" value={dash(fin?.cashNet ?? 0, fmtGHS)} status={(fin?.cashNet ?? 0) >= 0 ? 'green' : 'red'} small />
          <KPICard label="Store Sales" value={dash(com?.groupSales ?? 0, fmtGHS)} small />
          <KPICard label="Inventory Value" value={dash(inv?.inventoryValue ?? 0, fmtGHS)} small />
          <KPICard label="Ops Score" value={pct(ops?.opsScore ?? 0)} small />
        </div>
      </div>

      <div className="px-6 pb-8 space-y-6">
        {/* Group analytics */}
        <Section number={1} title="Group Performance" subtitle="Live">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-gray-400 mb-2">Revenue by Brand</div>
              {revenueByBrand.length ? (
                <SimpleDonutChart
                  data={revenueByBrand}
                  height={220}
                  innerRadius={55}
                  outerRadius={80}
                  centerLabel="Revenue"
                  centerValue={fmtGHS(fin?.revenueMtd ?? 0)}
                />
              ) : (
                <EmptyState message="No revenue yet" hint="Add revenue entries in the Finance form." height={220} />
              )}
            </div>
            <div className="lg:col-span-2">
              <div className="text-xs text-gray-400 mb-2">Sales by Store</div>
              {salesByStore.length ? (
                <SimpleBarChart data={salesByStore} height={220} color="#c8a951" prefix="GHS " />
              ) : (
                <EmptyState message="No store sales yet" hint="Add Daily Store Sales in the Commercial form." height={220} />
              )}
            </div>
          </div>
        </Section>

        {/* Store performance */}
        <Section number={2} title="Store Performance">
          {storePerformance.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#2a2a2a] text-gray-500">
                    <th className="text-left py-2 pr-3 font-medium">Store</th>
                    <th className="text-right py-2 px-3 font-medium">Sales</th>
                    <th className="text-right py-2 px-3 font-medium">Ops Score</th>
                    <th className="text-right py-2 pl-3 font-medium">VM Score</th>
                  </tr>
                </thead>
                <tbody>
                  {storePerformance.map((s) => (
                    <tr key={s.store} className="border-b border-[#1a1a1a]">
                      <td className="py-2 pr-3">{s.store}</td>
                      <td className="py-2 px-3 text-right">{s.sales ? fmtGHS(s.sales) : '—'}</td>
                      <td className="py-2 px-3 text-right">{s.ops || '—'}</td>
                      <td className="py-2 pl-3 text-right">{s.vm || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="No store data yet" hint="Store sales (Commercial) and audits (Operations) populate this." height={140} />
          )}
        </Section>

        {/* Category performance */}
        <Section number={3} title="Category Performance">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-gray-400 mb-2">Sales by Category</div>
              {categorySales.length ? (
                <SimpleBarChart data={categorySales} height={220} color="#c8a951" prefix="GHS " />
              ) : (
                <EmptyState message="No category sales yet" hint="Add Category Performance in the Commercial form." height={220} />
              )}
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-2">Sell-Through by Category</div>
              {sellThroughByCategory.length ? (
                <SimpleBarChart data={sellThroughByCategory} height={220} color="#22c55e" />
              ) : (
                <EmptyState message="No sell-through data yet" hint="Add Category Performance in the Commercial form." height={220} />
              )}
            </div>
          </div>
        </Section>

        {/* Department snapshot */}
        <Section number={4} title="Departments">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {departments.map((d) => (
              <Link
                key={d.name}
                href={d.href}
                className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-4 hover:border-[#c8a951]/40 transition-colors"
              >
                <div className="text-sm font-semibold text-white">{d.name}</div>
                <div className="text-[0.65rem] text-gray-500 mt-2 uppercase tracking-wider">{d.metric}</div>
                <div className="text-lg font-bold text-[#c8a951] mt-0.5">{d.value}</div>
              </Link>
            ))}
          </div>
        </Section>

        {/* CEO Attention */}
        <Section number={5} title="CEO Attention Index">
          {ceoAttention.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#2a2a2a] text-gray-500">
                    <th className="text-left py-2 pr-3 font-medium">Priority</th>
                    <th className="text-left py-2 px-3 font-medium">Issue</th>
                    <th className="text-left py-2 px-3 font-medium">Impact</th>
                    <th className="text-left py-2 px-3 font-medium">Owner</th>
                    <th className="text-left py-2 pl-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ceoAttention.map((c, i) => (
                    <tr key={i} className="border-b border-[#1a1a1a]">
                      <td className="py-2 pr-3 capitalize">{c.priority || '—'}</td>
                      <td className="py-2 px-3">{c.issue}</td>
                      <td className="py-2 px-3 capitalize">{c.impact || '—'}</td>
                      <td className="py-2 px-3">{c.owner || '—'}</td>
                      <td className="py-2 pl-3 capitalize">{c.status || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="No CEO attention items" hint="Raised via the Brand → CEO Attention Items form." height={120} />
          )}
        </Section>

        {/* Action Tracker (cross-department) */}
        <Section number={6} title="Action Tracker">
          {actionTracker.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#2a2a2a] text-gray-500">
                    <th className="text-left py-2 pr-3 font-medium">Dept</th>
                    <th className="text-left py-2 px-3 font-medium">Task</th>
                    <th className="text-left py-2 px-3 font-medium">Owner</th>
                    <th className="text-left py-2 px-3 font-medium">Priority</th>
                    <th className="text-left py-2 pl-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {actionTracker.map((a, i) => (
                    <tr key={i} className="border-b border-[#1a1a1a]">
                      <td className="py-2 pr-3 text-[#c8a951]">{a.dept}</td>
                      <td className="py-2 px-3">{a.task}</td>
                      <td className="py-2 px-3">{a.owner || '—'}</td>
                      <td className="py-2 px-3 capitalize">{a.priority || '—'}</td>
                      <td className="py-2 pl-3 capitalize">{a.status || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="No actions yet" hint="From Marketing → Action Tracker and Operations → Maintenance." height={120} />
          )}
        </Section>
      </div>
    </div>
  );
}
