'use client';

import { useState } from 'react';
import DashboardHeader from '@/components/layout/DashboardHeader';
import KPICard from '@/components/ui/KPICard';
import Section from '@/components/ui/Section';
import ProgressBar from '@/components/ui/ProgressBar';
import EmptyState from '@/components/ui/EmptyState';
import RecentEntries from '@/components/ui/RecentEntries';
import PeriodTabs from '@/components/ui/PeriodTabs';
import { SimpleLineChart, SimpleBarChart, SimpleDonutChart } from '@/components/charts/Charts';
import { useMetrics, type Period } from '@/lib/api';
import { TARGETS, ragStatus } from '@/lib/targets';
import { STORES } from '@/lib/config';

const fmtGHS = (n: number) =>
  n >= 1_000_000
    ? `GHS ${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
    ? `GHS ${(n / 1_000).toFixed(0)}K`
    : `GHS ${Math.round(n).toLocaleString()}`;

const dash = (n: number, f: (x: number) => string) => (n ? f(n) : '—');

interface FinanceMetricsData {
  revenueMtd: number;
  cogs: number;
  revenueByBrand: { name: string; value: number }[];
  daily: number[];
  labels: string[];
  transactions: number;
  footfall: number;
  itemsSold: number;
  expensesByCategory: { name: string; actual: number; budget: number }[];
  revenueByStore: { name: string; value: number }[];
  expensesByStore: { name: string; value: number }[];
  debtorAging: { name: string; value: number }[];
  expensesTotal: number;
  expenseBudgetTotal: number;
  grossProfit: number;
  grossMargin: number;
  operatingProfit: number;
  operatingMargin: number;
  netProfit: number;
  netMargin: number;
  debtors: number;
  creditors: number;
  cashInflow: number;
  cashOutflow: number;
  cashNet: number;
  cashTrend: { name: string; value: number }[];
  cashPosition: number;
  runwayDays: number;
  forecast: { revenue: number; grossProfit: number; netProfit: number; cash: number };
  entryCount: number;
}

export default function FinancePage() {
  const [period, setPeriod] = useState<Period>('mtd');
  const [anchor, setAnchor] = useState('');
  const [store, setStore] = useState('');
  const { data: m } = useMetrics<FinanceMetricsData>('finance', period, anchor, store);

  const revenueMtd = m?.revenueMtd ?? 0;
  const revenueByBrand = m?.revenueByBrand ?? [];
  const daily = m?.daily ?? [];
  const labels = m?.labels ?? [];
  const dailyData = daily.map((v, i) => ({ name: labels[i] ?? String(i + 1), value: v }));
  const hasDaily = daily.some((v) => v > 0);

  const expenses = m?.expensesByCategory ?? [];
  const expenseData = expenses.map((c) => ({ name: c.name, value: c.actual, value2: c.budget }));
  const expensesTotal = m?.expensesTotal ?? 0;
  const budgetTotal = m?.expenseBudgetTotal ?? 0;
  const revenueByStore = m?.revenueByStore ?? [];
  const expensesByStore = m?.expensesByStore ?? [];
  const debtorAging = m?.debtorAging ?? [];

  const forecast = m?.forecast ?? { revenue: 0, grossProfit: 0, netProfit: 0, cash: 0 };
  const hasForecast = !!(forecast.revenue || forecast.grossProfit || forecast.netProfit || forecast.cash);

  const margins = [
    { label: 'Gross Margin', value: m?.grossMargin ?? 0 },
    { label: 'Operating Margin', value: m?.operatingMargin ?? 0 },
    { label: 'Net Margin', value: m?.netMargin ?? 0 },
  ];
  const pnl = [
    { name: 'Revenue', value: revenueMtd },
    { name: 'COGS', value: m?.cogs ?? 0 },
    { name: 'Gross Profit', value: m?.grossProfit ?? 0 },
    { name: 'Expenses', value: expensesTotal },
    { name: 'Net Profit', value: m?.netProfit ?? 0 },
  ];

  return (
    <div className="bg-[#0a0a0a] min-h-screen text-white">
      <DashboardHeader
        title="FINANCE COMMAND CENTER"
        subtitle="FINANCIAL DISCIPLINE. PROFITABLE GROWTH. CASH CONFIDENCE."
        mission="Finance Mission"
        missionDetail="Maximize profitability, protect cash, and drive sustainable value."
      />

      <div className="px-6 pt-4 flex justify-end">
        <PeriodTabs value={period} date={anchor} onChange={setPeriod} onDateChange={setAnchor} store={store} stores={STORES} onStoreChange={setStore} />
      </div>

      {/* KPI BAR */}
      <div className="px-6 py-3">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KPICard
            label="Revenue MTD"
            value={dash(revenueMtd, fmtGHS)}
            target={TARGETS.finance.revenueMtd ? fmtGHS(TARGETS.finance.revenueMtd) : undefined}
            status={ragStatus(revenueMtd, TARGETS.finance.revenueMtd) ?? 'green'}
            small
          />
          <KPICard
            label="Gross Profit"
            value={dash(m?.grossProfit ?? 0, fmtGHS)}
            change={m?.grossProfit ? m.grossMargin : undefined}
            changeLabel="% margin"
            status={(m?.grossProfit ?? 0) >= 0 ? 'green' : 'red'}
            small
          />
          <KPICard
            label="Operating Profit"
            value={dash(m?.operatingProfit ?? 0, fmtGHS)}
            change={m?.operatingProfit ? m.operatingMargin : undefined}
            changeLabel="% margin"
            status={(m?.operatingProfit ?? 0) >= 0 ? 'green' : 'red'}
            small
          />
          <KPICard label="Debtors" value={dash(m?.debtors ?? 0, fmtGHS)} small />
          <KPICard label="Creditors" value={dash(m?.creditors ?? 0, fmtGHS)} small />
          <KPICard label="Transactions" value={(m?.transactions ?? 0) ? (m?.transactions ?? 0).toLocaleString() : '—'} small />
        </div>
      </div>

      <div className="px-6 pb-8 space-y-6">
        {/* 1. Revenue */}
        <Section number={1} title="Revenue" subtitle="MTD">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <div className="text-xs text-gray-400 mb-2">Daily Revenue</div>
              {hasDaily ? (
                <SimpleLineChart data={dailyData} height={220} color="#c8a951" area prefix="GHS " />
              ) : (
                <EmptyState message="No revenue entries yet" hint="Submit Daily Revenue Entry in the Finance form." height={220} />
              )}
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-2">Revenue by Brand</div>
              {revenueByBrand.length ? (
                <>
                  <SimpleDonutChart
                    data={revenueByBrand}
                    height={200}
                    innerRadius={45}
                    outerRadius={65}
                    centerLabel="Total"
                    centerValue={fmtGHS(revenueMtd)}
                  />
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2">
                    {revenueByBrand.map((b, i) => (
                      <div key={b.name} className="flex items-center gap-1.5 text-[0.65rem]">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ['#c8a951', '#22c55e', '#3b82f6', '#ef4444', '#eab308', '#8b5cf6'][i % 6] }} />
                        <span className="text-gray-400 truncate">{b.name}</span>
                        <span className="text-white ml-auto">{fmtGHS(b.value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyState height={200} />
              )}
            </div>
          </div>
        </Section>

        {/* 2. Profitability */}
        <Section number={2} title="Profitability" subtitle="MTD">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <div className="text-xs text-gray-400 mb-2">Revenue → Profit Bridge</div>
              {revenueMtd ? (
                <SimpleBarChart data={pnl} height={240} color="#c8a951" prefix="GHS " />
              ) : (
                <EmptyState message="No revenue/cost data yet" hint="Add COGS on revenue entries to compute profit." height={240} />
              )}
            </div>
            <div className="space-y-3">
              <div className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wider">Key Margins</div>
              {margins.map((mg) => (
                <div key={mg.label} className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[0.65rem] text-gray-500">{mg.label}</span>
                    <span className="text-sm font-bold text-[#c8a951]">{mg.value ? `${mg.value}%` : '—'}</span>
                  </div>
                  <ProgressBar value={Math.max(0, mg.value)} max={60} color="#c8a951" height={4} />
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* 3. Cash Flow */}
        <Section number={3} title="Cash Flow" subtitle="MTD">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="space-y-3">
              <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-3">
                <div className="text-[0.65rem] text-gray-500">Cash Inflow</div>
                <div className="text-lg font-bold text-green-400">{dash(m?.cashInflow ?? 0, fmtGHS)}</div>
              </div>
              <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-3">
                <div className="text-[0.65rem] text-gray-500">Cash Outflow</div>
                <div className="text-lg font-bold text-red-400">{dash(m?.cashOutflow ?? 0, fmtGHS)}</div>
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-2">Weekly Net Cash Flow</div>
              {(m?.cashTrend ?? []).length ? (
                <SimpleLineChart data={m?.cashTrend ?? []} height={180} color="#22c55e" area prefix="GHS " />
              ) : (
                <EmptyState message="No cash-flow entries yet" hint="Submit Cash Flow Entry in the Finance form." height={180} />
              )}
            </div>
            <div className="space-y-3">
              <div className="bg-[#0d0d0d] border border-[#c8a951]/30 rounded-lg p-3">
                <div className="text-[0.65rem] text-[#c8a951]">Net Cash Position</div>
                <div className="text-lg font-bold text-[#c8a951]">{dash(m?.cashPosition ?? 0, fmtGHS)}</div>
                <div className="text-[0.6rem] text-gray-600 mt-1">Closing = inflows − outflows recorded</div>
              </div>
              <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <span className="text-[0.65rem] text-gray-500">Est. Cash Runway</span>
                  <span className="text-xl font-bold text-[#c8a951]">{(m?.runwayDays ?? 0) ? `${m?.runwayDays} days` : '—'}</span>
                </div>
                <div className="text-[0.6rem] text-gray-600 mt-1">Position ÷ operating expense run-rate</div>
              </div>
            </div>
          </div>
        </Section>

        {/* 4. Expense Control */}
        <Section number={4} title="Expense Control" subtitle="MTD">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="space-y-3">
              <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-3">
                <div className="text-[0.65rem] text-gray-500">Total OpEx</div>
                <div className="text-lg font-bold">{dash(expensesTotal, fmtGHS)}</div>
                {budgetTotal > 0 && (
                  <div className="text-[0.6rem] text-gray-600 mt-1">Budget: {fmtGHS(budgetTotal)}</div>
                )}
              </div>
              {expenses.map((c) => {
                const share = expensesTotal ? Math.round((c.actual / expensesTotal) * 100) : 0;
                return (
                  <div key={c.name} className="flex items-center gap-2 text-xs">
                    <span className="text-gray-400 w-16 truncate capitalize">{c.name}</span>
                    <div className="flex-1">
                      <ProgressBar value={share} max={100} color="#c8a951" height={4} />
                    </div>
                    <span className="text-[0.65rem] min-w-[2rem] text-right text-gray-300">{share}%</span>
                  </div>
                );
              })}
            </div>
            <div className="lg:col-span-2">
              <div className="text-xs text-gray-400 mb-2">Actual vs Budget by Category</div>
              {expenseData.length ? (
                <SimpleBarChart data={expenseData} height={260} color="#c8a951" color2="#4a4a4a" prefix="GHS " />
              ) : (
                <EmptyState message="No expenses recorded yet" hint="Submit Expense Recording in the Finance form." height={260} />
              )}
            </div>
          </div>
        </Section>

        {/* 4b. By Store + Debtor Aging */}
        <Section number={5} title="Store P&L & Debtor Aging">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-gray-400 mb-2">Revenue by Store</div>
              {revenueByStore.length ? (
                <SimpleBarChart data={revenueByStore} height={200} color="#c8a951" horizontal prefix="GHS " />
              ) : (
                <EmptyState message="No store revenue yet" hint="Set Store on Daily Revenue entries." height={200} />
              )}
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-2">Expenses by Store</div>
              {expensesByStore.length ? (
                <SimpleBarChart data={expensesByStore} height={200} color="#ef4444" horizontal prefix="GHS " />
              ) : (
                <EmptyState message="No store expenses yet" hint="Set Store/Department on Expense entries." height={200} />
              )}
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-2">Debtor Aging</div>
              {debtorAging.length ? (
                <SimpleDonutChart data={debtorAging} height={200} innerRadius={45} outerRadius={65} centerLabel="Debtors" centerValue={fmtGHS(debtorAging.reduce((s, d) => s + d.value, 0))} />
              ) : (
                <EmptyState message="No debtor data yet" hint="Submit Debtors / Creditors (with status) in the Finance form." height={200} />
              )}
            </div>
          </div>
        </Section>

        {/* 6. Forecast (only when forecast data exists) */}
        {hasForecast && (
          <Section number={6} title="Forecast & Outlook">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[#0d0d0d] border border-[#c8a951]/30 rounded-lg p-4">
                <div className="text-[0.65rem] text-[#c8a951] uppercase tracking-wider">Revenue Forecast</div>
                <div className="text-xl font-bold mt-1">{dash(forecast.revenue, fmtGHS)}</div>
              </div>
              <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-4">
                <div className="text-[0.65rem] text-gray-500 uppercase tracking-wider">Gross Profit Forecast</div>
                <div className="text-xl font-bold mt-1">{dash(forecast.grossProfit, fmtGHS)}</div>
              </div>
              <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-4">
                <div className="text-[0.65rem] text-gray-500 uppercase tracking-wider">Net Profit Forecast</div>
                <div className="text-xl font-bold mt-1">{dash(forecast.netProfit, fmtGHS)}</div>
              </div>
              <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-4">
                <div className="text-[0.65rem] text-gray-500 uppercase tracking-wider">Cash Forecast</div>
                <div className="text-xl font-bold mt-1">{dash(forecast.cash, fmtGHS)}</div>
              </div>
            </div>
          </Section>
        )}

        {/* 6. Recent Entries */}
        <Section number={hasForecast ? 7 : 6} title="Recent Entries">
          <RecentEntries department="finance" />
        </Section>
      </div>
    </div>
  );
}
