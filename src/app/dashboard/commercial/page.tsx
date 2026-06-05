'use client';

import { commercialData } from '@/lib/data';
import DashboardHeader from '@/components/layout/DashboardHeader';
import KPICard from '@/components/ui/KPICard';
import Section from '@/components/ui/Section';
import StatusBadge from '@/components/ui/StatusBadge';
import ProgressBar from '@/components/ui/ProgressBar';
import ScoreGauge from '@/components/ui/ScoreGauge';
import { SimpleBarChart, SimpleDonutChart } from '@/components/charts/Charts';

const fmt = (n: number) => 'GHS ' + n.toLocaleString();
const pct = (v: number, t: number) => ((v / t) * 100).toFixed(1);
const diff = (v: number, t: number) => v - t;
const ppDiff = (v: number, t: number) => (v - t).toFixed(1);

const d = commercialData;

/* Derived values */
const groupSalesPct = parseFloat(pct(d.groupSales.mtd, d.groupSales.target));
const ytdSales = 3245781;
const ytdPct = 64.9;

/* Stock aging breakdown for Merchandise Productivity */
const stockAging = [
  { name: '0-30d', value: 18.6 },
  { name: '31-60d', value: 22.4 },
  { name: '61-90d', value: 21.3 },
  { name: '91-180d', value: 26.0 },
  { name: '180+d', value: 11.9 },
];

/* Sell-through by category for donut */
const sellThroughByCategory = [
  { name: 'Suits', value: 71.2 },
  { name: 'Shoes', value: 72.5 },
  { name: 'Shirts', value: 66.1 },
  { name: 'Blazers', value: 58.0 },
  { name: 'Bags', value: 70.3 },
  { name: 'Others', value: 64.6 },
];

/* Deployment by store compliance */
const deploymentCompliance = [
  { name: 'Dzorwulu Men', value: 95 },
  { name: 'East Legon Men', value: 88 },
  { name: 'Labore Men', value: 86 },
  { name: 'Blvd W Labore', value: 82 },
  { name: 'Blvd W Dzorwulu', value: 78 },
  { name: "D'Angelo", value: 71 },
  { name: 'Woodpeckers', value: 68 },
];

/* Promo calendar */
const promoCalendar = [
  { event: "Father's Day Sale", dates: '10-20 Jun', type: 'Promotion', status: 'Planned' },
  { event: 'End of Season Clearance', dates: '25 Jun - 10 Jul', type: 'Markdown', status: 'Planned' },
  { event: 'Arbiter Launch Promo', dates: '01-15 Jun', type: 'Launch', status: 'In Progress' },
  { event: 'VIP Preview Night', dates: '12 Jun', type: 'Event', status: 'Planned' },
];

/* Insights */
const insights = {
  key: [
    'Dzorwulu Men leads in absolute sales but trending -18.2% vs last month - investigate traffic drop.',
    'Woodpeckers showing strongest momentum at +24.3% vs LM driven by new street campaign.',
    'Suits category dominates sales mix at 20.4% but sell-through at 66.7% leaves margin on the table.',
    'ATV at GHS 1,116 is 7% below target - upsell and cross-sell training needed across stores.',
  ],
  risks: [
    'Boulevard Women stores underperforming significantly - combined ACH% below 50%.',
    'Dead stock at GHS 142,000 (11.9% of inventory) tying up working capital.',
    'Conversion rate at 24.7% vs 28% target - 3.3pp gap across all stores.',
    'Weeks of cover at 14.2 vs target 10-12 indicates overstocking risk.',
  ],
  opportunities: [
    'Cucinera Fiorentina new arrivals showing 71% sell-through - consider reorder.',
    'Arbiter Collection driving strong performance - expand marketing push.',
    'D\'Angelo Palace up +11.5% vs LM - capitalize on momentum with focused campaigns.',
    'Low UPT (1.16 vs 1.25) presents clear opportunity through outfit bundling.',
  ],
};

/* Helper: top performing store & store needing attention */
const sortedStores = [...d.stores].sort((a, b) => b.achievement - a.achievement);
const topStore = sortedStores[0].name;
const bottomStore = sortedStores[sortedStores.length - 1].name;

export default function CommercialPage() {
  return (
    <div className="bg-[#0a0a0a] min-h-screen text-white">
      <DashboardHeader
        title="COMMERCIAL COMMAND CENTER"
        subtitle="MERCHANDISE TO MONEY COMMAND"
        mission="Commercial Mission"
        missionDetail="Right Product, Right Store. Right Price, Right Time. Every Time."
      />

      <div className="p-4 space-y-4">
        {/* ─── TOP KPI BAR ─── */}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
          <KPICard
            label="Group Sales MTD"
            value={fmt(d.groupSales.mtd)}
            target={fmt(d.groupSales.target)}
            change={groupSalesPct - 100}
            changeLabel="%"
            status={groupSalesPct >= 80 ? 'green' : groupSalesPct >= 60 ? 'yellow' : 'red'}
            small
          />
          <KPICard
            label="Group Sales YTD"
            value={fmt(ytdSales)}
            change={ytdPct - 100}
            changeLabel="%"
            status={ytdPct >= 80 ? 'green' : ytdPct >= 60 ? 'yellow' : 'red'}
            small
          />
          <KPICard
            label="Gross Margin %"
            value={`${d.grossMargin.pct}%`}
            target={`${d.grossMargin.target}%`}
            change={parseFloat(ppDiff(d.grossMargin.pct, d.grossMargin.target))}
            changeLabel="pp"
            status={d.grossMargin.pct >= d.grossMargin.target ? 'green' : d.grossMargin.pct >= d.grossMargin.target - 1 ? 'yellow' : 'red'}
            small
          />
          <KPICard
            label="ATV"
            value={fmt(d.atv.value)}
            target={fmt(d.atv.target)}
            change={parseFloat(((d.atv.value - d.atv.target) / d.atv.target * 100).toFixed(1))}
            changeLabel="%"
            status={d.atv.value >= d.atv.target ? 'green' : d.atv.value >= d.atv.target * 0.95 ? 'yellow' : 'red'}
            small
          />
          <KPICard
            label="UPT"
            value={d.upt.value}
            target={d.upt.target}
            change={parseFloat(((d.upt.value - d.upt.target) / d.upt.target * 100).toFixed(1))}
            changeLabel="%"
            status={d.upt.value >= d.upt.target ? 'green' : 'red'}
            small
          />
          <KPICard
            label="Conversion Rate"
            value={`${d.conversionRate.pct}%`}
            target={`${d.conversionRate.target}%`}
            change={parseFloat(ppDiff(d.conversionRate.pct, d.conversionRate.target))}
            changeLabel="pp"
            status={d.conversionRate.pct >= d.conversionRate.target ? 'green' : d.conversionRate.pct >= d.conversionRate.target - 3 ? 'yellow' : 'red'}
            small
          />
          <KPICard
            label="Sell Through %"
            value={`${d.sellThrough.pct}%`}
            target={`${d.sellThrough.target}%`}
            change={parseFloat(ppDiff(d.sellThrough.pct, d.sellThrough.target))}
            changeLabel="pp"
            status={d.sellThrough.pct >= d.sellThrough.target ? 'green' : d.sellThrough.pct >= d.sellThrough.target - 5 ? 'yellow' : 'red'}
            small
          />
          <KPICard
            label="Active SKU"
            value={d.activeSku.toLocaleString()}
            change={5.4}
            changeLabel="%"
            status="green"
            small
          />
        </div>

        {/* ─── 1. STORE BATTLEFIELD ─── */}
        <Section number={1} title="Store Battlefield" subtitle="Performance by Location">
          <div className="flex gap-2 mb-3">
            <span className="bg-green-500/20 text-green-400 text-[0.65rem] px-2 py-0.5 rounded-full font-medium">
              Top Performing: {topStore}
            </span>
            <span className="bg-red-500/20 text-red-400 text-[0.65rem] px-2 py-0.5 rounded-full font-medium">
              Needs Attention: {bottomStore}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#2a2a2a] text-gray-500 text-left">
                  <th className="py-2 pr-2">#</th>
                  <th className="py-2 pr-4">Store</th>
                  <th className="py-2 pr-4 text-right">Sales</th>
                  <th className="py-2 pr-4 text-right">Target</th>
                  <th className="py-2 pr-4 text-right">ACH%</th>
                  <th className="py-2 pr-4 text-right">ATV</th>
                  <th className="py-2 pr-4 text-right">UPT</th>
                  <th className="py-2 pr-4 text-right">Conv%</th>
                  <th className="py-2 text-right">vs LM</th>
                </tr>
              </thead>
              <tbody>
                {d.stores.map((store) => {
                  const isTop = store.name === topStore;
                  const isBottom = store.name === bottomStore;
                  /* Simulated per-store ATV/UPT/Conv based on ranking */
                  const storeAtv = Math.round(1116 + (store.achievement - 65) * 8);
                  const storeUpt = parseFloat((1.16 + (store.achievement - 65) * 0.01).toFixed(2));
                  const storeConv = parseFloat((24.7 + (store.achievement - 65) * 0.3).toFixed(1));
                  return (
                    <tr
                      key={store.rank}
                      className={`border-b border-[#1a1a1a] hover:bg-[#1a1a1a]/50 transition-colors ${
                        isTop ? 'bg-green-500/5' : isBottom ? 'bg-red-500/5' : ''
                      }`}
                    >
                      <td className="py-2 pr-2 text-gray-500">{store.rank}</td>
                      <td className="py-2 pr-4 font-medium">
                        {store.name}
                        {isTop && <span className="ml-2 text-green-400 text-[0.6rem]">★</span>}
                        {isBottom && <span className="ml-2 text-red-400 text-[0.6rem]">⚠</span>}
                      </td>
                      <td className="py-2 pr-4 text-right font-medium">{fmt(store.sales)}</td>
                      <td className="py-2 pr-4 text-right text-gray-500">{fmt(store.target)}</td>
                      <td className="py-2 pr-4 text-right">
                        <span className={store.achievement >= 75 ? 'text-green-400' : store.achievement >= 60 ? 'text-yellow-400' : 'text-red-400'}>
                          {store.achievement}%
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-right text-gray-300">{fmt(storeAtv)}</td>
                      <td className="py-2 pr-4 text-right text-gray-300">{storeUpt}</td>
                      <td className="py-2 pr-4 text-right text-gray-300">{storeConv}%</td>
                      <td className="py-2 text-right">
                        <span className={(store.vsLastMonth ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {(store.vsLastMonth ?? 0) >= 0 ? '+' : ''}{store.vsLastMonth ?? 0}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ─── 2. CATEGORY COMMAND ─── */}
        <Section number={2} title="Category Command" subtitle="Sales by Category">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#2a2a2a] text-gray-500 text-left">
                    <th className="py-2 pr-4">Category</th>
                    <th className="py-2 pr-4 text-right">Sales</th>
                    <th className="py-2 pr-4 text-right">ACH%</th>
                    <th className="py-2 pr-4 text-right">GM%</th>
                    <th className="py-2 min-w-[120px]">Sales Mix</th>
                  </tr>
                </thead>
                <tbody>
                  {d.categories.map((cat) => {
                    /* Simulated GM% per category */
                    const gmPct = (47.8 + (cat.achievement - 60) * 0.15).toFixed(1);
                    return (
                      <tr key={cat.name} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]/50 transition-colors">
                        <td className="py-2 pr-4 font-medium">{cat.name}</td>
                        <td className="py-2 pr-4 text-right">{fmt(cat.sales)}</td>
                        <td className="py-2 pr-4 text-right">
                          <span className={cat.achievement >= 70 ? 'text-green-400' : cat.achievement >= 55 ? 'text-yellow-400' : 'text-red-400'}>
                            {cat.achievement}%
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-right text-gray-300">{gmPct}%</td>
                        <td className="py-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-[#2a2a2a] rounded-full h-3 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-[#c8a951]"
                                style={{ width: `${(cat.mix / 25) * 100}%` }}
                              />
                            </div>
                            <span className="text-gray-400 min-w-[2rem] text-right">{cat.mix}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div>
              <h4 className="text-xs text-gray-400 mb-2 uppercase tracking-wider">Category Sales Mix</h4>
              <SimpleBarChart
                data={d.categories.map(c => ({ name: c.name, value: c.sales }))}
                height={220}
                color="#c8a951"
                prefix="GHS "
              />
            </div>
          </div>
        </Section>

        {/* ─── 3. MERCHANDISE PRODUCTIVITY ─── */}
        <Section number={3} title="Merchandise Productivity" subtitle="Inventory Efficiency">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3 text-center">
              <div className="text-[0.65rem] text-gray-400 uppercase tracking-wider mb-1">Sell Through %</div>
              <div className="text-xl font-bold text-yellow-400">{d.sellThrough.pct}%</div>
              <div className="text-[0.6rem] text-gray-500">Target: {d.sellThrough.target}%</div>
            </div>
            <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3 text-center">
              <div className="text-[0.65rem] text-gray-400 uppercase tracking-wider mb-1">Weeks of Cover</div>
              <div className="text-xl font-bold text-red-400">14.2</div>
              <div className="text-[0.6rem] text-gray-500">Target: 10-12</div>
            </div>
            <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3 text-center">
              <div className="text-[0.65rem] text-gray-400 uppercase tracking-wider mb-1">GMROI</div>
              <div className="text-xl font-bold text-yellow-400">2.48</div>
              <div className="text-[0.6rem] text-gray-500">Target: 3.0</div>
            </div>
            <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3 text-center">
              <div className="text-[0.65rem] text-gray-400 uppercase tracking-wider mb-1">Stock Turn</div>
              <div className="text-xl font-bold text-yellow-400">2.7x</div>
              <div className="text-[0.6rem] text-gray-500">Target: 3.5x</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h4 className="text-xs text-gray-400 mb-2 uppercase tracking-wider">Sell Through by Category</h4>
              <SimpleDonutChart
                data={sellThroughByCategory}
                height={180}
                innerRadius={40}
                outerRadius={60}
                centerValue="68.3%"
                centerLabel="Avg ST%"
              />
              <div className="grid grid-cols-2 gap-1 mt-2">
                {sellThroughByCategory.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-1 text-[0.6rem]">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ['#c8a951', '#22c55e', '#3b82f6', '#ef4444', '#eab308', '#8b5cf6'][i] }} />
                    <span className="text-gray-400">{item.name}</span>
                    <span className="text-gray-300 ml-auto">{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-xs text-gray-400 mb-2 uppercase tracking-wider">Stock Aging Breakdown</h4>
              <SimpleBarChart
                data={stockAging}
                height={180}
                color="#c8a951"
              />
              <div className="mt-2 text-[0.6rem] text-gray-500 text-center">
                % of inventory by age bucket
              </div>
            </div>
            <div className="flex flex-col items-center justify-center">
              <h4 className="text-xs text-gray-400 mb-3 uppercase tracking-wider">Dead Stock Value</h4>
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center w-full">
                <div className="text-2xl font-bold text-red-400">GHS 142,000</div>
                <div className="text-xs text-red-300 mt-1">11.9% of Inventory</div>
                <div className="mt-3">
                  <ProgressBar value={11.9} max={100} color="#ef4444" height={6} showLabel />
                </div>
                <div className="text-[0.6rem] text-gray-500 mt-2">Target: &lt; 8% of inventory</div>
              </div>
            </div>
          </div>
        </Section>

        {/* ─── 4. SKU PERFORMANCE ─── */}
        <Section number={4} title="SKU Performance" subtitle="Product-Level Detail">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Top Selling */}
            <div>
              <h4 className="text-xs text-[#c8a951] mb-2 uppercase tracking-wider font-bold">Top Selling SKUs (MTD)</h4>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#2a2a2a] text-gray-500 text-left">
                    <th className="py-1.5 pr-2">#</th>
                    <th className="py-1.5 pr-2">SKU</th>
                    <th className="py-1.5 pr-2">Name</th>
                    <th className="py-1.5 text-right">Sales</th>
                    <th className="py-1.5 text-right">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {d.topSelling.map((item) => (
                    <tr key={item.sku} className="border-b border-[#1a1a1a]">
                      <td className="py-1.5 pr-2 text-gray-500">{item.rank}</td>
                      <td className="py-1.5 pr-2 text-[#c8a951] font-mono">{item.sku}</td>
                      <td className="py-1.5 pr-2 text-gray-300 truncate max-w-[140px]">{item.name}</td>
                      <td className="py-1.5 text-right font-medium">{fmt(item.sales)}</td>
                      <td className="py-1.5 text-right text-gray-400">{item.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Low Moving */}
            <div>
              <h4 className="text-xs text-yellow-400 mb-2 uppercase tracking-wider font-bold">Low Moving SKUs (60-180 days)</h4>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#2a2a2a] text-gray-500 text-left">
                    <th className="py-1.5 pr-2">SKU</th>
                    <th className="py-1.5 pr-2">Description</th>
                    <th className="py-1.5 text-right">Days</th>
                    <th className="py-1.5 text-right">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {d.lowMoving.map((item) => (
                    <tr key={item.sku} className="border-b border-[#1a1a1a]">
                      <td className="py-1.5 pr-2 text-yellow-400 font-mono text-[0.65rem]">{item.sku}</td>
                      <td className="py-1.5 pr-2 text-gray-300 truncate max-w-[120px]">{item.description}</td>
                      <td className="py-1.5 text-right text-yellow-400">{item.days}d</td>
                      <td className="py-1.5 text-right text-gray-400">{fmt(item.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Dead Stock */}
            <div>
              <h4 className="text-xs text-red-400 mb-2 uppercase tracking-wider font-bold">Dead Stock (180+ days)</h4>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#2a2a2a] text-gray-500 text-left">
                    <th className="py-1.5 pr-2">SKU</th>
                    <th className="py-1.5 pr-2">Description</th>
                    <th className="py-1.5 text-right">Days</th>
                    <th className="py-1.5 text-right">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {d.deadStock.map((item) => (
                    <tr key={item.sku} className="border-b border-[#1a1a1a]">
                      <td className="py-1.5 pr-2 text-red-400 font-mono text-[0.65rem]">{item.sku}</td>
                      <td className="py-1.5 pr-2 text-gray-300 truncate max-w-[120px]">{item.description}</td>
                      <td className="py-1.5 text-right text-red-400">{item.days}d</td>
                      <td className="py-1.5 text-right text-gray-400">{fmt(item.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Section>

        {/* ─── 5. NEW ARRIVALS & DEPLOYMENT ─── */}
        <Section number={5} title="New Arrivals & Deployment" subtitle="Latest Stock">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <h4 className="text-xs text-gray-400 mb-2 uppercase tracking-wider">Recent Arrivals</h4>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#2a2a2a] text-gray-500 text-left">
                    <th className="py-2 pr-4">Brand</th>
                    <th className="py-2 pr-4 text-right">Qty</th>
                    <th className="py-2 pr-4 text-right">Stock Value</th>
                    <th className="py-2">Sell Through</th>
                  </tr>
                </thead>
                <tbody>
                  {d.newArrivals.map((item) => (
                    <tr key={item.brand} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]/50 transition-colors">
                      <td className="py-2 pr-4 font-medium">{item.brand}</td>
                      <td className="py-2 pr-4 text-right text-gray-300">{item.qty}</td>
                      <td className="py-2 pr-4 text-right text-gray-300">{fmt(item.stockValue)}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <ProgressBar value={item.sellThrough} max={100} height={5} />
                          <span className="text-gray-400 min-w-[2.5rem] text-right">{item.sellThrough}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h4 className="text-xs text-gray-400 mb-2 uppercase tracking-wider">Deployment by Store Compliance</h4>
              <SimpleBarChart
                data={deploymentCompliance}
                height={220}
                horizontal
                color="#c8a951"
              />
            </div>
          </div>
        </Section>

        {/* ─── 6. COMMERCIAL ACTION CENTER ─── */}
        <Section number={6} title="Commercial Action Center" subtitle="Focus & Promos">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <h4 className="text-xs text-gray-400 mb-2 uppercase tracking-wider">Focus Products</h4>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#2a2a2a] text-gray-500 text-left">
                    <th className="py-2 pr-4">Product / Collection</th>
                    <th className="py-2 pr-4">Action</th>
                    <th className="py-2 pr-4">Owner</th>
                    <th className="py-2 pr-4">Deadline</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {d.focusProducts.map((item) => (
                    <tr key={item.name} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]/50 transition-colors">
                      <td className="py-2 pr-4 font-medium text-[#c8a951]">{item.name}</td>
                      <td className="py-2 pr-4 text-gray-300">{item.action}</td>
                      <td className="py-2 pr-4 text-gray-400">{item.owner}</td>
                      <td className="py-2 pr-4 text-gray-400">{item.deadline}</td>
                      <td className="py-2"><StatusBadge status={item.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h4 className="text-xs text-gray-400 mb-2 uppercase tracking-wider">Pricing & Promo Calendar</h4>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#2a2a2a] text-gray-500 text-left">
                    <th className="py-2 pr-4">Event</th>
                    <th className="py-2 pr-4">Dates</th>
                    <th className="py-2 pr-4">Type</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {promoCalendar.map((item) => (
                    <tr key={item.event} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]/50 transition-colors">
                      <td className="py-2 pr-4 font-medium">{item.event}</td>
                      <td className="py-2 pr-4 text-gray-400">{item.dates}</td>
                      <td className="py-2 pr-4">
                        <span className={`text-[0.65rem] px-2 py-0.5 rounded-full font-medium ${
                          item.type === 'Promotion' ? 'bg-blue-500/20 text-blue-400' :
                          item.type === 'Markdown' ? 'bg-red-500/20 text-red-400' :
                          item.type === 'Launch' ? 'bg-green-500/20 text-green-400' :
                          'bg-purple-500/20 text-purple-400'
                        }`}>
                          {item.type}
                        </span>
                      </td>
                      <td className="py-2"><StatusBadge status={item.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Section>

        {/* ─── 7. ACCOUNTABILITY BOARD ─── */}
        <Section number={7} title="Accountability Board" subtitle="Team Performance">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#2a2a2a] text-gray-500 text-left">
                  <th className="py-2 pr-4">Role</th>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Key Deliverable</th>
                  <th className="py-2 pr-4 text-right">Target</th>
                  <th className="py-2 pr-4 text-right">Actual</th>
                  <th className="py-2 pr-4 text-right">ACH%</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {d.accountability.map((item) => (
                  <tr key={item.role} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]/50 transition-colors">
                    <td className="py-2.5 pr-4 font-medium text-[#c8a951]">{item.role}</td>
                    <td className="py-2.5 pr-4 text-gray-300">{item.name}</td>
                    <td className="py-2.5 pr-4 text-gray-300">{item.kpi}</td>
                    <td className="py-2.5 pr-4 text-right text-gray-400">{item.target}</td>
                    <td className="py-2.5 pr-4 text-right font-medium">{item.actual}</td>
                    <td className="py-2.5 pr-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <ProgressBar value={item.achievement} max={100} height={4} />
                        <span className={`min-w-[2.5rem] text-right ${
                          item.achievement >= 95 ? 'text-green-400' : item.achievement >= 80 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {item.achievement}%
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5"><StatusBadge status={item.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ─── 8. COMMERCIAL INSIGHTS ─── */}
        <Section number={8} title="Commercial Insights" subtitle="Analysis & Actions">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div>
              <h4 className="text-xs text-[#c8a951] mb-2 uppercase tracking-wider font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#c8a951]" />
                Key Insights
              </h4>
              <ul className="space-y-2">
                {insights.key.map((item, i) => (
                  <li key={i} className="text-xs text-gray-300 flex gap-2">
                    <span className="text-[#c8a951] mt-0.5 shrink-0">&#8226;</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs text-red-400 mb-2 uppercase tracking-wider font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                Risks
              </h4>
              <ul className="space-y-2">
                {insights.risks.map((item, i) => (
                  <li key={i} className="text-xs text-gray-300 flex gap-2">
                    <span className="text-red-400 mt-0.5 shrink-0">&#8226;</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs text-green-400 mb-2 uppercase tracking-wider font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                Opportunities
              </h4>
              <ul className="space-y-2">
                {insights.opportunities.map((item, i) => (
                  <li key={i} className="text-xs text-gray-300 flex gap-2">
                    <span className="text-green-400 mt-0.5 shrink-0">&#8226;</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
