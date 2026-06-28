'use client';

import Link from 'next/link';
import DashboardHeader from '@/components/layout/DashboardHeader';
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

// Command-center category/series palette (matches the prototype).
const CC = ['#e8c75a', '#a78bfa', '#2dd4bf', '#5b9dff', '#f472b6', '#f59e0b', '#34d399', '#475569'];

// Priority chip colours (text, background) — from the prototype's PRI map.
const PRIO: Record<string, [string, string]> = {
  high: ['#f87171', 'rgba(248,113,113,.12)'],
  medium: ['#e8c75a', 'rgba(232,199,90,.12)'],
  low: ['#5b9dff', 'rgba(91,157,255,.12)'],
};
const prioStyle = (p: string): [string, string] => PRIO[String(p).toLowerCase()] ?? ['#9aa6be', 'rgba(148,163,184,.12)'];

// Operations-feed icon + tint per department.
const FEED_ICON: Record<string, [string, string]> = {
  operations: ['⚠️', 'rgba(248,113,113,.12)'],
  commercial: ['📥', 'rgba(91,157,255,.12)'],
  finance: ['🧾', 'rgba(167,139,250,.12)'],
  brand: ['🎯', 'rgba(52,211,153,.12)'],
  inventory: ['📦', 'rgba(232,199,90,.12)'],
  marketing: ['📣', 'rgba(244,114,182,.12)'],
};
const humanize = (s: string) => s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const relTime = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime();
  if (!isFinite(ms) || ms < 0) return '';
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};

// KPI cards (command-center styling). Money vs target with a gold progress bar.
function KpiProgress({ icon, label, value, target }: { icon: string; label: string; value: number; target: number }) {
  const ratio = target > 0 ? (value / target) * 100 : 0;
  return (
    <div className="cc-kpi">
      <div className="lbl"><span className="ic">{icon}</span>{label}</div>
      <div className="val">{value ? money(value) : '—'}</div>
      <div className="sub2">Target: {target ? money(target) : '—'}</div>
      <div className="pbar"><i style={{ width: `${Math.min(100, Math.max(0, ratio))}%` }} /></div>
      <div className="pct">{target ? `${ratio.toFixed(1)}%` : ''}</div>
    </div>
  );
}

// Percentage KPI vs target, gap shown in percentage points.
function KpiDelta({ icon, label, value, target }: { icon: string; label: string; value: number; target: number }) {
  const delta = Math.round((value - target) * 10) / 10;
  return (
    <div className="cc-kpi">
      <div className="lbl"><span className="ic">{icon}</span>{label}</div>
      <div className="val">{value ? `${value}%` : '—'}</div>
      {value ? (
        <div className="sub"><span className={`chip ${delta >= 0 ? 'up' : 'down'}`}>{delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}pp</span></div>
      ) : null}
      <div className="sub2">Target: {target ? `${target}%` : '—'}</div>
    </div>
  );
}

// Count KPI with two supporting stats.
function KpiStat({ icon, label, value, sub1, sub2 }: { icon: string; label: string; value: string; sub1: string; sub2: string }) {
  return (
    <div className="cc-kpi">
      <div className="lbl"><span className="ic">{icon}</span>{label}</div>
      <div className="val">{value}</div>
      <div className="sub2">{sub1}</div>
      {sub2 ? <div className="sub2">{sub2}</div> : null}
    </div>
  );
}

export default function ExecutiveCommandCenter() {
  const [period, setPeriod] = useState<Period>('mtd');
  const [anchor, setAnchor] = useState('');
  const [store, setStore] = useState('');
  const { org } = useOrg();
  const retailStoreCount = org.stores.filter((s) => s.value !== 'head-office').length;
  const finQ = useMetrics<{ revenueMtd: number; netProfit: number; grossProfit: number; operatingProfit: number; grossMargin: number; cashNet: number; netMargin: number; roce: number; roi: number; revenueByCategory: { name: string; value: number }[]; daily: number[]; dailyGP: number[]; labels: string[]; paymentsByMode: { name: string; value: number }[] }>('finance', period, anchor, store);
  const fin = finQ.data;
  const com = useMetrics<{ groupSales: number; convRate: number; sellThrough: number; salesByStore: { name: string; value: number }[]; categorySales: { name: string; value: number }[]; sellThroughByCategory: { name: string; value: number }[]; weeklyReview: { count: number; stockAtRisk: number; atRiskCategories: number; latest: { store: string; weekEnd: string; manager: string; achievement: number } | null; ceo: Record<string, string> | null; reviews: { id: number; store: string; weekEnd: string; manager: string; achievement: number; stockAtRisk: number; atRiskCategories: number; ceo: Record<string, string> | null; insights: { best: string[]; concern: string[]; risk: string[] } }[] }; managerVoices?: { store: string; manager: string; weekEnd: string; answers: { q: string; a: string }[] }[] }>('commercial', period, anchor, store).data;
  const ops = useMetrics<{ opsScore: number; openIssues: number; storeScores: { store: string; ops: number; vm: number; readiness: number; cx: number }[]; priorityActions: { description: string; priority: string; owner: string; store: string; status: string }[]; peopleHealth: { score: number; attendance: number; punctuality: number; training: number; absences: number; count: number }; staffing: { total: number; onDuty: number; absent: number } }>('operations', period, anchor, store).data;
  const inv = useMetrics<{ inventoryValue: number; accuracy: number }>('inventory', period, anchor, store).data;
  const brd = useMetrics<{ healthIndex: number; sentiment: { positive: number }; ceoAttention: { priority: string; issue: string; impact: string; owner: string; status: string }[] }>('brand', period, anchor, store).data;
  const mkt = useMetrics<{ totalLeads: number; actions: { task: string; owner: string; priority: string; status: string; deadline: string }[] }>('marketing', period, anchor, store).data;

  // Live executive targets: monthly KPIs for the anchor month + annual sell-through
  // for the anchor year, set on the Targets page. Falls back to config defaults.
  const { entries: comEntries } = useEntries('commercial', 5000);
  // Recent entries across departments power the live Operations Feed.
  const { entries: opsEnt } = useEntries('operations', 6);
  const { entries: invEnt } = useEntries('inventory', 6);
  const { entries: brdEnt } = useEntries('brand', 6);
  const { entries: finEnt } = useEntries('finance', 6);
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
  // Daily revenue + gross-profit trend, and payment mix — all from the finance
  // metrics the page already fetches (no new data layer).
  const daily = fin?.daily ?? [];
  const dailyGP = fin?.dailyGP ?? [];
  const labels = fin?.labels ?? [];
  const dailyData = daily.map((v, i) => ({ name: labels[i] ?? String(i + 1), value: v, value2: dailyGP[i] ?? 0 }));
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

  // Brand rollup via the Brand → Stores mapping (drives Brand Performance + the store table's brand chip).
  const storeLabelToValue = new Map(org.stores.map((s) => [s.label, s.value]));
  const storeValueToLabel = (v: string) => org.stores.find((s) => s.value === v)?.label ?? v;
  const brandLabels = toLabelMap(org.brands);
  const brandForStore = (storeNameLabel: string) => {
    const v = storeLabelToValue.get(storeNameLabel) ?? storeNameLabel;
    const bv = brandOfStore(org, v);
    return bv ? brandLabels[bv] ?? bv : '';
  };
  const brandAgg = new Map<string, number>();
  for (const s of salesByStore) {
    const name = brandForStore(s.name) || 'Unassigned';
    brandAgg.set(name, (brandAgg.get(name) ?? 0) + s.value);
  }
  const brandPerformance = [...brandAgg].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const ceoAttention = brd?.ceoAttention ?? [];
  const managerVoices = (com?.managerVoices ?? []).slice(0, 12);

  // Live Operations Feed: newest entries across departments, formatted as alerts.
  const feed = [...opsEnt, ...invEnt, ...brdEnt, ...finEnt, ...comEntries.slice(0, 6)]
    .filter((e) => e.createdAt)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 9)
    .map((e) => {
      const [ic, bg] = FEED_ICON[e.department] ?? ['•', 'rgba(148,163,184,.12)'];
      const store = e.payload?.store ? storeValueToLabel(String(e.payload.store)) : '';
      return { id: `${e.department}-${e.id}`, ic, bg, title: humanize(String(e.formType)), sub: [cap(e.department), store].filter(Boolean).join(' · '), at: relTime(e.createdAt) };
    });

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

  const peopleTiles: [string, string][] = [
    ['Overall Score', pct(ops?.peopleHealth?.score ?? 0)],
    ['Attendance', pct(ops?.peopleHealth?.attendance ?? 0)],
    ['Punctuality', pct(ops?.peopleHealth?.punctuality ?? 0)],
    ['Training', pct(ops?.peopleHealth?.training ?? 0)],
    ['Absences', (ops?.peopleHealth?.absences ?? 0) ? String(ops?.peopleHealth?.absences) : '—'],
  ];

  if (finQ.loading && !fin) return <BrandedLoader fullScreen />;

  return (
    <div className="min-h-screen text-[var(--c-fg)]" style={{ background: '#0a0c12' }}>
      <DashboardHeader
        title="EXECUTIVE COMMAND CENTER"
        subtitle="ONE VISION. ONE TEAM. ONE DESTINATION."
        mission="Mission"
        missionDetail="Build Ghana's most trusted premium retail group."
      />

      <div className="cc px-6 pb-10 pt-3">
        <div className="flex justify-end mb-3">
          <PeriodTabs value={period} date={anchor} onChange={setPeriod} onDateChange={setAnchor} store={store} stores={org.stores} onStoreChange={setStore} />
        </div>

        {/* GROUP KPI BAR */}
        <div className="cc-kpis mb-[18px]">
          <KpiProgress icon="💰" label="Group Revenue (MTD)" value={fin?.revenueMtd ?? 0} target={T.revenueMtd} />
          <KpiProgress icon="🪙" label="Gross Profit (MTD)" value={fin?.grossProfit ?? 0} target={T.grossProfit} />
          <KpiProgress icon="📈" label="Operating Profit (MTD)" value={fin?.operatingProfit ?? 0} target={T.operatingProfit} />
          <KpiDelta icon="🧮" label="Group GM% (MTD)" value={fin?.grossMargin ?? 0} target={T.grossMargin} />
          <KpiDelta icon="🛒" label="Sell-Through (YTD)" value={com?.sellThrough ?? 0} target={T.sellThrough} />
          <KpiStat icon="🏬" label="Active Stores" value={String(retailStoreCount)} sub1={`Total Stores: ${retailStoreCount}`} sub2={`Open: ${retailStoreCount} · Closed: 0`} />
          <KpiStat icon="👥" label="Total Employees" value={(ops?.staffing?.total ?? 0) ? String(ops?.staffing?.total) : '—'}
            sub1={(ops?.staffing?.total ?? 0) ? `On Duty: ${ops?.staffing?.onDuty ?? 0}` : 'No HR data'}
            sub2={(ops?.staffing?.total ?? 0) ? `Absent: ${ops?.staffing?.absent ?? 0}` : ''} />
        </div>

        <div className="cc-bento">
          {/* Trend + revenue by category */}
          <div className="cc-panel c8">
            <div className="phead"><div><h3><span className="num">1</span>Group Revenue &amp; Margin Trend</h3><div className="meta">Daily net revenue vs gross profit · this period</div></div></div>
            {hasDaily ? (
              <>
                <SimpleLineChart data={dailyData} height={250} color="#e8c75a" color2="#2dd4bf" area prefix="GHS " />
                <div className="cc-legend">
                  <span><i style={{ background: '#e8c75a' }} />Net Revenue</span>
                  <span><i style={{ background: '#2dd4bf' }} />Gross Profit</span>
                </div>
              </>
            ) : (
              <EmptyState message="No daily revenue yet" hint="Add revenue entries in the Finance form." height={250} />
            )}
          </div>
          <div className="cc-panel c4">
            <div className="phead"><div><h3>Revenue by Category</h3><div className="meta">Share of group revenue</div></div></div>
            {revenueByCategory.length ? (
              <>
                <SimpleDonutChart data={revenueByCategory} height={210} innerRadius={62} outerRadius={84} centerLabel="Total" centerValue={fmtGHS(fin?.revenueMtd ?? 0)} colors={CC} />
                <ShowMoreGrid items={revenueByCategory} limit={6} wrapClass="cc-legend">
                  {(b, i) => (
                    <span key={b.name}><i style={{ background: CC[i % CC.length] }} />{b.name} · <b>{fmtGHS(b.value)}</b></span>
                  )}
                </ShowMoreGrid>
              </>
            ) : (
              <EmptyState message="No revenue yet" hint="Add revenue entries in the Finance form." height={200} />
            )}
          </div>

          {/* Sales by store / brand / payment mix */}
          <div className="cc-panel c4">
            <div className="phead"><div><h3>Sales by Store</h3><div className="meta">Net sales · GHS</div></div></div>
            {salesByStore.length ? (
              <SimpleBarChart data={salesByStore} height={210} color="#e8c75a" prefix="GHS " />
            ) : (
              <EmptyState message="No store sales yet" hint="Add Daily Store Sales in the Commercial form." height={210} />
            )}
          </div>
          <div className="cc-panel c4">
            <div className="phead"><div><h3>Brand Performance</h3><div className="meta">Sales rolled up by brand</div></div></div>
            {brandPerformance.length ? (
              <SimpleBarChart data={brandPerformance} height={210} color="#a78bfa" horizontal prefix="GHS " />
            ) : (
              <EmptyState message="No brand sales yet" hint="Set Brand → Stores in Settings so store sales roll up." height={200} />
            )}
          </div>
          <div className="cc-panel c4">
            <div className="phead"><div><h3>Payment Mix</h3><div className="meta">How customers pay</div></div></div>
            {paymentsByMode.length ? (
              <SimpleDonutChart data={paymentsByMode} height={210} innerRadius={56} outerRadius={82} colors={CC} />
            ) : (
              <EmptyState message="No payment data yet" hint="Captured via store Daily Closing reports." height={200} />
            )}
          </div>

          {/* Category performance */}
          <div className="cc-panel c6">
            <div className="phead"><div><h3><span className="num">3</span>Sales by Category</h3><div className="meta">Top categories · GHS</div></div></div>
            {categorySales.length ? (
              <SimpleBarChart data={categorySales} height={220} color="#e8c75a" prefix="GHS " />
            ) : (
              <EmptyState message="No category sales yet" hint="Add Category Performance in the Commercial form." height={220} />
            )}
          </div>
          <div className="cc-panel c6">
            <div className="phead"><div><h3>Sell-Through by Category</h3><div className="meta">% of received stock sold</div></div></div>
            {sellThroughByCategory.length ? (
              <SimpleBarChart data={sellThroughByCategory} height={220} color="#34d399" />
            ) : (
              <EmptyState message="No sell-through data yet" hint="Add Category Performance in the Commercial form." height={220} />
            )}
          </div>

          {/* Store performance + people health */}
          <div className="cc-panel c8">
            <div className="phead"><div><h3><span className="num">2</span>Store Performance</h3><div className="meta">Sales + audit scores · this period</div></div>
              <span className="pill">{storePerformance.length} store{storePerformance.length === 1 ? '' : 's'}</span></div>
            {storePerformance.length ? (
              <table>
                <thead><tr><th>Store</th><th>Brand</th><th>Sales</th><th>Ops</th><th>VM</th></tr></thead>
                <tbody>
                  <ShowMoreRows items={storePerformance} limit={7} colSpan={5}>
                    {(s) => {
                      const brand = brandForStore(s.store);
                      return (
                        <tr key={s.store}>
                          <td><b>{s.store}</b></td>
                          <td>{brand ? <span className="tag cat">{brand}</span> : '—'}</td>
                          <td><b>{s.sales ? fmtGHS(s.sales) : '—'}</b></td>
                          <td>{s.ops || '—'}</td>
                          <td>{s.vm || '—'}</td>
                        </tr>
                      );
                    }}
                  </ShowMoreRows>
                </tbody>
              </table>
            ) : (
              <EmptyState message="No store data yet" hint="Store sales (Commercial) and audits (Operations) populate this." height={140} />
            )}
          </div>
          <div className="cc-panel c4">
            <div className="phead"><div><h3>People Health</h3><div className="meta">Operations · HR</div></div></div>
            {(ops?.peopleHealth?.count ?? 0) > 0 ? (
              <div className="statgrid">
                {peopleTiles.map(([l, v]) => (
                  <div className="stat" key={l}><div className="l">{l}</div><div className="v">{v}</div></div>
                ))}
              </div>
            ) : (
              <EmptyState message="No people-health data yet" hint="Captured via Operations → Human Resources." height={120} />
            )}
          </div>

          {/* Departments + profitability ratios */}
          <div className="cc-panel c8">
            <div className="phead"><div><h3><span className="num">4</span>Departments</h3><div className="meta">Jump to any department dashboard</div></div></div>
            <div className="deptgrid">
              {departments.map((d) => (
                <Link key={d.name} href={d.href} className="deptcard">
                  <b>{d.name}</b>
                  <div className="m">{d.metric}</div>
                  <div className="vv">{d.value}</div>
                </Link>
              ))}
            </div>
          </div>
          <div className="cc-panel c4">
            <div className="phead"><div><h3>Profitability Ratios</h3><div className="meta">Rated · best on Year / All</div></div></div>
            <div className="statgrid" style={{ gridTemplateColumns: '1fr' }}>
              {([
                { name: 'Net Profit Margin', kind: 'netMargin' as const, value: fin?.netMargin ?? 0 },
                { name: 'ROCE', kind: 'roce' as const, value: fin?.roce ?? 0 },
                { name: 'ROI', kind: 'roi' as const, value: fin?.roi ?? 0 },
              ]).map((r) => {
                const rating = rateRatio(r.kind, r.value);
                const tone = rating.tone === 'green' ? '#34d399' : rating.tone === 'yellow' ? '#e8c75a' : '#f87171';
                return (
                  <div className="stat" key={r.kind}>
                    <div className="l">{r.name}</div>
                    <div className="v">{r.value ? `${r.value}%` : '—'}</div>
                    <div className="rt" style={{ color: tone }}>{r.value ? rating.label : 'No data'}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CEO Attention + Operations Feed */}
          <div className="cc-panel c8">
            <div className="phead"><div><h3><span className="num">5</span>CEO Attention Index</h3><div className="meta">Issues escalated for the CEO</div></div></div>
            {ceoAttention.length ? (
              <table>
                <thead><tr><th>Priority</th><th>Issue</th><th>Impact</th><th>Owner</th><th>Status</th></tr></thead>
                <tbody>
                  <ShowMoreRows items={ceoAttention} limit={7} colSpan={5}>
                    {(c, i) => {
                      const [color, background] = prioStyle(c.priority);
                      return (
                        <tr key={i}>
                          <td><span className="prio" style={{ color, background }}>{cap(c.priority) || '—'}</span></td>
                          <td>{c.issue}</td>
                          <td className="capitalize">{c.impact || '—'}</td>
                          <td>{c.owner || '—'}</td>
                          <td className="capitalize">{c.status || '—'}</td>
                        </tr>
                      );
                    }}
                  </ShowMoreRows>
                </tbody>
              </table>
            ) : (
              <EmptyState message="No CEO attention items" hint="Raised via the Brand → CEO Attention Items form." height={120} />
            )}
          </div>
          <div className="cc-panel c4">
            <div className="phead"><div><h3>Operations Feed</h3><div className="meta">Live across the group</div></div></div>
            {feed.length ? (
              <div className="feed">
                {feed.map((f) => (
                  <div className="alert" key={f.id}>
                    <div className="ai" style={{ background: f.bg }}>{f.ic}</div>
                    <div className="ab"><b>{f.title}</b><p>{f.sub}</p></div>
                    <div className="at">{f.at}</div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState message="No recent activity" hint="Department submissions appear here as they come in." height={120} />
            )}
          </div>

          {/* Action Tracker */}
          <div className="cc-panel c12">
            <div className="phead"><div><h3><span className="num">7</span>Action Tracker</h3><div className="meta">Cross-department · Marketing + Operations</div></div></div>
            {actionTracker.length ? (
              <table>
                <thead><tr><th>Dept</th><th>Task</th><th>Owner</th><th>Priority</th><th>Status</th></tr></thead>
                <tbody>
                  <ShowMoreRows items={actionTracker} limit={7} colSpan={5}>
                    {(a, i) => {
                      const [color, background] = prioStyle(a.priority);
                      return (
                        <tr key={i}>
                          <td style={{ color: 'var(--cc-gold2)', fontWeight: 650 }}>{a.dept}</td>
                          <td>{a.task}</td>
                          <td>{a.owner || '—'}</td>
                          <td><span className="prio" style={{ color, background }}>{cap(a.priority) || '—'}</span></td>
                          <td className="capitalize">{a.status || '—'}</td>
                        </tr>
                      );
                    }}
                  </ShowMoreRows>
                </tbody>
              </table>
            ) : (
              <EmptyState message="No actions yet" hint="From Marketing → Action Tracker and Operations → Maintenance." height={120} />
            )}
          </div>

          {/* Manager Voices */}
          <div className="cc-panel c12">
            <div className="phead"><div><h3><span className="num">6</span>Manager Voices</h3><div className="meta">Latest strategic answers from store managers</div></div></div>
            {managerVoices.length ? (
              <div className="voicegrid">
                {managerVoices.map((v, i) => (
                  <div className="voice" key={`${v.store}-${i}`}>
                    <div className="vh"><b>{v.store}</b><small>{v.manager || '—'}{v.weekEnd ? ` · week ending ${v.weekEnd}` : ''}</small></div>
                    {v.answers.length ? v.answers.map((x, j) => (
                      <div className="qa" key={j}><div className="q">{x.q}</div><div className="a">{x.a || '—'}</div></div>
                    )) : <div className="a" style={{ color: 'var(--cc-txt3)' }}>No answers</div>}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState message="No manager voices yet" hint="Store managers submit these via Commercial → Weekly Review." height={120} />
            )}
          </div>

          {/* Store Manager Key Insights */}
          <div className="cc-panel c12">
            <div className="phead"><div><h3><span className="num">8</span>Store Manager — Key Insights</h3><div className="meta">{wrHeading || 'Latest weekly reviews'}</div></div></div>
            {wr && wr.count > 0 ? (
              <>
                <div className="weekrow">
                  <button type="button" className={`weekbtn${wrWeek === 'all' ? ' on' : ''}`} onClick={() => setWrWeek('all')}>Latest / All · {wr.count} review{wr.count === 1 ? '' : 's'}</button>
                  {wrReviews.map((r) => (
                    <button type="button" key={r.id} className={`weekbtn${wrWeek === r.id ? ' on' : ''}`} onClick={() => setWrWeek(r.id)}>
                      Wk ending {r.weekEnd || '—'}{r.achievement ? ` · ${r.achievement}%` : ''}
                    </button>
                  ))}
                </div>
                <div className="statgrid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 14 }}>
                  <div className="stat"><div className="l">Weekly Reviews</div><div className="v">{wr.count}</div></div>
                  <div className="stat"><div className="l">Achievement</div><div className="v">{wrAchievement ? `${wrAchievement}%` : '—'}</div></div>
                  <div className="stat"><div className="l">Stock at Risk</div><div className="v">{dash(wrStockAtRisk, fmtGHS)}</div></div>
                  <div className="stat"><div className="l">At-Risk Categories</div><div className="v">{wrAtRiskCats ? String(wrAtRiskCats) : '—'}</div></div>
                </div>
                <div className="inscol">
                  {wrInsights.map((ins) => (
                    <div className="ins" key={ins.label}>
                      <div className="ih">{ins.label}</div>
                      {ins.items.length ? (
                        <ul>{ins.items.map((name) => <li key={name}>{name}</li>)}</ul>
                      ) : (
                        <div style={{ color: 'var(--cc-txt3)', fontSize: 12.5 }}>—</div>
                      )}
                    </div>
                  ))}
                </div>
                {wrAnswers.length > 0 && (
                  <>
                    <div className="sublabel" style={{ marginTop: 16 }}>Manager&apos;s Plan</div>
                    <div className="planrow">
                      {wrAnswers.map((x, i) => (
                        <div className="plan" key={i}><div className="q">{x.q}</div><div className="a">{x.a}</div></div>
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <EmptyState message="No weekly reviews yet" hint="Store managers submit these via Commercial → Weekly Review." height={120} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
