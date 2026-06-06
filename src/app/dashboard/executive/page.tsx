'use client';

import Link from 'next/link';
import DashboardHeader from '@/components/layout/DashboardHeader';
import KPICard from '@/components/ui/KPICard';
import Section from '@/components/ui/Section';
import EmptyState from '@/components/ui/EmptyState';
import { SimpleDonutChart, SimpleBarChart } from '@/components/charts/Charts';
import { useMetrics } from '@/lib/api';

const fmtGHS = (n: number) =>
  n >= 1_000_000
    ? `GHS ${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
    ? `GHS ${(n / 1_000).toFixed(0)}K`
    : `GHS ${Math.round(n).toLocaleString()}`;
const dash = (n: number, f: (x: number) => string) => (n ? f(n) : '—');
const pct = (n: number) => (n ? `${n}%` : '—');

export default function ExecutiveCommandCenter() {
  const fin = useMetrics<{ revenueMtd: number; netProfit: number; grossMargin: number; cashNet: number; revenueByBrand: { name: string; value: number }[] }>('finance').data;
  const com = useMetrics<{ groupSales: number; convRate: number; salesByStore: { name: string; value: number }[] }>('commercial').data;
  const ops = useMetrics<{ opsScore: number; openIssues: number }>('operations').data;
  const inv = useMetrics<{ inventoryValue: number; accuracy: number }>('inventory').data;
  const brd = useMetrics<{ healthIndex: number; sentiment: { positive: number } }>('brand').data;
  const mkt = useMetrics<{ totalLeads: number }>('marketing').data;

  const revenueByBrand = fin?.revenueByBrand ?? [];
  const salesByStore = com?.salesByStore ?? [];

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
      <div className="px-6 py-4">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <KPICard label="Group Revenue" value={dash(fin?.revenueMtd ?? 0, fmtGHS)} status="green" small />
          <KPICard label="Net Profit" value={dash(fin?.netProfit ?? 0, fmtGHS)} status={(fin?.netProfit ?? 0) >= 0 ? 'green' : 'red'} small />
          <KPICard label="Gross Margin" value={pct(fin?.grossMargin ?? 0)} small />
          <KPICard label="Net Cash Flow" value={dash(fin?.cashNet ?? 0, fmtGHS)} status={(fin?.cashNet ?? 0) >= 0 ? 'green' : 'red'} small />
          <KPICard label="Store Sales" value={dash(com?.groupSales ?? 0, fmtGHS)} small />
          <KPICard label="Inventory Value" value={dash(inv?.inventoryValue ?? 0, fmtGHS)} small />
          <KPICard label="Ops Score" value={pct(ops?.opsScore ?? 0)} small />
          <KPICard label="Brand Health" value={(brd?.healthIndex ?? 0) ? String(brd?.healthIndex) : '—'} small />
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

        {/* Department snapshot */}
        <Section number={2} title="Departments">
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
      </div>
    </div>
  );
}
