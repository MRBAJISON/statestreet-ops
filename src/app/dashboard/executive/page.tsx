'use client';

import Link from 'next/link';
import DashboardHeader from '@/components/layout/DashboardHeader';
import KPICard from '@/components/ui/KPICard';
import { Bento, Panel } from '@/components/ui/Bento';
import EmptyState from '@/components/ui/EmptyState';
import { ShowMoreRows, ShowMoreGrid } from '@/components/ui/ShowMore';
import { SimpleDonutChart, SimpleBarChart, SimpleLineChart } from '@/components/charts/Charts';
import { useState } from 'react';
import PeriodTabs from '@/components/ui/PeriodTabs';
import { useMetrics, useEntries, type Period } from '@/lib/api';
import { rateRatio } from '@/lib/config';
import { useOrg } from '@/components/providers/OrgProvider';
import { toLabelMap, brandOfStore } from '@/lib/org';
import { TARGETS } from '@/lib/targets';
import BrandedLoader from '@/components/ui/BrandedLoader';


const fmtGHS = (n: number) =>
  n >= 1_000_000
    ? `GHS ${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
    ? `GHS ${(n / 1_000).toFixed(0)}K`
    : `GHS ${Math.round(n).toLocaleString()}`;
const dash = (n: number, f: (x: number) => string) => (n ? f(n) : '—');
const pct = (n: number) => (n ? `${n}%` : '—');
const money = (n: number) => `GHS ${Math.round(n).toLocaleString()}`;

// Command-center chart palette (gold / violet / teal / blue / pink …). Gated to this
// page so other dashboards keep their current colors until they're converted.
const CC = ['#e8c75a', '#a78bfa', '#2dd4bf', '#5b9dff', '#f472b6', '#34d399', '#f59e0b', '#fb7185'];

const cardCls = 'panel-surface bg-[var(--c-card)] border border-[var(--c-border)] rounded-xl p-3 flex flex-col';
const headCls = 'flex items-center gap-2 mb-1.5';
const iconCls = 'text-base leading-none';
const labelCls = 'text-[0.6rem] text-gray-500 uppercase tracking-wider leading-tight';
const valueCls = 'text-lg font-bold text-[var(--c-fg)]';

// Money KPI vs target, with a gold progress bar + % of target (matches the reference cards).
function KpiProgress({ icon, label, value, target }: { icon: string; label: string; value: number; target: number }) {
  const ratio = target > 0 ? (value / target) * 100 : 0;
  return (
    <div className={cardCls}>
      <div className={headCls}><span className={iconCls}>{icon}</span><span className={labelCls}>{label}</span></div>
      <div className={valueCls}>{value ? money(value) : '—'}</div>
      <div className="text-[0.6rem] text-gray-500 mt-1">Target: {target ? money(target) : '—'}</div>
      <div className="mt-1 h-1.5 rounded-full bg-[var(--c-hover)] overflow-hidden">
        <div className="h-full bg-[#c8a951] rounded-full" style={{ width: `${Math.min(100, Math.max(0, ratio))}%` }} />
      </div>
      <div className="text-[0.6rem] text-[#c8a951] font-semibold mt-0.5 text-right">{target ? `${ratio.toFixed(1)}%` : ''}</div>
    </div>
  );
}

// Percentage KPI vs target, with the gap shown in percentage points.
function KpiDelta({ icon, label, value, target }: { icon: string; label: string; value: number; target: number }) {
  const delta = Math.round((value - target) * 10) / 10;
  return (
    <div className={cardCls}>
      <div className={headCls}><span className={iconCls}>{icon}</span><span className={labelCls}>{label}</span></div>
      <div className={valueCls}>{value ? `${value}%` : '—'}</div>
      <div className="text-[0.6rem] text-gray-500 mt-1">Target: {target ? `${target}%` : '—'}</div>
      <div className={`text-[0.6rem] font-semibold mt-0.5 ${delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>{value ? `${delta >= 0 ? '+' : ''}${delta}pp` : ''}</div>
    </div>
  );
}

// Count KPI with two supporting stats.
function KpiStat({ icon, label, value, sub1, sub2 }: { icon: string; label: string; value: string; sub1: string; sub2: string }) {
  return (
    <div className={cardCls}>
      <div className={headCls}><span className={iconCls}>{icon}</span><span className={labelCls}>{label}</span></div>
      <div className={valueCls}>{value}</div>
      <div className="text-[0.6rem] text-gray-500 mt-1">{sub1}</div>
      <div className="text-[0.6rem] text-gray-400 mt-0.5">{sub2}</div>
    </div>
  );
}

export default function ExecutiveCommandCenter() {
  const [period, setPeriod] = useState<Period>('mtd');
  const [anchor, setAnchor] = useState('');
  const [store, setStore] = useState('');
  const { org } = useOrg();
  const retailStoreCount = org.stores.filter((s) => s.value !== 'head-office').length;
  const finQ = useMetrics<{ revenueMtd: number; netProfit: number; grossProfit: number; operatingProfit: number; grossMargin: number; cashNet: number; netMargin: number; roce: number; roi: number; revenueByCategory: { name: string; value: number }[]; daily: number[]; labels: string[]; paymentsByMode: { name: string; value: number }[] }>('finance', period, anchor, store);
  const fin = finQ.data;
  const com = useMetrics<{ groupSales: number; convRate: number; sellThrough: number; salesByStore: { name: string; value: number }[]; categorySales: { name: string; value: number }[]; sellThroughByCategory: { name: string; value: number }[]; weeklyReview: { count: number; stockAtRisk: number; atRiskCategories: number; latest: { store: string; weekEnd: string; manager: string; achievement: number } | null; ceo: Record<string, string> | null; reviews: { id: number; store: string; weekEnd: string; manager: string; achievement: number; stockAtRisk: number; atRiskCategories: number; ceo: Record<string, string> | null; insights: { best: string[]; concern: string[]; risk: string[] } }[] }; managerVoices?: { store: string; manager: string; weekEnd: string; answers: { q: string; a: string }[] }[] }>('commercial', period, anchor, store).data;
  const ops = useMetrics<{ opsScore: number; openIssues: number; storeScores: { store: string; ops: number; vm: number; readiness: number; cx: number }[]; priorityActions: { description: string; priority: string; owner: string; store: string; status: string }[]; peopleHealth: { score: number; attendance: number; punctuality: number; training: number; absences: number; count: number }; staffing: { total: number; onDuty: number; absent: number } }>('operations', period, anchor, store).data;
  const inv = useMetrics<{ inventoryValue: number; accuracy: number }>('inventory', period, anchor, store).data;
  const brd = useMetrics<{ healthIndex: number; sentiment: { positive: number }; ceoAttention: { priority: string; issue: string; impact: string; owner: string; status: string }[] }>('brand', period, anchor, store).data;
  const mkt = useMetrics<{ totalLeads: number; actions: { task: string; owner: string; priority: string; status: string; deadline: string }[] }>('marketing', period, anchor, store).data;

  // Live executive targets: monthly KPIs for the anchor month + annual sell-through
  // for the anchor year, set on the Targets page. Falls back to config defaults.
  const { entries: comEntries } = useEntries('commercial', 5000);
  const anchorDate = anchor ? new Date(anchor) : new Date();
  const anchorMonth = `${anchorDate.getFullYear()}-${String(anchorDate.getMonth() + 1).padStart(2, '0')}`;
  const anchorYear = String(anchorDate.getFullYear());
  const tNum = (v: unknown) => Number(String(v ?? '').replace(/[, ]/g, '')) || 0;
  const monthlyTargetRec = comEntries.find((e) => e.formType === 'exec-target' && String(e.payload.month) === anchorMonth);
  const annualTargetRec = comEntries.find((e) => e.formType === 'exec-target-annual' && String(e.payload.year) === anchorYear);
  const T = {
    revenueMtd: tNum(monthlyTargetRec?.payload.revenueMtd) || TARGETS.executive.revenueMtd,
    grossProfit: tNum(monthlyTargetRec?.payload.grossProfit) || TARGETS.executive.grossProfit,
    operatingProfit: tNum(monthlyTargetRec?.payload.operatingProfit) || TARGETS.executive.operatingProfit,
    grossMargin: tNum(monthlyTargetRec?.payload.grossMargin) || TARGETS.executive.grossMargin,
    sellThrough: tNum(annualTargetRec?.payload.sellThrough) || TARGETS.executive.sellThrough,
  };

  const revenueByCategory = fin?.revenueByCategory ?? [];
  const salesByStore = com?.salesByStore ?? [];
  const categorySales = com?.categorySales ?? [];
  const sellThroughByCategory = com?.sellThroughByCategory ?? [];
  // Daily revenue trend + payment mix come straight from the finance metrics the
  // page already fetches (no new data layer — just reading more of the response).
  const daily = fin?.daily ?? [];
  const labels = fin?.labels ?? [];
  const dailyData = daily.map((v, i) => ({ name: labels[i] ?? String(i + 1), value: v }));
  const hasDaily = daily.some((v) => v > 0);
  const paymentsByMode = fin?.paymentsByMode ?? [];

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

  // Brand Performance — roll store sales up to brand via the Brand → Stores mapping.
  const storeLabelToValue = new Map(org.stores.map((s) => [s.label, s.value]));
  const brandLabels = toLabelMap(org.brands);
  const brandAgg = new Map<string, number>();
  for (const s of salesByStore) {
    const storeVal = storeLabelToValue.get(s.name) ?? s.name;
    const bv = brandOfStore(org, storeVal);
    const name = bv ? brandLabels[bv] ?? bv : 'Unassigned';
    brandAgg.set(name, (brandAgg.get(name) ?? 0) + s.value);
  }
  const brandPerformance = [...brandAgg].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const ceoAttention = brd?.ceoAttention ?? [];
  const managerVoices = (com?.managerVoices ?? []).slice(0, 12);
  const wr = com?.weeklyReview;
  const wrReviews = wr?.reviews ?? [];
  const [wrWeek, setWrWeek] = useState<number | 'all'>('all');
  const wrSel = typeof wrWeek === 'number' ? wrReviews.find((r) => r.id === wrWeek) : undefined;
  const wrAchievement = wrSel ? wrSel.achievement : wr?.latest?.achievement ?? 0;
  const wrStockAtRisk = wrSel ? wrSel.stockAtRisk : wr?.stockAtRisk ?? 0;
  const wrAtRiskCats = wrSel ? wrSel.atRiskCategories : wr?.atRiskCategories ?? 0;
  const wrHeading = wrSel
    ? `${wrSel.store} · week ending ${wrSel.weekEnd}${wrSel.manager ? ` · ${wrSel.manager}` : ''}`
    : wr?.latest
    ? `Latest · ${wr.latest.store} · week ending ${wr.latest.weekEnd}`
    : undefined;
  // Statement-style insights derived from the selected week (falls back to latest for 'all').
  const wrInsightSrc = wrSel ?? wrReviews[0];
  const wrInsights: { label: string; items: string[] }[] = [
    { label: 'Best performing categories', items: wrInsightSrc?.insights?.best ?? [] },
    { label: 'Categories needing attention', items: wrInsightSrc?.insights?.concern ?? [] },
    { label: 'Greatest commercial / stock risk', items: wrInsightSrc?.insights?.risk ?? [] },
  ];
  // The store manager's judgement answers for the selected week.
  const MANAGER_QUESTIONS = [
    { key: 'q3', text: 'Which category should Marketing amplify this week?' },
    { key: 'q5', text: 'What will you do differently this week to increase sales?' },
    { key: 'q6', text: 'If this store belonged to you, what would be your first three actions?' },
  ];
  const wrAnswers = MANAGER_QUESTIONS.map((q) => ({ q: q.text, a: wrInsightSrc?.ceo?.[q.key] ?? '' })).filter((x) => x.a.trim());

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

  if (finQ.loading && !fin) return <BrandedLoader fullScreen />;

  return (
    <div className="bg-[var(--c-bg)] min-h-screen text-[var(--c-fg)]">
      <DashboardHeader
        title="EXECUTIVE COMMAND CENTER"
        subtitle="ONE VISION. ONE TEAM. ONE DESTINATION."
        mission="Mission"
        missionDetail="Build Ghana's most trusted premium retail group."
      />

      {/* GROUP KPI BAR */}
      <div className="px-6 pt-4 flex justify-end">
        <PeriodTabs value={period} date={anchor} onChange={setPeriod} onDateChange={setAnchor} store={store} stores={org.stores} onStoreChange={setStore} />
      </div>
      <div className="px-6 py-3">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <KpiProgress icon="💰" label="Group Revenue (MTD)" value={fin?.revenueMtd ?? 0} target={T.revenueMtd} />
          <KpiProgress icon="🪙" label="Gross Profit (MTD)" value={fin?.grossProfit ?? 0} target={T.grossProfit} />
          <KpiProgress icon="📈" label="Operating Profit (MTD)" value={fin?.operatingProfit ?? 0} target={T.operatingProfit} />
          <KpiDelta icon="🧮" label="Group GM% (MTD)" value={fin?.grossMargin ?? 0} target={T.grossMargin} />
          <KpiDelta icon="🛒" label="Group Sell Through (YTD)" value={com?.sellThrough ?? 0} target={T.sellThrough} />
          <KpiStat icon="🏬" label="Active Stores" value={String(retailStoreCount)} sub1="Total Stores" sub2={`Open: ${retailStoreCount}   Closed: 0`} />
          <KpiStat icon="👥" label="Total Employees" value={(ops?.staffing?.total ?? 0) ? String(ops?.staffing?.total) : '—'}
            sub1={(ops?.staffing?.total ?? 0) ? `On Duty: ${ops?.staffing?.onDuty ?? 0}` : 'No HR data'}
            sub2={(ops?.staffing?.total ?? 0) ? `Absent: ${ops?.staffing?.absent ?? 0}` : ''} />
        </div>
      </div>

      <div className="px-6 pb-8">
        <Bento>
          {/* Revenue trend + revenue by category */}
          <Panel span={8} number={1} title="Group Revenue & Margin Trend" meta="Daily net revenue · recent">
            {hasDaily ? (
              <SimpleLineChart data={dailyData} height={230} color="#e8c75a" area prefix="GHS " />
            ) : (
              <EmptyState message="No daily revenue yet" hint="Add revenue entries in the Finance form." height={230} />
            )}
          </Panel>
          <Panel span={4} title="Revenue by Category" meta="Share of group revenue">
            {revenueByCategory.length ? (
              <>
                <SimpleDonutChart data={revenueByCategory} height={210} innerRadius={58} outerRadius={82} centerLabel="Total" centerValue={fmtGHS(fin?.revenueMtd ?? 0)} colors={CC} />
                <ShowMoreGrid items={revenueByCategory} limit={7} wrapClass="grid grid-cols-2 gap-x-3 gap-y-1 mt-2">
                  {(b, i) => (
                    <div key={b.name} className="flex items-center gap-1.5 text-xs">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CC[i % CC.length] }} />
                      <span className="text-gray-400 truncate">{b.name}</span>
                      <span className="text-[var(--c-fg)] ml-auto">{fmtGHS(b.value)}</span>
                    </div>
                  )}
                </ShowMoreGrid>
              </>
            ) : (
              <EmptyState message="No revenue yet" hint="Add revenue entries in the Finance form." height={200} />
            )}
          </Panel>

          {/* Sales by store / brand / payment mix */}
          <Panel span={4} title="Sales by Store" meta="Net sales · GHS">
            {salesByStore.length ? (
              <SimpleBarChart data={salesByStore} height={220} color="#e8c75a" prefix="GHS " />
            ) : (
              <EmptyState message="No store sales yet" hint="Add Daily Store Sales in the Commercial form." height={220} />
            )}
          </Panel>
          <Panel span={4} title="Brand Performance" meta="Sales rolled up by brand">
            {brandPerformance.length ? (
              <SimpleBarChart data={brandPerformance} height={220} color="#a78bfa" horizontal prefix="GHS " />
            ) : (
              <EmptyState message="No brand sales yet" hint="Set Brand → Stores in Settings so store sales roll up." height={200} />
            )}
          </Panel>
          <Panel span={4} title="Payment Mix" meta="How customers pay">
            {paymentsByMode.length ? (
              <SimpleDonutChart data={paymentsByMode} height={210} innerRadius={58} outerRadius={82} colors={CC} />
            ) : (
              <EmptyState message="No payment data yet" hint="Captured via store Daily Closing reports." height={200} />
            )}
          </Panel>

          {/* Category performance */}
          <Panel span={6} number={3} title="Sales by Category" meta="Top categories · GHS">
            {categorySales.length ? (
              <SimpleBarChart data={categorySales} height={220} color="#e8c75a" prefix="GHS " />
            ) : (
              <EmptyState message="No category sales yet" hint="Add Category Performance in the Commercial form." height={220} />
            )}
          </Panel>
          <Panel span={6} title="Sell-Through by Category" meta="% of received stock sold">
            {sellThroughByCategory.length ? (
              <SimpleBarChart data={sellThroughByCategory} height={220} color="#2dd4bf" />
            ) : (
              <EmptyState message="No sell-through data yet" hint="Add Category Performance in the Commercial form." height={220} />
            )}
          </Panel>

          {/* Store performance + people health */}
          <Panel span={8} number={2} title="Store Performance" meta="Sales + audit scores · this period">
            {storePerformance.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--c-border)] text-gray-500">
                      <th className="text-left py-2 pr-1.5 font-medium">Store</th>
                      <th className="text-right py-2 px-1.5 font-medium">Sales</th>
                      <th className="text-right py-2 px-1.5 font-medium">Ops</th>
                      <th className="text-right py-2 pl-1.5 font-medium">VM</th>
                    </tr>
                  </thead>
                  <tbody>
                    <ShowMoreRows items={storePerformance} limit={7} colSpan={4}>
                      {(s) => (
                        <tr key={s.store} className="border-b border-[var(--c-hover)]">
                          <td className="py-2 pr-1.5 max-w-[10rem] truncate" title={s.store}>{s.store}</td>
                          <td className="py-2 px-1.5 text-right">{s.sales ? fmtGHS(s.sales) : '—'}</td>
                          <td className="py-2 px-1.5 text-right">{s.ops || '—'}</td>
                          <td className="py-2 pl-1.5 text-right">{s.vm || '—'}</td>
                        </tr>
                      )}
                    </ShowMoreRows>
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState message="No store data yet" hint="Store sales (Commercial) and audits (Operations) populate this." height={140} />
            )}
          </Panel>
          <Panel span={4} title="People Health" meta="Operations · HR">
            {(ops?.peopleHealth?.count ?? 0) > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                <KPICard label="Overall Score" value={pct(ops?.peopleHealth?.score ?? 0)} status={(ops?.peopleHealth?.score ?? 0) >= 90 ? 'green' : (ops?.peopleHealth?.score ?? 0) >= 70 ? 'yellow' : 'red'} small />
                <KPICard label="Attendance" value={pct(ops?.peopleHealth?.attendance ?? 0)} small />
                <KPICard label="Punctuality" value={pct(ops?.peopleHealth?.punctuality ?? 0)} small />
                <KPICard label="Training" value={pct(ops?.peopleHealth?.training ?? 0)} small />
                <KPICard label="Absences" value={(ops?.peopleHealth?.absences ?? 0) ? String(ops?.peopleHealth?.absences) : '—'} small />
              </div>
            ) : (
              <EmptyState message="No people-health data yet" hint="Captured via Operations → Human Resources." height={120} />
            )}
          </Panel>

          {/* Departments + profitability ratios */}
          <Panel span={8} number={4} title="Departments" meta="Jump to any department dashboard">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {departments.map((d) => (
                <Link
                  key={d.name}
                  href={d.href}
                  className="bg-[var(--c-card2)] border border-[var(--c-border)] rounded-lg p-4 hover:border-[#c8a951]/40 transition-colors"
                >
                  <div className="text-sm font-semibold text-[var(--c-fg)]">{d.name}</div>
                  <div className="text-[0.65rem] text-gray-500 mt-2 uppercase tracking-wider">{d.metric}</div>
                  <div className="text-lg font-bold text-[#c8a951] mt-0.5">{d.value}</div>
                </Link>
              ))}
            </div>
          </Panel>
          <Panel span={4} title="Profitability Ratios" meta="Rated · best on Year / All">
            <div className="grid grid-cols-1 gap-3">
              {([
                { name: 'Net Profit Margin', kind: 'netMargin' as const, value: fin?.netMargin ?? 0 },
                { name: 'ROCE', kind: 'roce' as const, value: fin?.roce ?? 0 },
                { name: 'ROI', kind: 'roi' as const, value: fin?.roi ?? 0 },
              ]).map((r) => {
                const rating = rateRatio(r.kind, r.value);
                const tone = rating.tone === 'green' ? 'text-green-400' : rating.tone === 'yellow' ? 'text-yellow-400' : 'text-red-400';
                return (
                  <div key={r.kind} className="bg-[var(--c-card2)] border border-[var(--c-border)] rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="text-[0.65rem] text-gray-500 uppercase tracking-wider">{r.name}</div>
                      <div className={`text-xs font-semibold mt-0.5 ${tone}`}>{r.value ? rating.label : 'No data'}</div>
                    </div>
                    <div className="text-2xl font-bold">{r.value ? `${r.value}%` : '—'}</div>
                  </div>
                );
              })}
            </div>
          </Panel>

          {/* CEO Attention */}
          <Panel span={12} number={5} title="CEO Attention Index" meta="Issues escalated for the CEO">
            {ceoAttention.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--c-border)] text-gray-500">
                      <th className="text-left py-2 pr-3 font-medium">Priority</th>
                      <th className="text-left py-2 px-3 font-medium">Issue</th>
                      <th className="text-left py-2 px-3 font-medium">Impact</th>
                      <th className="text-left py-2 px-3 font-medium">Owner</th>
                      <th className="text-left py-2 pl-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <ShowMoreRows items={ceoAttention} limit={7} colSpan={5}>
                      {(c, i) => (
                      <tr key={i} className="border-b border-[var(--c-hover)]">
                        <td className="py-2 pr-3 capitalize">{c.priority || '—'}</td>
                        <td className="py-2 px-3">{c.issue}</td>
                        <td className="py-2 px-3 capitalize">{c.impact || '—'}</td>
                        <td className="py-2 px-3">{c.owner || '—'}</td>
                        <td className="py-2 pl-3 capitalize">{c.status || '—'}</td>
                      </tr>
                      )}
                    </ShowMoreRows>
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState message="No CEO attention items" hint="Raised via the Brand → CEO Attention Items form." height={120} />
            )}
          </Panel>

          {/* Action Tracker (cross-department) */}
          <Panel span={12} number={7} title="Action Tracker" meta="Cross-department · Marketing + Operations">
            {actionTracker.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--c-border)] text-gray-500">
                      <th className="text-left py-2 pr-3 font-medium">Dept</th>
                      <th className="text-left py-2 px-3 font-medium">Task</th>
                      <th className="text-left py-2 px-3 font-medium">Owner</th>
                      <th className="text-left py-2 px-3 font-medium">Priority</th>
                      <th className="text-left py-2 pl-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <ShowMoreRows items={actionTracker} limit={7} colSpan={5}>
                      {(a, i) => (
                      <tr key={i} className="border-b border-[var(--c-hover)]">
                        <td className="py-2 pr-3 text-[#c8a951]">{a.dept}</td>
                        <td className="py-2 px-3">{a.task}</td>
                        <td className="py-2 px-3">{a.owner || '—'}</td>
                        <td className="py-2 px-3 capitalize">{a.priority || '—'}</td>
                        <td className="py-2 pl-3 capitalize">{a.status || '—'}</td>
                      </tr>
                      )}
                    </ShowMoreRows>
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState message="No actions yet" hint="From Marketing → Action Tracker and Operations → Maintenance." height={120} />
            )}
          </Panel>

          {/* Manager Voices (latest strategic answers per store) */}
          <Panel span={12} number={6} title="Manager Voices" meta="Latest strategic answers from store managers">
            {managerVoices.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {managerVoices.map((v, i) => (
                  <div key={`${v.store}-${i}`} className="bg-[var(--c-card2)] border border-[var(--c-border)] rounded-lg p-3 flex flex-col">
                    <div className="text-sm font-semibold text-[var(--c-fg)]">{v.store}</div>
                    <div className="text-[0.65rem] text-gray-500 mt-0.5">{v.manager || '—'}{v.weekEnd ? ` · week ending ${v.weekEnd}` : ''}</div>
                    {v.answers.length ? (
                      <div className="mt-2 space-y-2">
                        {v.answers.map((x, j) => (
                          <div key={j}>
                            <div className="text-[0.65rem] text-[#c8a951]">{x.q}</div>
                            <div className="text-xs text-gray-200 whitespace-pre-wrap">{x.a || '—'}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-600 mt-2">No answers</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState message="No manager voices yet" hint="Store managers submit these via Commercial → Weekly Review." height={120} />
            )}
          </Panel>

          {/* Store Manager CEO Answers (from selected Weekly Review) */}
          <Panel span={12} number={8} title="Store Manager — Key Insights" meta={wrHeading}>
            {wr && wr.count > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {/* Week history list */}
                <div className="lg:col-span-1">
                  <div className="text-xs text-gray-400 mb-2">History</div>
                  <div className="space-y-1 max-h-[360px] overflow-y-auto pr-1">
                    <button
                      onClick={() => setWrWeek('all')}
                      className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-colors ${wrWeek === 'all' ? 'bg-[#c8a951] text-black border-[#c8a951] font-semibold' : 'bg-[var(--c-card2)] border-[var(--c-border)] text-gray-300 hover:border-[#c8a951]'}`}
                    >
                      <div>Latest / All</div>
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

                {/* CEO answers for the selected week */}
                <div className="lg:col-span-3 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <KPICard label="Weekly Reviews" value={String(wr.count)} small />
                    <KPICard label="Achievement" value={wrAchievement ? `${wrAchievement}%` : '—'} small />
                    <KPICard label="Stock at Risk" value={dash(wrStockAtRisk, fmtGHS)} small />
                    <KPICard label="At-Risk Categories" value={wrAtRiskCats ? String(wrAtRiskCats) : '—'} small />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {wrInsights.map((ins) => (
                      <div key={ins.label} className="bg-[var(--c-card2)] border border-[var(--c-border)] rounded-lg p-3">
                        <div className="text-xs text-[#c8a951] font-semibold mb-2">{ins.label}</div>
                        {ins.items.length ? (
                          <ul className="space-y-1">
                            {ins.items.map((name) => (
                              <li key={name} className="text-sm text-gray-200">{name}</li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-sm text-gray-600">—</div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Store manager's judgement answers */}
                  {wrAnswers.length > 0 && (
                    <div className="space-y-3">
                      <div className="text-xs text-gray-400 uppercase tracking-wide">Manager&apos;s Plan</div>
                      {wrAnswers.map((x, i) => (
                        <div key={i} className="bg-[var(--c-card2)] border border-[var(--c-border)] rounded-lg p-3">
                          <div className="text-xs text-[#c8a951] mb-1">{x.q}</div>
                          <div className="text-sm text-gray-200 whitespace-pre-wrap">{x.a}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <EmptyState message="No weekly reviews yet" hint="Store managers submit these via Commercial → Weekly Review." height={120} />
            )}
          </Panel>
        </Bento>
      </div>
    </div>
  );
}
