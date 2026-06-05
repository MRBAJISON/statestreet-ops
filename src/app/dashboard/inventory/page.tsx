'use client';

import { inventoryData } from '@/lib/data';
import DashboardHeader from '@/components/layout/DashboardHeader';
import KPICard from '@/components/ui/KPICard';
import Section from '@/components/ui/Section';
import StatusBadge from '@/components/ui/StatusBadge';
import ScoreGauge from '@/components/ui/ScoreGauge';
import ProgressBar from '@/components/ui/ProgressBar';
import { SimpleLineChart, SimpleBarChart, SimpleDonutChart } from '@/components/charts/Charts';

const fmt = (n: number, prefix = 'GHS ') => {
  if (n >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${prefix}${(n / 1_000).toFixed(0)}K`;
  return `${prefix}${n.toLocaleString()}`;
};

const fmtFull = (n: number) => `GHS ${n.toLocaleString()}`;

export default function InventoryPage() {
  const d = inventoryData;

  // Chart data
  const valueTrendData = d.valueTrend.map(v => ({ name: v.month, value: v.value }));

  const ageChartData = d.healthByAge.map(a => ({ name: a.range, value: a.pct }));

  const accuracyBreakdown = [
    { name: 'Accurate (Within 2%)', value: 98.2 },
    { name: 'Variance (2-5%)', value: 1.1 },
    { name: 'Variance (5-10%)', value: 0.5 },
    { name: 'Variance (>10%)', value: 0.2 },
  ];

  const totalReplenishmentPOs = d.replenishment.reduce((s, r) => s + r.pos, 0);
  const totalReplenishmentValue = d.replenishment.reduce((s, r) => s + r.value, 0);

  const upcomingReceipts = [
    { po: 'PO-2026-0147', supplier: 'Arbiter Italy', items: 'Shoes (42 units)', eta: '07 Jun 2026', value: 86400 },
    { po: 'PO-2026-0152', supplier: 'Gianfranco Butteri', items: 'Suits (28 units)', eta: '10 Jun 2026', value: 64200 },
    { po: 'PO-2026-0158', supplier: 'Cucinera Fiorentina', items: 'Bags (35 units)', eta: '12 Jun 2026', value: 48300 },
  ];

  return (
    <div className="bg-[#0a0a0a] min-h-screen text-white">
      <DashboardHeader
        title="INVENTORY COMMAND CENTER"
        subtitle="RIGHT STOCK. RIGHT PLACE. RIGHT TIME. MAXIMUM RETURNS."
        mission="Inventory Mission"
        missionDetail="Optimize inventory value. Eliminate dead stock. Maximize sell-through & cash flow."
      />

      {/* TOP KPI BAR */}
      <div className="px-6 py-4">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <KPICard
            label="Total Inventory Value"
            value="1.18M"
            prefix="GHS "
            change={4.8}
            changeLabel="% vs Last Month"
            status="green"
            small
          />
          <KPICard
            label="Inventory Turn (YTD)"
            value="2.48x"
            target="3.0x"
            change={-0.52}
            changeLabel=""
            status="yellow"
            small
          />
          <KPICard
            label="Sell Through % (YTD)"
            value="68.3%"
            target="75.0%"
            change={6.7}
            changeLabel="pp"
            status="yellow"
            small
          />
          <KPICard
            label="GMROI (YTD)"
            value="2.48"
            target="3.0"
            change={-0.52}
            changeLabel=""
            status="yellow"
            small
          />
          <KPICard
            label="Weeks of Cover"
            value="14.2"
            target="10-12"
            status="yellow"
            small
          />
          <KPICard
            label="Dead Stock % (180+ Days)"
            value="11.9%"
            target="< 8%"
            status="red"
            small
          />
          <KPICard
            label="Out of Stock Items"
            value={126}
            change={18}
            changeLabel=" vs Last Month"
            status="yellow"
            small
          />
          <KPICard
            label="Stock Accuracy"
            value="98.2%"
            target="98%"
            change={0.2}
            changeLabel="pp"
            status="green"
            small
          />
        </div>
      </div>

      {/* SECTIONS */}
      <div className="px-6 pb-8 space-y-6">

        {/* 1. Inventory Value Overview */}
        <Section number={1} title="Inventory Value Overview">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Monthly Value Trend */}
            <div className="lg:col-span-2">
              <div className="text-xs text-gray-400 mb-2">Monthly Inventory Value Trend</div>
              <SimpleLineChart
                data={valueTrendData}
                height={220}
                color="#c8a951"
                area
                prefix="GHS "
              />
            </div>

            {/* Value by Brand */}
            <div>
              <div className="text-xs text-gray-400 mb-2">Value by Brand</div>
              <SimpleDonutChart
                data={d.byBrand}
                height={180}
                innerRadius={45}
                outerRadius={65}
                centerLabel="Total"
                centerValue="GHS 1.18M"
              />
              <div className="grid grid-cols-1 gap-y-1 mt-2">
                {d.byBrand.map((b, i) => (
                  <div key={b.name} className="flex items-center gap-1.5 text-[0.65rem]">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: ['#c8a951', '#22c55e', '#3b82f6', '#ef4444', '#eab308', '#8b5cf6'][i] }}
                    />
                    <span className="text-gray-400 truncate">{b.name}</span>
                    <span className="text-white ml-auto">{b.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* 2. Inventory Health by Age */}
        <Section number={2} title="Inventory Health by Age">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <div className="text-xs text-gray-400 mb-2">% of Inventory Value by Age Bucket</div>
              <SimpleBarChart
                data={ageChartData}
                height={220}
                color="#c8a951"
              />
            </div>
            <div className="space-y-3">
              <div className="text-xs text-gray-400 mb-1">Age Breakdown</div>
              {d.healthByAge.map((a) => {
                const isDeadStock = a.range === '180+ Days';
                return (
                  <div key={a.range} className={`bg-[#0d0d0d] border rounded-lg p-3 ${isDeadStock ? 'border-red-500/40' : 'border-[#2a2a2a]'}`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className={`text-[0.65rem] ${isDeadStock ? 'text-red-400 font-semibold' : 'text-gray-400'}`}>{a.range}</span>
                      <span className={`text-sm font-bold ${isDeadStock ? 'text-red-400' : 'text-white'}`}>{a.pct}%</span>
                    </div>
                    <ProgressBar value={a.pct} max={30} color={isDeadStock ? '#ef4444' : a.pct > 20 ? '#eab308' : '#22c55e'} height={4} />
                  </div>
                );
              })}
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mt-2">
                <div className="text-[0.65rem] text-red-400 font-semibold">Dead Stock (180+ Days)</div>
                <div className="text-lg font-bold text-red-400">11.9% <span className="text-xs text-gray-500 font-normal">of Total Inventory</span></div>
              </div>
            </div>
          </div>
        </Section>

        {/* 3. Inventory by Category */}
        <Section number={3} title="Inventory by Category">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#2a2a2a] text-gray-500">
                  <th className="text-left py-2 pr-4 font-medium">Category</th>
                  <th className="text-right py-2 px-3 font-medium">Inventory Value (GHS)</th>
                  <th className="text-right py-2 px-3 font-medium">% of Total</th>
                  <th className="text-right py-2 px-3 font-medium">Weeks Cover</th>
                  <th className="text-right py-2 px-3 font-medium">Sell Through %</th>
                  <th className="py-2 pl-3 font-medium">Performance</th>
                </tr>
              </thead>
              <tbody>
                {d.byCategory.map((c) => {
                  const coverStatus = c.weeksCover <= 12 ? 'text-green-400' : c.weeksCover <= 14 ? 'text-yellow-400' : 'text-red-400';
                  const stStatus = c.sellThrough >= 70 ? 'text-green-400' : c.sellThrough >= 65 ? 'text-yellow-400' : 'text-red-400';
                  return (
                    <tr key={c.name} className="border-b border-[#1a1a1a] hover:bg-[#151515]">
                      <td className="py-2 pr-4 font-medium">{c.name}</td>
                      <td className="py-2 px-3 text-right">{c.value.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right">{c.pctTotal}%</td>
                      <td className={`py-2 px-3 text-right ${coverStatus}`}>{c.weeksCover}</td>
                      <td className={`py-2 px-3 text-right ${stStatus}`}>{c.sellThrough}%</td>
                      <td className="py-2 pl-3 w-24">
                        <ProgressBar value={c.sellThrough} max={100} color={c.sellThrough >= 70 ? '#22c55e' : c.sellThrough >= 65 ? '#eab308' : '#ef4444'} height={4} />
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t border-[#2a2a2a] font-semibold text-[#c8a951]">
                  <td className="py-2 pr-4">Total</td>
                  <td className="py-2 px-3 text-right">{d.byCategory.reduce((s, c) => s + c.value, 0).toLocaleString()}</td>
                  <td className="py-2 px-3 text-right">100%</td>
                  <td className="py-2 px-3 text-right">{d.weeksCover.value}</td>
                  <td className="py-2 px-3 text-right">{d.sellThrough.pct}%</td>
                  <td className="py-2 pl-3"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        {/* 4 & 5: Slow Moving SKUs & Dead Stock Watch - side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 4. Top Slow Moving SKUs */}
          <Section number={4} title="Top Slow Moving SKUs" subtitle="60-180 Days">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#2a2a2a] text-gray-500">
                    <th className="text-left py-2 pr-2 font-medium w-8">#</th>
                    <th className="text-left py-2 pr-2 font-medium">SKU</th>
                    <th className="text-left py-2 pr-2 font-medium">Description</th>
                    <th className="text-left py-2 pr-2 font-medium">Category</th>
                    <th className="text-right py-2 px-2 font-medium">Value (GHS)</th>
                    <th className="text-right py-2 font-medium">Days</th>
                  </tr>
                </thead>
                <tbody>
                  {d.slowMoving.map((item) => (
                    <tr key={item.sku} className="border-b border-[#1a1a1a] hover:bg-[#151515]">
                      <td className="py-2 pr-2 text-gray-500">{item.rank}</td>
                      <td className="py-2 pr-2 text-[#c8a951] font-mono">{item.sku}</td>
                      <td className="py-2 pr-2">{item.description}</td>
                      <td className="py-2 pr-2 text-gray-400">{item.category}</td>
                      <td className="py-2 px-2 text-right">{item.value.toLocaleString()}</td>
                      <td className="py-2 text-right">
                        <span className="text-yellow-400">{item.days}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* 5. Dead Stock Watch */}
          <Section number={5} title="Dead Stock Watch" subtitle="180+ Days">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#2a2a2a] text-gray-500">
                    <th className="text-left py-2 pr-2 font-medium w-8">#</th>
                    <th className="text-left py-2 pr-2 font-medium">SKU</th>
                    <th className="text-left py-2 pr-2 font-medium">Description</th>
                    <th className="text-left py-2 pr-2 font-medium">Category</th>
                    <th className="text-right py-2 px-2 font-medium">Value (GHS)</th>
                    <th className="text-right py-2 font-medium">Days</th>
                  </tr>
                </thead>
                <tbody>
                  {d.deadStockItems.map((item) => (
                    <tr key={item.sku} className="border-b border-[#1a1a1a] hover:bg-[#151515]">
                      <td className="py-2 pr-2 text-gray-500">{item.rank}</td>
                      <td className="py-2 pr-2 text-red-400 font-mono">{item.sku}</td>
                      <td className="py-2 pr-2">{item.description}</td>
                      <td className="py-2 pr-2 text-gray-400">{item.category}</td>
                      <td className="py-2 px-2 text-right">{item.value.toLocaleString()}</td>
                      <td className="py-2 text-right">
                        <span className="text-red-400 font-semibold">{item.days}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </div>

        {/* 6. Stock Accuracy & Variance */}
        <Section number={6} title="Stock Accuracy & Variance">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Accuracy Donut */}
            <div className="flex flex-col items-center">
              <ScoreGauge score={98.2} label="Stock Accuracy" size="lg" color="#22c55e" />
              <div className="mt-4 space-y-2 w-full">
                {accuracyBreakdown.map((a, i) => {
                  const colors = ['#22c55e', '#eab308', '#f97316', '#ef4444'];
                  return (
                    <div key={a.name} className="flex items-center gap-2 text-[0.65rem]">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: colors[i] }} />
                      <span className="text-gray-400 flex-1">{a.name}</span>
                      <span className="text-white font-medium">{a.value}%</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Accuracy Donut Chart */}
            <div>
              <div className="text-xs text-gray-400 mb-2">Accuracy Distribution</div>
              <SimpleDonutChart
                data={accuracyBreakdown}
                height={200}
                innerRadius={50}
                outerRadius={70}
                centerLabel="Accuracy"
                centerValue="98.2%"
                colors={['#22c55e', '#eab308', '#f97316', '#ef4444']}
              />
            </div>

            {/* Variance by Store */}
            <div>
              <div className="text-xs text-gray-400 mb-2">Variance by Store</div>
              <div className="space-y-2">
                {d.storeAccuracy.map((s) => {
                  const color = s.accuracy >= 98 ? '#22c55e' : s.accuracy >= 97.5 ? '#eab308' : '#ef4444';
                  return (
                    <div key={s.store} className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-2.5">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[0.65rem] text-gray-400">{s.store}</span>
                        <span className="text-xs font-bold" style={{ color }}>{s.accuracy}%</span>
                      </div>
                      <ProgressBar value={s.accuracy} max={100} color={color} height={3} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Section>

        {/* 7. Inventory Movement Summary (MTD) */}
        <Section number={7} title="Inventory Movement Summary" subtitle="MTD">
          <div className="flex flex-wrap items-center justify-center gap-2 py-4">
            {/* Opening Stock */}
            <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-4 text-center min-w-[140px]">
              <div className="text-[0.6rem] text-gray-500 uppercase tracking-wider">Opening Stock</div>
              <div className="text-lg font-bold text-white mt-1">{fmt(d.movement.opening)}</div>
            </div>
            <div className="text-gray-600 text-lg">+</div>
            {/* Received */}
            <div className="bg-[#0d0d0d] border border-green-500/30 rounded-lg p-4 text-center min-w-[140px]">
              <div className="text-[0.6rem] text-green-400 uppercase tracking-wider">Received</div>
              <div className="text-lg font-bold text-green-400 mt-1">{fmt(d.movement.received)}</div>
            </div>
            <div className="text-gray-600 text-lg">-</div>
            {/* Sold */}
            <div className="bg-[#0d0d0d] border border-[#c8a951]/30 rounded-lg p-4 text-center min-w-[140px]">
              <div className="text-[0.6rem] text-[#c8a951] uppercase tracking-wider">Sold</div>
              <div className="text-lg font-bold text-[#c8a951] mt-1">{fmt(d.movement.sold)}</div>
            </div>
            <div className="text-gray-600 text-lg">+</div>
            {/* Returns */}
            <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-4 text-center min-w-[140px]">
              <div className="text-[0.6rem] text-gray-500 uppercase tracking-wider">Returns</div>
              <div className="text-lg font-bold text-white mt-1">{fmt(d.movement.returns)}</div>
            </div>
            <div className="text-gray-600 text-lg">-</div>
            {/* Transfers Out */}
            <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-4 text-center min-w-[140px]">
              <div className="text-[0.6rem] text-gray-500 uppercase tracking-wider">Transfers Out</div>
              <div className="text-lg font-bold text-white mt-1">{fmt(d.movement.transfers)}</div>
            </div>
            <div className="text-gray-600 text-lg">=</div>
            {/* Closing Stock */}
            <div className="bg-[#0d0d0d] border border-[#c8a951]/40 rounded-lg p-4 text-center min-w-[140px]">
              <div className="text-[0.6rem] text-[#c8a951] uppercase tracking-wider">Closing Stock</div>
              <div className="text-lg font-bold text-[#c8a951] mt-1">{fmt(d.movement.closing)}</div>
            </div>
          </div>
        </Section>

        {/* 8. Buying & Replenishment Status */}
        <Section number={8} title="Buying & Replenishment Status">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* PO Status */}
            <div>
              <div className="text-xs text-gray-400 mb-2">Purchase Order Status</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#2a2a2a] text-gray-500">
                      <th className="text-left py-2 pr-4 font-medium">Status</th>
                      <th className="text-right py-2 px-3 font-medium"># POs</th>
                      <th className="text-right py-2 font-medium">Value (GHS)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.replenishment.map((r) => {
                      const isDelayed = r.status === 'Delayed';
                      return (
                        <tr key={r.status} className={`border-b border-[#1a1a1a] ${isDelayed ? 'text-red-400' : ''}`}>
                          <td className="py-2 pr-4">{r.status}</td>
                          <td className="py-2 px-3 text-right">{r.pos}</td>
                          <td className="py-2 text-right">{r.value.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                    <tr className="border-t border-[#2a2a2a] font-semibold text-[#c8a951]">
                      <td className="py-2 pr-4">Total</td>
                      <td className="py-2 px-3 text-right">{totalReplenishmentPOs}</td>
                      <td className="py-2 text-right">{totalReplenishmentValue.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Upcoming Receipts */}
            <div>
              <div className="text-xs text-gray-400 mb-2">Top Upcoming Receipts</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#2a2a2a] text-gray-500">
                      <th className="text-left py-2 pr-2 font-medium">PO #</th>
                      <th className="text-left py-2 pr-2 font-medium">Supplier</th>
                      <th className="text-left py-2 pr-2 font-medium">Items</th>
                      <th className="text-left py-2 pr-2 font-medium">ETA</th>
                      <th className="text-right py-2 font-medium">Value (GHS)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcomingReceipts.map((r) => (
                      <tr key={r.po} className="border-b border-[#1a1a1a] hover:bg-[#151515]">
                        <td className="py-2 pr-2 text-[#c8a951] font-mono">{r.po}</td>
                        <td className="py-2 pr-2">{r.supplier}</td>
                        <td className="py-2 pr-2 text-gray-400">{r.items}</td>
                        <td className="py-2 pr-2">{r.eta}</td>
                        <td className="py-2 text-right">{r.value.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Section>

        {/* 9. Inventory Optimization Actions */}
        <Section number={9} title="Inventory Optimization Actions">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#2a2a2a] text-gray-500">
                  <th className="text-left py-2 pr-4 font-medium">Action</th>
                  <th className="text-left py-2 px-3 font-medium">Priority</th>
                  <th className="text-left py-2 px-3 font-medium">Owner</th>
                  <th className="text-left py-2 px-3 font-medium">Deadline</th>
                  <th className="text-left py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {d.optimizationActions.map((a) => (
                  <tr key={a.action} className="border-b border-[#1a1a1a] hover:bg-[#151515]">
                    <td className="py-2 pr-4">{a.action}</td>
                    <td className="py-2 px-3">
                      <StatusBadge status={a.priority} />
                    </td>
                    <td className="py-2 px-3 text-gray-400">{a.owner}</td>
                    <td className="py-2 px-3">{a.deadline}</td>
                    <td className="py-2">
                      <StatusBadge status={a.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Bottom Sections: Insights, Focus, Risk Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Key Insights */}
          <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-4">
            <h3 className="text-sm font-bold uppercase tracking-wide mb-3 flex items-center gap-2">
              <span className="text-[#c8a951]">&#9733;</span> Key Insights
            </h3>
            <div className="space-y-2">
              {[
                { type: 'positive', text: 'Inventory value grew 4.8% to GHS 1.18M -- aligned with seasonal buying plan.' },
                { type: 'warning', text: 'Dead stock at 11.9% is above 8% target. GHS 140K+ tied in non-moving items.' },
                { type: 'info', text: 'Suits and Shoes together hold 45.4% of total inventory value.' },
                { type: 'positive', text: 'Stock accuracy at 98.2% exceeds the 98% benchmark.' },
                { type: 'warning', text: 'Weeks of cover at 14.2 is above 10-12 week target -- overstocked risk.' },
              ].map((insight, i) => (
                <div key={i} className={`flex items-start gap-2 text-xs p-2.5 rounded-lg border ${
                  insight.type === 'positive' ? 'border-green-500/20 bg-green-500/5'
                  : insight.type === 'warning' ? 'border-yellow-500/20 bg-yellow-500/5'
                  : 'border-blue-500/20 bg-blue-500/5'
                }`}>
                  <span className="flex-shrink-0 mt-0.5">
                    {insight.type === 'positive' ? <span className="text-green-400 text-[0.7rem]">&#9650;</span>
                    : insight.type === 'warning' ? <span className="text-yellow-400 text-[0.7rem]">&#9888;</span>
                    : <span className="text-blue-400 text-[0.7rem]">&#9679;</span>}
                  </span>
                  <span className="text-gray-300">{insight.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Focus This Month */}
          <div className="bg-[#111] border border-[#c8a951]/30 rounded-lg p-4">
            <h3 className="text-sm font-bold uppercase tracking-wide mb-3 flex items-center gap-2">
              <span className="text-[#c8a951]">&#9873;</span> Focus This Month
            </h3>
            <div className="space-y-3">
              {[
                { text: 'Clear 50% of dead stock (180+ days) through markdown & bundle campaigns', owner: 'Commercial Team' },
                { text: 'Reduce weeks of cover from 14.2 to below 12 through accelerated sell-through', owner: 'Merch & Commercial' },
                { text: 'Rebalance stock across stores -- prioritize fast-moving categories at high-traffic locations', owner: 'Operations' },
                { text: 'Achieve 3.0x inventory turn rate by end of Q2', owner: 'Buying Team' },
                { text: 'Close all 126 out-of-stock gaps on fast movers', owner: 'Replenishment' },
              ].map((focus, i) => (
                <div key={i} className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-3">
                  <div className="text-xs text-white">{focus.text}</div>
                  <div className="text-[0.6rem] text-[#c8a951] mt-1">Owner: {focus.owner}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Risk Alerts */}
          <div className="bg-[#111] border border-red-500/30 rounded-lg p-4">
            <h3 className="text-sm font-bold uppercase tracking-wide mb-3 flex items-center gap-2">
              <span className="text-red-400">&#9888;</span> Risk Alerts
            </h3>
            <div className="space-y-2">
              {[
                { severity: 'Critical', text: 'Dead stock at 11.9% (target < 8%) -- GHS 140K+ capital locked in non-moving SKUs. Requires immediate markdown action.' },
                { severity: 'High', text: 'Weeks of cover at 14.2 vs 10-12 target -- excess inventory tying up working capital.' },
                { severity: 'High', text: '5 delayed POs worth GHS 62.7K -- potential OOS risk for fast movers if not resolved.' },
                { severity: 'Medium', text: 'Blazers sell-through at 58% -- weakest performing category. Review assortment.' },
                { severity: 'Medium', text: '126 out of stock items (+18 vs last month) -- lost sales opportunity increasing.' },
              ].map((risk, i) => (
                <div key={i} className={`flex items-start gap-2 text-xs p-2.5 rounded-lg border ${
                  risk.severity === 'Critical' ? 'border-red-500/30 bg-red-500/10'
                  : risk.severity === 'High' ? 'border-red-500/20 bg-red-500/5'
                  : 'border-yellow-500/20 bg-yellow-500/5'
                }`}>
                  <StatusBadge status={risk.severity} />
                  <span className="text-gray-300">{risk.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
