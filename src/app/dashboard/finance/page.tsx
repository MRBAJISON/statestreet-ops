'use client';

import { financeData } from '@/lib/data';
import DashboardHeader from '@/components/layout/DashboardHeader';
import KPICard from '@/components/ui/KPICard';
import Section from '@/components/ui/Section';
import StatusBadge from '@/components/ui/StatusBadge';
import ProgressBar from '@/components/ui/ProgressBar';
import { SimpleLineChart, SimpleBarChart, SimpleDonutChart, MiniSparkline } from '@/components/charts/Charts';

const fmt = (n: number, prefix = 'GHS ') => {
  if (n >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${prefix}${(n / 1_000).toFixed(0)}K`;
  return `${prefix}${n.toLocaleString()}`;
};

const fmtFull = (n: number) => `GHS ${n.toLocaleString()}`;

export default function FinancePage() {
  const d = financeData;

  // Prepare chart data
  const dailyRevenueData = d.revenue.daily.map((v, i) => ({
    name: d.revenue.labels[i],
    value: v,
    value2: Math.round(d.revenue.target / d.revenue.labels.length),
  }));

  const cashFlowTrendData = d.cashFlow.trend.map((v, i) => ({
    name: `W${i + 1}`,
    value: v,
  }));

  const expenseData = d.expenses.categories.map(c => ({
    name: c.name,
    value: c.actual,
    value2: c.budget,
  }));

  const totalOpEx = d.expenses.categories.reduce((sum, c) => sum + c.actual, 0);
  const totalBudget = d.expenses.categories.reduce((sum, c) => sum + c.budget, 0);

  const workingCapitalTrend = [
    { name: 'Jan', value: 1.08 },
    { name: 'Feb', value: 1.12 },
    { name: 'Mar', value: 1.15 },
    { name: 'Apr', value: 1.10 },
    { name: 'May', value: 1.18 },
  ];

  const inventoryByCategory = [
    { name: 'Suits', value: 286400, age0_90: 65, age90_180: 24, age180plus: 11 },
    { name: 'Shoes', value: 248700, age0_90: 68, age90_180: 22, age180plus: 10 },
    { name: 'Shirts', value: 167200, age0_90: 60, age90_180: 28, age180plus: 12 },
    { name: 'Blazers', value: 124600, age0_90: 55, age90_180: 30, age180plus: 15 },
    { name: 'Bags', value: 103200, age0_90: 70, age90_180: 20, age180plus: 10 },
    { name: 'Others', value: 250000, age0_90: 62, age90_180: 26, age180plus: 12 },
  ];

  const healthCheckColor = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'good' || s === 'positive' || s === 'low risk') return 'green';
    if (s === 'watch' || s === 'moderate') return 'yellow';
    return 'red';
  };

  const healthItems = [
    { area: 'Profitability', status: d.healthCheck.profitability, detail: 'Margins above target' },
    { area: 'Liquidity', status: d.healthCheck.liquidity, detail: 'Current ratio 1.62x' },
    { area: 'Solvency', status: d.healthCheck.solvency, detail: 'Debt-to-equity manageable' },
    { area: 'Efficiency', status: d.healthCheck.efficiency, detail: 'Working capital stable' },
    { area: 'Cash Flow', status: d.healthCheck.cashFlow, detail: 'Net positive cash flow' },
  ];

  const dailyAvg = Math.round(d.revenue.mtd / d.revenue.labels.length);
  const weeklyAvg = dailyAvg * 7;

  return (
    <div className="bg-[#0a0a0a] min-h-screen text-white">
      <DashboardHeader
        title="FINANCE COMMAND CENTER"
        subtitle="FINANCIAL DISCIPLINE. PROFITABLE GROWTH. CASH CONFIDENCE."
        mission="Finance Mission"
        missionDetail="Maximize profitability, protect cash, and drive sustainable value."
      />

      {/* TOP KPI BAR */}
      <div className="px-6 py-4">
        <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-3">
          <KPICard
            label="Revenue MTD"
            value="650,482"
            prefix="GHS "
            target="600K"
            change={8.4}
            status="green"
            small
          />
          <KPICard
            label="Gross Profit MTD"
            value="307,235"
            prefix="GHS "
            change={6.7}
            changeLabel="% | 47.2% Margin"
            status="green"
            small
          />
          <KPICard
            label="Operating Profit MTD"
            value="98,421"
            prefix="GHS "
            changeLabel="15.1% Margin"
            status="green"
            small
          />
          <KPICard
            label="Net Profit MTD"
            value="67,890"
            prefix="GHS "
            change={4.8}
            status="green"
            small
          />
          <KPICard
            label="Cash Balance"
            value="2.48M"
            prefix="GHS "
            change={-6.2}
            changeLabel="% vs LM"
            status="yellow"
            small
          />
          <KPICard
            label="Debtors Total"
            value="1.32M"
            prefix="GHS "
            change={-4}
            status="green"
            small
          />
          <KPICard
            label="Creditors Total"
            value="2.15M"
            prefix="GHS "
            change={1.8}
            status="yellow"
            small
          />
          <KPICard
            label="Inventory Value"
            value="11.80M"
            prefix="GHS "
            status="green"
            small
          />
          <KPICard
            label="Current Ratio"
            value="1.62x"
            status="green"
            small
          />
        </div>
      </div>

      {/* SECTIONS */}
      <div className="px-6 pb-8 space-y-6">

        {/* 1. Revenue Overview */}
        <Section number={1} title="Revenue Overview" subtitle="MTD">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* MTD Revenue vs Target */}
            <div className="lg:col-span-2">
              <div className="text-xs text-gray-400 mb-2">Daily Revenue vs Target</div>
              <SimpleLineChart
                data={dailyRevenueData}
                height={220}
                color="#c8a951"
                color2="#4a4a4a"
                dataKey="value"
                dataKey2="value2"
                prefix="GHS "
              />
              <div className="flex gap-4 mt-2 text-[0.65rem] text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-[#c8a951] inline-block" /> Actual
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-[#4a4a4a] inline-block" style={{ borderTop: '1px dashed #4a4a4a' }} /> Target
                </span>
              </div>
            </div>

            {/* Revenue by Brand + Stats */}
            <div className="space-y-4">
              <div>
                <div className="text-xs text-gray-400 mb-2">Revenue Breakdown by Brand</div>
                <SimpleDonutChart
                  data={d.revenueByBrand}
                  height={180}
                  innerRadius={45}
                  outerRadius={65}
                  centerLabel="Total Revenue"
                  centerValue={fmt(d.revenue.mtd)}
                />
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2">
                  {d.revenueByBrand.map((b, i) => (
                    <div key={b.name} className="flex items-center gap-1.5 text-[0.65rem]">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: ['#c8a951', '#22c55e', '#3b82f6', '#ef4444', '#eab308', '#8b5cf6'][i] }}
                      />
                      <span className="text-gray-400 truncate">{b.name}</span>
                      <span className="text-white ml-auto">{fmt(b.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-3">
                  <div className="text-[0.65rem] text-gray-500">Daily Avg</div>
                  <div className="text-sm font-bold">{fmtFull(dailyAvg)}</div>
                </div>
                <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-3">
                  <div className="text-[0.65rem] text-gray-500">Weekly Avg</div>
                  <div className="text-sm font-bold">{fmtFull(weeklyAvg)}</div>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* 2. Profitability Analysis */}
        <Section number={2} title="Profitability Analysis" subtitle="MTD">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#2a2a2a] text-gray-500">
                    <th className="text-left py-2 pr-4 font-medium">Line Item</th>
                    <th className="text-right py-2 px-3 font-medium">MTD (GHS)</th>
                    <th className="text-right py-2 px-3 font-medium">YTD (GHS)</th>
                    <th className="text-right py-2 px-3 font-medium">% Change</th>
                  </tr>
                </thead>
                <tbody>
                  {d.profitability.metrics.map((m) => {
                    const isTotal = ['Gross Profit', 'Operating Profit', 'Net Profit', 'PBT'].includes(m.name);
                    return (
                      <tr
                        key={m.name}
                        className={`border-b border-[#1a1a1a] ${isTotal ? 'font-semibold text-[#c8a951]' : ''}`}
                      >
                        <td className="py-2 pr-4">{m.name}</td>
                        <td className="py-2 px-3 text-right">{m.mtd.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right">{m.ytd.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right">
                          <span className={m.change >= 0 ? 'text-green-400' : 'text-red-400'}>
                            {m.change >= 0 ? '+' : ''}{m.change}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="space-y-3">
              <div className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wider">Key Margins</div>
              {[
                { label: 'Gross Margin', value: 47.2 },
                { label: 'Operating Margin', value: 15.1 },
                { label: 'Net Margin', value: 10.4 },
                { label: 'ROCE', value: 18.6 },
              ].map((m) => (
                <div key={m.label} className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[0.65rem] text-gray-500">{m.label}</span>
                    <span className="text-sm font-bold text-[#c8a951]">{m.value}%</span>
                  </div>
                  <ProgressBar value={m.value} max={50} color="#c8a951" height={4} />
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* 3. Cash Flow Overview */}
        <Section number={3} title="Cash Flow Overview" subtitle="MTD">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Cash Flow Summary */}
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3">
                <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-3">
                  <div className="text-[0.65rem] text-gray-500">Cash Inflow</div>
                  <div className="text-lg font-bold text-green-400">{fmt(d.cashFlow.inflow)}</div>
                </div>
                <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-3">
                  <div className="text-[0.65rem] text-gray-500">Cash Outflow</div>
                  <div className="text-lg font-bold text-red-400">{fmt(d.cashFlow.outflow)}</div>
                </div>
                <div className="bg-[#0d0d0d] border border-[#c8a951]/30 rounded-lg p-3">
                  <div className="text-[0.65rem] text-[#c8a951]">Net Cash Flow</div>
                  <div className="text-lg font-bold text-[#c8a951]">{fmt(d.cashFlow.net)}</div>
                </div>
              </div>
            </div>

            {/* Cash Flow Trend */}
            <div>
              <div className="text-xs text-gray-400 mb-2">Cash Flow Trend</div>
              <SimpleLineChart
                data={cashFlowTrendData}
                height={180}
                color="#22c55e"
                area
                prefix="GHS "
              />
            </div>

            {/* Cash Position + Runway */}
            <div className="space-y-3">
              <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-2 font-medium">Cash Position</div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Opening Balance</span>
                    <span>GHS 2.34M</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Net Cash Flow</span>
                    <span className="text-green-400">+{fmt(d.cashFlow.net)}</span>
                  </div>
                  <div className="border-t border-[#2a2a2a] pt-2 flex justify-between font-semibold">
                    <span className="text-gray-400">Closing Balance</span>
                    <span className="text-[#c8a951]">GHS 2.48M</span>
                  </div>
                </div>
              </div>
              <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <span className="text-[0.65rem] text-gray-500">Cash Runway</span>
                  <span className="text-xl font-bold text-[#c8a951]">{d.cashRunway} Days</span>
                </div>
                <ProgressBar value={d.cashRunway} max={120} color="#c8a951" height={4} />
                <div className="text-[0.6rem] text-gray-600 mt-1">Based on avg. monthly burn rate</div>
              </div>
            </div>
          </div>
        </Section>

        {/* 4. Working Capital Analysis */}
        <Section number={4} title="Working Capital Analysis">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Working Capital Components */}
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3">
                {[
                  { label: 'Inventory', value: d.workingCapital.inventory, color: 'text-blue-400' },
                  { label: 'Debtors', value: d.workingCapital.debtors, color: 'text-green-400' },
                  { label: 'Creditors', value: d.workingCapital.creditors, color: 'text-red-400' },
                ].map((item) => (
                  <div key={item.label} className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-3">
                    <div className="text-[0.65rem] text-gray-500">{item.label}</div>
                    <div className={`text-lg font-bold ${item.color}`}>{fmt(item.value)}</div>
                  </div>
                ))}
                <div className="bg-[#0d0d0d] border border-[#c8a951]/30 rounded-lg p-3">
                  <div className="text-[0.65rem] text-[#c8a951]">Working Capital Ratio</div>
                  <div className="text-lg font-bold text-[#c8a951]">{d.workingCapital.ratio}x</div>
                </div>
              </div>
            </div>

            {/* Working Capital Trend */}
            <div>
              <div className="text-xs text-gray-400 mb-2">Working Capital Trend</div>
              <SimpleLineChart
                data={workingCapitalTrend.map(w => ({ name: w.name, value: w.value }))}
                height={180}
                color="#c8a951"
                area
              />
            </div>

            {/* Ratios */}
            <div className="space-y-3">
              {[
                { label: 'Current Ratio', value: '1.62x', benchmark: 'Target > 1.5x', pct: 81 },
                { label: 'Quick Ratio', value: '1.18x', benchmark: 'Target > 1.0x', pct: 100 },
                { label: 'Cash Conversion Cycle', value: '52 Days', benchmark: 'Target < 60 Days', pct: 87 },
              ].map((r) => (
                <div key={r.label} className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[0.65rem] text-gray-500">{r.label}</span>
                    <span className="text-sm font-bold">{r.value}</span>
                  </div>
                  <ProgressBar value={r.pct} max={100} height={4} />
                  <div className="text-[0.6rem] text-gray-600 mt-1">{r.benchmark}</div>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* 5. Inventory Financial Performance */}
        <Section number={5} title="Inventory Financial Performance">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Summary KPIs */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-3">
                <div className="text-[0.65rem] text-gray-500">Inventory Value</div>
                <div className="text-sm font-bold">GHS 11.80M</div>
              </div>
              <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-3">
                <div className="text-[0.65rem] text-gray-500">GMROI Target</div>
                <div className="text-sm font-bold text-[#c8a951]">2.5x</div>
              </div>
              <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-3">
                <div className="text-[0.65rem] text-gray-500">Stock Holding Days</div>
                <div className="text-sm font-bold">147</div>
              </div>
              <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-3">
                <div className="text-[0.65rem] text-gray-500">Turn Ratio</div>
                <div className="text-sm font-bold">{d.inventoryValue.turnRatio}x</div>
              </div>
            </div>

            {/* Inventory Value by Category + Aging */}
            <div className="lg:col-span-2 overflow-x-auto">
              <div className="text-xs text-gray-400 mb-2">Inventory Value by Category with Aging Analysis</div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#2a2a2a] text-gray-500">
                    <th className="text-left py-2 pr-3 font-medium">Category</th>
                    <th className="text-right py-2 px-2 font-medium">Value (GHS)</th>
                    <th className="text-right py-2 px-2 font-medium">0-90d</th>
                    <th className="text-right py-2 px-2 font-medium">90-180d</th>
                    <th className="text-right py-2 px-2 font-medium">180d+</th>
                    <th className="py-2 pl-3 font-medium">Aging</th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryByCategory.map((cat) => (
                    <tr key={cat.name} className="border-b border-[#1a1a1a]">
                      <td className="py-2 pr-3">{cat.name}</td>
                      <td className="py-2 px-2 text-right">{cat.value.toLocaleString()}</td>
                      <td className="py-2 px-2 text-right text-green-400">{cat.age0_90}%</td>
                      <td className="py-2 px-2 text-right text-yellow-400">{cat.age90_180}%</td>
                      <td className="py-2 px-2 text-right text-red-400">{cat.age180plus}%</td>
                      <td className="py-2 pl-3 w-24">
                        <div className="flex h-2 rounded-full overflow-hidden">
                          <div className="bg-green-500" style={{ width: `${cat.age0_90}%` }} />
                          <div className="bg-yellow-500" style={{ width: `${cat.age90_180}%` }} />
                          <div className="bg-red-500" style={{ width: `${cat.age180plus}%` }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Section>

        {/* 6. Expense Control */}
        <Section number={6} title="Expense Control" subtitle="MTD">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Summary */}
            <div className="space-y-3">
              <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-3">
                <div className="text-[0.65rem] text-gray-500">Total OpEx (MTD)</div>
                <div className="text-lg font-bold">{fmtFull(totalOpEx)}</div>
                <div className="text-[0.6rem] text-gray-600 mt-1">Budget: {fmtFull(totalBudget)}</div>
                <ProgressBar value={Math.round((totalOpEx / totalBudget) * 100)} max={100} height={4} />
                <div className="text-[0.6rem] mt-1">
                  <span className={totalOpEx <= totalBudget ? 'text-green-400' : 'text-red-400'}>
                    {totalOpEx <= totalBudget ? 'Under' : 'Over'} budget by {fmtFull(Math.abs(totalBudget - totalOpEx))}
                  </span>
                </div>
              </div>

              {/* Expense breakdown mini list */}
              <div className="space-y-2">
                {d.expenses.categories.map((c) => {
                  const pct = Math.round((c.actual / c.budget) * 100);
                  const over = c.actual > c.budget;
                  return (
                    <div key={c.name} className="flex items-center gap-2 text-xs">
                      <span className="text-gray-400 w-16 truncate">{c.name}</span>
                      <div className="flex-1">
                        <ProgressBar value={pct} max={120} color={over ? '#ef4444' : '#22c55e'} height={4} />
                      </div>
                      <span className={`text-[0.65rem] min-w-[2rem] text-right ${over ? 'text-red-400' : 'text-green-400'}`}>
                        {pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actual vs Budget Bar Chart */}
            <div className="lg:col-span-2">
              <div className="text-xs text-gray-400 mb-2">Actual vs Budget by Category</div>
              <SimpleBarChart
                data={expenseData}
                height={280}
                color="#c8a951"
                color2="#4a4a4a"
                prefix="GHS "
              />
              <div className="flex gap-4 mt-2 text-[0.65rem] text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-[#c8a951] rounded-sm inline-block" /> Actual
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-[#4a4a4a] rounded-sm inline-block" /> Budget
                </span>
              </div>
            </div>
          </div>
        </Section>

        {/* 7. Forecast & Outlook */}
        <Section number={7} title="Forecast & Outlook" subtitle="End of Month">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#0d0d0d] border border-[#c8a951]/30 rounded-lg p-4">
              <div className="text-[0.65rem] text-[#c8a951] uppercase tracking-wider">Revenue Forecast</div>
              <div className="text-xl font-bold mt-1">{fmt(d.forecast.revenue)}</div>
              <MiniSparkline data={[1500000, 1620000, 1710000, 1780000, 1860000]} color="#c8a951" height={35} />
            </div>
            <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-4">
              <div className="text-[0.65rem] text-gray-500 uppercase tracking-wider">Gross Profit Forecast</div>
              <div className="text-xl font-bold mt-1">{fmt(d.forecast.grossProfit)}</div>
              <MiniSparkline data={[720000, 760000, 810000, 850000, 880000]} color="#22c55e" height={35} />
            </div>
            <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-4">
              <div className="text-[0.65rem] text-gray-500 uppercase tracking-wider">Net Profit Forecast</div>
              <div className="text-xl font-bold mt-1">{fmt(d.forecast.netProfit)}</div>
              <MiniSparkline data={[150000, 162000, 172000, 182000, 190000]} color="#3b82f6" height={35} />
            </div>
            <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-4">
              <div className="text-[0.65rem] text-gray-500 uppercase tracking-wider">Cash Ending Balance</div>
              <div className="text-xl font-bold mt-1">GHS 2.48M</div>
              <MiniSparkline data={[2340000, 2380000, 2420000, 2450000, 2480000]} color="#c8a951" height={35} />
            </div>
          </div>
        </Section>

        {/* 8. Financial Health Check */}
        <Section number={8} title="Financial Health Check">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Traffic Light Indicators */}
            <div>
              <div className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wider">Health Indicators</div>
              <div className="space-y-2">
                {healthItems.map((h) => (
                  <div key={h.area} className="flex items-center gap-3 bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-3">
                    <div
                      className={`w-3 h-3 rounded-full flex-shrink-0 ${
                        healthCheckColor(h.status) === 'green'
                          ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]'
                          : healthCheckColor(h.status) === 'yellow'
                          ? 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]'
                          : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                      }`}
                    />
                    <div className="flex-1">
                      <div className="text-xs font-medium">{h.area}</div>
                      <div className="text-[0.6rem] text-gray-500">{h.detail}</div>
                    </div>
                    <StatusBadge status={h.status} />
                  </div>
                ))}
              </div>
            </div>

            {/* Key Insights & Alerts */}
            <div>
              <div className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wider">Key Insights & Alerts</div>
              <div className="space-y-2">
                {[
                  { type: 'positive', text: 'Revenue MTD is 8.4% above target -- strong sales momentum.' },
                  { type: 'positive', text: 'Gross margin at 47.2% exceeding forecast. COGS well controlled.' },
                  { type: 'positive', text: 'Net cash flow positive at GHS 230K. Cash runway at 78 days.' },
                  { type: 'warning', text: 'Cash balance declined 6.2% vs last month. Monitor outflows closely.' },
                  { type: 'warning', text: 'Creditors up 1.8% -- review payment terms and scheduling.' },
                  { type: 'info', text: 'Stock holding at 147 days -- above target. Push sell-through initiatives.' },
                  { type: 'info', text: 'Rent is the largest expense at GHS 170.5K. Marginally over budget.' },
                ].map((insight, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 text-xs p-2.5 rounded-lg border ${
                      insight.type === 'positive'
                        ? 'border-green-500/20 bg-green-500/5'
                        : insight.type === 'warning'
                        ? 'border-yellow-500/20 bg-yellow-500/5'
                        : 'border-blue-500/20 bg-blue-500/5'
                    }`}
                  >
                    <span className="flex-shrink-0 mt-0.5">
                      {insight.type === 'positive' ? (
                        <span className="text-green-400 text-[0.7rem]">&#9650;</span>
                      ) : insight.type === 'warning' ? (
                        <span className="text-yellow-400 text-[0.7rem]">&#9888;</span>
                      ) : (
                        <span className="text-blue-400 text-[0.7rem]">&#9679;</span>
                      )}
                    </span>
                    <span className="text-gray-300">{insight.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
