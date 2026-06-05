import { financeData, commercialData, marketingData, operationsData, inventoryData, brandData } from '@/lib/data';
import DashboardHeader from '@/components/layout/DashboardHeader';
import Section from '@/components/ui/Section';
import ExecutiveCharts from './ExecutiveCharts';
import ExecutiveRevenueDonut from './ExecutiveRevenueDonut';

export const metadata = {
  title: 'Executive Command Center | StateStreet Retail Group',
};

/* ------------------------------------------------------------------ */
/*  Helper: format GHS currency                                       */
/* ------------------------------------------------------------------ */
function fmtGHS(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
  return n.toLocaleString();
}

function pctOf(actual: number, target: number) {
  return ((actual / target) * 100).toFixed(1);
}

/* ------------------------------------------------------------------ */
/*  Server Component - Executive Command Center                       */
/* ------------------------------------------------------------------ */
export default function ExecutiveCommandCenter() {
  /* ---- derived data ---- */
  const groupRevenue = financeData.revenue.mtd;
  const revenueTarget = 1_000_000;
  const revenuePct = Number(pctOf(groupRevenue, revenueTarget));

  const grossProfit = 311265;
  const gpTarget = 480_000;
  const gpPct = Number(pctOf(grossProfit, gpTarget));

  const operatingProfit = 96410;
  const opTarget = 150_000;
  const opPct = Number(pctOf(operatingProfit, opTarget));

  const groupGM = commercialData.grossMargin.pct;
  const gmTarget = commercialData.grossMargin.target;

  const sellThrough = commercialData.sellThrough.pct;
  const stTarget = commercialData.sellThrough.target;

  const totalStores = commercialData.stores.length;
  const totalEmployees = 247;

  /* store performance for table */
  const stores = commercialData.stores;

  /* brand health */
  const brandHealthScores = marketingData.brandHealth;

  /* operations */
  const vmCompliance = operationsData.vmCompliance.pct;
  const storeAudit = operationsData.storeOpsScore.pct;
  const maintenanceIssues = operationsData.maintenanceOrders.open;
  const openIssues = operationsData.openIssues;
  const opsAlerts = operationsData.readinessIssues;

  /* categories */
  const categories = commercialData.categories;

  /* campaigns */
  const campaigns = marketingData.campaigns;

  /* sentiment */
  const sentiment = brandData.sentiment;

  /* share of voice */
  const shareOfVoice = brandData.shareOfConversation;

  /* ceo attention items for action tracker */
  const ceoActions = brandData.ceoAttention;

  /* revenue trend chart data */
  const revenueTrendData = financeData.revenue.daily.map((v, i) => ({
    name: financeData.revenue.labels[i],
    value: v,
  }));

  /* GP % trend (simulated monthly) */
  const gpTrendData = [
    { name: 'Dec', value: 45.1 },
    { name: 'Jan', value: 46.0 },
    { name: 'Feb', value: 46.4 },
    { name: 'Mar', value: 47.2 },
    { name: 'Apr', value: 47.5 },
    { name: 'May', value: 47.8 },
  ];

  /* sales vs target bar chart */
  const salesVsTargetData = stores.map((s) => ({
    name: s.name.length > 14 ? s.name.slice(0, 14) + '...' : s.name,
    value: s.sales,
    value2: s.target,
  }));

  /* sentiment donut */
  const sentimentDonut = [
    { name: 'Positive', value: sentiment.positive },
    { name: 'Neutral', value: sentiment.neutral },
    { name: 'Negative', value: sentiment.negative },
  ];

  /* share of voice bar data */
  const sovData = shareOfVoice.slice(0, 6).map((s) => ({
    name: s.brand,
    value: s.pct,
  }));

  /* headcount by department */
  const headcountData = [
    { name: 'Sales Floor', value: 112 },
    { name: 'Operations', value: 45 },
    { name: 'Management', value: 28 },
    { name: 'Marketing', value: 22 },
    { name: 'Finance', value: 18 },
    { name: 'Warehouse', value: 14 },
    { name: 'Admin', value: 8 },
  ];

  /* training completion by topic */
  const trainingData = [
    { name: 'Product Knowledge', value: 92 },
    { name: 'Customer Service', value: 88 },
    { name: 'Cash Handling', value: 85 },
    { name: 'VM Standards', value: 80 },
    { name: 'Loss Prevention', value: 78 },
    { name: 'Leadership', value: 72 },
  ];

  /* store execution summary */
  const storeExecution = operationsData.storeOverview;

  /* executive action tracker */
  const actionTracker = [
    { priority: 'P1', action: 'Boulevard Women turnaround plan', owner: 'Commercial Director', deadline: '07 Jun 2026', status: 'In Progress' },
    { priority: 'P1', action: 'Clear dead stock (GHS 112K tied up)', owner: 'Inventory Director', deadline: 'Immediate', status: 'In Progress' },
    { priority: 'P1', action: 'Fix store conversion rate (24.7% vs 28% target)', owner: 'Store Ops Lead', deadline: '10 Jun 2026', status: 'At Risk' },
    { priority: 'P2', action: 'D\'Angelo brand repositioning', owner: 'Marketing Director', deadline: '14 Jun 2026', status: 'Planned' },
    { priority: 'P2', action: 'Launch Father\'s Day campaign', owner: 'Brand Team', deadline: '10 Jun 2026', status: 'Planned' },
    { priority: 'P2', action: 'Woodpeckers content & digital push', owner: 'Brand Director', deadline: '14 Jun 2026', status: 'In Progress' },
    { priority: 'P3', action: 'Staff training completion to 90%+', owner: 'HR Director', deadline: '30 Jun 2026', status: 'On Track' },
    { priority: 'P3', action: 'Improve NPS from 61 to 70', owner: 'CX Manager', deadline: '30 Jun 2026', status: 'Planned' },
  ];

  /* ---------------------------------------------------------------- */
  /*  Render                                                          */
  /* ---------------------------------------------------------------- */
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <DashboardHeader
        title="EXECUTIVE COMMAND CENTER"
        subtitle="ONE VISION. ONE TEAM. ONE DESTINATION."
        mission="MISSION"
        missionDetail="Build Ghana's most trusted premium retail group."
      />

      <div className="p-4 space-y-4">
        {/* ============================================================ */}
        {/*  TOP KPI BAR                                                 */}
        {/* ============================================================ */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {/* Group Revenue */}
          <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-3">
            <div className="text-[0.65rem] text-gray-400 uppercase tracking-wider">Group Revenue</div>
            <div className="text-lg font-bold text-white mt-1">
              <span className="text-sm text-gray-400">GHS </span>{fmtGHS(groupRevenue)}
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[0.6rem] text-gray-500">Target: 1M</span>
              <span className={`text-[0.6rem] font-semibold ${revenuePct >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>{revenuePct}%</span>
            </div>
            <div className="w-full bg-[#2a2a2a] rounded-full h-1.5 mt-1">
              <div className="h-full rounded-full bg-[#c8a951]" style={{ width: `${Math.min(revenuePct, 100)}%` }} />
            </div>
          </div>

          {/* Gross Profit */}
          <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-3">
            <div className="text-[0.65rem] text-gray-400 uppercase tracking-wider">Gross Profit</div>
            <div className="text-lg font-bold text-white mt-1">
              <span className="text-sm text-gray-400">GHS </span>{fmtGHS(grossProfit)}
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[0.6rem] text-gray-500">Target: 480K</span>
              <span className="text-[0.6rem] font-semibold text-yellow-400">{gpPct}%</span>
            </div>
            <div className="w-full bg-[#2a2a2a] rounded-full h-1.5 mt-1">
              <div className="h-full rounded-full bg-green-500" style={{ width: `${Math.min(Number(gpPct), 100)}%` }} />
            </div>
          </div>

          {/* Operating Profit */}
          <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-3">
            <div className="text-[0.65rem] text-gray-400 uppercase tracking-wider">Operating Profit</div>
            <div className="text-lg font-bold text-white mt-1">
              <span className="text-sm text-gray-400">GHS </span>{fmtGHS(operatingProfit)}
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[0.6rem] text-gray-500">Target: 150K</span>
              <span className="text-[0.6rem] font-semibold text-yellow-400">{opPct}%</span>
            </div>
            <div className="w-full bg-[#2a2a2a] rounded-full h-1.5 mt-1">
              <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(Number(opPct), 100)}%` }} />
            </div>
          </div>

          {/* Group GM% */}
          <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-3">
            <div className="text-[0.65rem] text-gray-400 uppercase tracking-wider">Group GM%</div>
            <div className="text-lg font-bold text-white mt-1">{groupGM}%</div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[0.6rem] text-gray-500">Target: {gmTarget}%</span>
              <span className={`text-[0.6rem] font-semibold ${groupGM >= gmTarget ? 'text-green-400' : 'text-yellow-400'}`}>
                {groupGM >= gmTarget ? 'On Track' : 'Near'}
              </span>
            </div>
            <div className="w-full bg-[#2a2a2a] rounded-full h-1.5 mt-1">
              <div className="h-full rounded-full bg-[#c8a951]" style={{ width: `${(groupGM / 60) * 100}%` }} />
            </div>
          </div>

          {/* Group Sell Through */}
          <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-3">
            <div className="text-[0.65rem] text-gray-400 uppercase tracking-wider">Sell Through</div>
            <div className="text-lg font-bold text-white mt-1">{sellThrough}%</div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[0.6rem] text-gray-500">Target: {stTarget}%</span>
              <span className="text-[0.6rem] font-semibold text-yellow-400">
                {(sellThrough / stTarget * 100).toFixed(0)}%
              </span>
            </div>
            <div className="w-full bg-[#2a2a2a] rounded-full h-1.5 mt-1">
              <div className="h-full rounded-full bg-yellow-500" style={{ width: `${(sellThrough / 100) * 100}%` }} />
            </div>
          </div>

          {/* Active Stores */}
          <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-3">
            <div className="text-[0.65rem] text-gray-400 uppercase tracking-wider">Active Stores</div>
            <div className="text-lg font-bold text-[#c8a951] mt-1">{totalStores}</div>
            <div className="text-[0.6rem] text-gray-500 mt-1">All operational</div>
            <div className="flex gap-1 mt-1.5">
              {Array.from({ length: totalStores }).map((_, i) => (
                <div key={i} className="w-2 h-2 rounded-full bg-green-500" />
              ))}
            </div>
          </div>

          {/* Total Employees */}
          <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-3">
            <div className="text-[0.65rem] text-gray-400 uppercase tracking-wider">Total Employees</div>
            <div className="text-lg font-bold text-[#c8a951] mt-1">{totalEmployees}</div>
            <div className="text-[0.6rem] text-gray-500 mt-1">Across all locations</div>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-[0.6rem] text-green-400">92.3%</span>
              <span className="text-[0.55rem] text-gray-500">attendance</span>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/*  SECTION 1: FINANCIAL HEALTH                                 */}
        {/* ============================================================ */}
        <Section number={1} title="Financial Health" subtitle="Cash, Profit & Balance Sheet Overview">
          {/* Top financial KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3">
              <div className="text-[0.65rem] text-gray-400 uppercase">Cash Position</div>
              <div className="text-xl font-bold text-green-400 mt-1">GHS 2.45M</div>
              <div className="text-[0.6rem] text-gray-500 mt-0.5">Runway: {financeData.cashRunway} days</div>
            </div>
            <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3">
              <div className="text-[0.65rem] text-gray-400 uppercase">Debtors</div>
              <div className="text-xl font-bold text-yellow-400 mt-1">GHS 312K</div>
              <div className="text-[0.6rem] text-red-400 mt-0.5">Overdue: GHS 48K</div>
            </div>
            <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3">
              <div className="text-[0.65rem] text-gray-400 uppercase">Creditors</div>
              <div className="text-xl font-bold text-red-400 mt-1">GHS 1.18M</div>
              <div className="text-[0.6rem] text-gray-500 mt-0.5">Due this week: GHS 220K</div>
            </div>
            <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3">
              <div className="text-[0.65rem] text-gray-400 uppercase">Inventory Value</div>
              <div className="text-xl font-bold text-[#c8a951] mt-1">GHS 8.62M</div>
              <div className="text-[0.6rem] text-gray-500 mt-0.5">Turn Ratio: {financeData.inventoryValue.turnRatio}x</div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3">
              <div className="text-[0.65rem] text-gray-400 uppercase mb-2">Revenue Trend (Daily - MTD)</div>
              <ExecutiveCharts
                type="line"
                data={revenueTrendData}
                height={160}
                color="#c8a951"
                area
              />
            </div>
            <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3">
              <div className="text-[0.65rem] text-gray-400 uppercase mb-2">Revenue by Brand</div>
              <ExecutiveRevenueDonut height={160} />
            </div>
            <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3">
              <div className="text-[0.65rem] text-gray-400 uppercase mb-2">Gross Profit % Trend</div>
              <ExecutiveCharts
                type="line"
                data={gpTrendData}
                height={130}
                color="#22c55e"
              />
              <div className="flex items-center justify-between mt-2 px-1">
                <div>
                  <div className="text-[0.6rem] text-gray-400 uppercase">Operating Expense Ratio</div>
                  <div className="text-lg font-bold text-white">31.2%</div>
                </div>
                <div className="text-right">
                  <div className="text-[0.6rem] text-gray-400 uppercase">Net Margin</div>
                  <div className="text-lg font-bold text-green-400">10.4%</div>
                </div>
              </div>
            </div>
          </div>

          {/* Financial Health Check */}
          <div className="mt-3 grid grid-cols-5 gap-2">
            {Object.entries(financeData.healthCheck).map(([key, val]) => (
              <div key={key} className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-2 text-center">
                <div className="text-[0.6rem] text-gray-400 uppercase">{key}</div>
                <div className={`text-xs font-bold mt-1 ${
                  val === 'Good' || val === 'Positive' || val === 'Low Risk' ? 'text-green-400' : 'text-yellow-400'
                }`}>{val}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* ============================================================ */}
        {/*  SECTION 2: COMMERCIAL HEALTH                                */}
        {/* ============================================================ */}
        <Section number={2} title="Commercial Health" subtitle="Sales, Store & Category Performance">
          {/* Commercial KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3 text-center">
              <div className="text-[0.65rem] text-gray-400 uppercase">ATV</div>
              <div className="text-xl font-bold text-white mt-1">GHS {commercialData.atv.value.toLocaleString()}</div>
              <div className="text-[0.6rem] text-gray-500">Target: {commercialData.atv.target.toLocaleString()}</div>
            </div>
            <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3 text-center">
              <div className="text-[0.65rem] text-gray-400 uppercase">UPT</div>
              <div className="text-xl font-bold text-white mt-1">{commercialData.upt.value}</div>
              <div className="text-[0.6rem] text-gray-500">Target: {commercialData.upt.target}</div>
            </div>
            <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3 text-center">
              <div className="text-[0.65rem] text-gray-400 uppercase">Conversion Rate</div>
              <div className="text-xl font-bold text-yellow-400 mt-1">{commercialData.conversionRate.pct}%</div>
              <div className="text-[0.6rem] text-gray-500">Target: {commercialData.conversionRate.target}%</div>
            </div>
            <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3 text-center">
              <div className="text-[0.65rem] text-gray-400 uppercase">Sell Through</div>
              <div className="text-xl font-bold text-yellow-400 mt-1">{sellThrough}%</div>
              <div className="text-[0.6rem] text-gray-500">Target: {stTarget}%</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Sales vs Target Chart */}
            <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3">
              <div className="text-[0.65rem] text-gray-400 uppercase mb-2">Sales vs Target by Store</div>
              <ExecutiveCharts
                type="bar"
                data={salesVsTargetData}
                height={200}
                color="#c8a951"
                color2="#333"
                prefix="GHS "
              />
            </div>

            {/* Store Performance Table */}
            <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3">
              <div className="text-[0.65rem] text-gray-400 uppercase mb-2">Store Performance</div>
              <div className="overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Store</th>
                      <th className="text-right">Sales (GHS)</th>
                      <th className="text-right">Ach %</th>
                      <th className="text-right">vs LM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stores.map((s) => (
                      <tr key={s.rank} className="hover:bg-[#1a1a1a]">
                        <td className="text-gray-500">{s.rank}</td>
                        <td className="text-xs">{s.name}</td>
                        <td className="text-right text-xs font-medium">{s.sales.toLocaleString()}</td>
                        <td className="text-right">
                          <span className={`text-xs font-medium ${s.achievement >= 70 ? 'text-green-400' : s.achievement >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {s.achievement}%
                          </span>
                        </td>
                        <td className="text-right">
                          <span className={`text-xs ${(s.vsLastMonth ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {(s.vsLastMonth ?? 0) >= 0 ? '+' : ''}{s.vsLastMonth}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Category Performance */}
          <div className="mt-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3">
            <div className="text-[0.65rem] text-gray-400 uppercase mb-2">Category Performance</div>
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th className="text-right">Sales (GHS)</th>
                    <th className="text-right">Achievement</th>
                    <th className="text-right">Sales Mix</th>
                    <th className="w-32">Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((c) => (
                    <tr key={c.name} className="hover:bg-[#1a1a1a]">
                      <td className="text-xs font-medium">{c.name}</td>
                      <td className="text-right text-xs">{c.sales.toLocaleString()}</td>
                      <td className="text-right">
                        <span className={`text-xs font-medium ${c.achievement >= 70 ? 'text-green-400' : c.achievement >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {c.achievement}%
                        </span>
                      </td>
                      <td className="text-right text-xs text-gray-400">{c.mix}%</td>
                      <td>
                        <div className="w-full bg-[#2a2a2a] rounded-full h-1.5">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(c.achievement, 100)}%`,
                              backgroundColor: c.achievement >= 70 ? '#22c55e' : c.achievement >= 50 ? '#eab308' : '#ef4444',
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Section>

        {/* ============================================================ */}
        {/*  SECTION 3: BRAND HEALTH                                     */}
        {/* ============================================================ */}
        <Section number={3} title="Brand Health" subtitle="Brand Equity, Sentiment & Campaign ROI">
          {/* Brand Health Scores */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            {brandHealthScores.map((b) => (
              <div key={b.brand} className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3 flex flex-col items-center">
                <ExecutiveCharts type="gauge" score={b.score} label={b.brand} />
                <div className="flex gap-2 mt-2">
                  <div className="text-center">
                    <div className="text-[0.5rem] text-gray-500">AWR</div>
                    <div className="text-[0.65rem] font-medium">{b.awareness}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[0.5rem] text-gray-500">PREF</div>
                    <div className="text-[0.65rem] font-medium">{b.preference}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[0.5rem] text-gray-500">SENT</div>
                    <div className="text-[0.65rem] font-medium">{b.sentiment}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Brand Sentiment Donut */}
            <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3">
              <div className="text-[0.65rem] text-gray-400 uppercase mb-2">Brand Sentiment</div>
              <ExecutiveCharts
                type="donut"
                data={sentimentDonut}
                height={160}
                centerLabel="Net Score"
                centerValue="+58"
                colors={['#22c55e', '#6b7280', '#ef4444']}
              />
              <div className="flex justify-center gap-4 mt-2">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-[0.6rem] text-gray-400">Positive {sentiment.positive}%</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-gray-500" />
                  <span className="text-[0.6rem] text-gray-400">Neutral {sentiment.neutral}%</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-[0.6rem] text-gray-400">Negative {sentiment.negative}%</span>
                </div>
              </div>
            </div>

            {/* Share of Voice */}
            <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3">
              <div className="text-[0.65rem] text-gray-400 uppercase mb-2">Share of Voice</div>
              <ExecutiveCharts
                type="bar"
                data={sovData}
                height={200}
                color="#c8a951"
                horizontal
              />
            </div>

            {/* Campaign Performance */}
            <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3">
              <div className="text-[0.65rem] text-gray-400 uppercase mb-2">Campaign Performance</div>
              <div className="overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      <th>Campaign</th>
                      <th className="text-right">Reach</th>
                      <th className="text-right">Leads</th>
                      <th className="text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((c) => (
                      <tr key={c.name} className="hover:bg-[#1a1a1a]">
                        <td>
                          <div className="text-xs font-medium">{c.name}</div>
                          <div className="text-[0.6rem] text-gray-500">{c.brand}</div>
                        </td>
                        <td className="text-right text-xs">{(c.reach / 1000).toFixed(0)}K</td>
                        <td className="text-right text-xs text-[#c8a951]">{c.leads}</td>
                        <td className="text-right text-xs font-medium">{(c.revenue / 1000).toFixed(0)}K</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Section>

        {/* ============================================================ */}
        {/*  SECTION 4: OPERATIONS HEALTH                                */}
        {/* ============================================================ */}
        <Section number={4} title="Operations Health" subtitle="Store Execution, VM & Maintenance">
          {/* Operations KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3 text-center">
              <div className="text-[0.65rem] text-gray-400 uppercase">VM Compliance</div>
              <ExecutiveCharts type="gauge" score={vmCompliance} size="md" />
              <div className="text-[0.6rem] text-gray-500 mt-1">Target: 90%</div>
            </div>
            <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3 text-center">
              <div className="text-[0.65rem] text-gray-400 uppercase">Store Audit Score</div>
              <ExecutiveCharts type="gauge" score={storeAudit} size="md" />
              <div className="text-[0.6rem] text-gray-500 mt-1">Target: 90%</div>
            </div>
            <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3 text-center">
              <div className="text-[0.65rem] text-gray-400 uppercase">Maintenance Issues</div>
              <div className="text-2xl font-bold text-red-400 mt-2">{maintenanceIssues}</div>
              <div className="text-[0.6rem] text-gray-500 mt-1">
                <span className="text-red-400">{operationsData.maintenanceOrders.critical} critical</span> / {operationsData.maintenanceOrders.overdue} overdue
              </div>
            </div>
            <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3 text-center">
              <div className="text-[0.65rem] text-gray-400 uppercase">Open Issues</div>
              <div className="text-2xl font-bold text-yellow-400 mt-2">{openIssues}</div>
              <div className="text-[0.6rem] text-gray-500 mt-1">
                <span className="text-red-400">{operationsData.riskLevel.high} high</span> / {operationsData.riskLevel.medium} medium
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Operations Alerts */}
            <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3">
              <div className="text-[0.65rem] text-gray-400 uppercase mb-2">Top Operations Alerts</div>
              <div className="space-y-2">
                {opsAlerts.map((a, i) => (
                  <div key={i} className="flex items-center gap-3 py-1.5 border-b border-[#1a1a1a] last:border-0">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${a.impact === 'High' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{a.issue}</div>
                      <div className="text-[0.6rem] text-gray-500">{a.store}</div>
                    </div>
                    <span className={`text-[0.6rem] px-2 py-0.5 rounded-full ${
                      a.impact === 'High' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                    }`}>{a.impact}</span>
                    <span className={`text-[0.6rem] px-2 py-0.5 rounded-full ${
                      a.status === 'In Progress' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                    }`}>{a.status}</span>
                  </div>
                ))}
                {/* Additional critical alerts */}
                {operationsData.actions.filter(a => a.priority === 'Critical').map((a, i) => (
                  <div key={`critical-${i}`} className="flex items-center gap-3 py-1.5 border-b border-[#1a1a1a] last:border-0">
                    <div className="w-2 h-2 rounded-full flex-shrink-0 bg-red-500 animate-pulse" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{a.action}</div>
                      <div className="text-[0.6rem] text-gray-500">{a.owner} | Due: {a.deadline}</div>
                    </div>
                    <span className="text-[0.6rem] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">Critical</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Store Execution Summary */}
            <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3">
              <div className="text-[0.65rem] text-gray-400 uppercase mb-2">Store Execution Summary</div>
              <div className="overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Store</th>
                      <th className="text-center">Ops</th>
                      <th className="text-center">VM</th>
                      <th className="text-center">Ready</th>
                      <th className="text-center">CX</th>
                    </tr>
                  </thead>
                  <tbody>
                    {storeExecution.map((s) => (
                      <tr key={s.rank} className="hover:bg-[#1a1a1a]">
                        <td className="text-gray-500 text-xs">{s.rank}</td>
                        <td className="text-xs">{s.name}</td>
                        <td className="text-center">
                          <span className={`text-xs font-medium ${s.opsScore >= 85 ? 'text-green-400' : s.opsScore >= 75 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {s.opsScore}
                          </span>
                        </td>
                        <td className="text-center">
                          <span className={`text-xs font-medium ${s.vmScore >= 85 ? 'text-green-400' : s.vmScore >= 75 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {s.vmScore}
                          </span>
                        </td>
                        <td className="text-center">
                          <span className={`text-xs font-medium ${s.readiness >= 85 ? 'text-green-400' : s.readiness >= 75 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {s.readiness}
                          </span>
                        </td>
                        <td className="text-center">
                          <span className={`text-xs font-medium ${s.cxScore >= 85 ? 'text-green-400' : s.cxScore >= 75 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {s.cxScore}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Section>

        {/* ============================================================ */}
        {/*  SECTION 5: PEOPLE HEALTH                                    */}
        {/* ============================================================ */}
        <Section number={5} title="People Health" subtitle="Attendance, Training & Workforce Overview">
          {/* People KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-[#0a0a0a] border border-green-500/30 rounded-lg p-3 text-center">
              <div className="text-[0.65rem] text-gray-400 uppercase">Attendance Rate</div>
              <div className="text-xl font-bold text-green-400 mt-1">92.3%</div>
              <div className="text-[0.6rem] text-gray-500">228 / 247 present today</div>
            </div>
            <div className="bg-[#0a0a0a] border border-green-500/30 rounded-lg p-3 text-center">
              <div className="text-[0.65rem] text-gray-400 uppercase">Training Completion</div>
              <div className="text-xl font-bold text-green-400 mt-1">85%</div>
              <div className="text-[0.6rem] text-gray-500">Target: 90% by month end</div>
            </div>
            <div className="bg-[#0a0a0a] border border-yellow-500/30 rounded-lg p-3 text-center">
              <div className="text-[0.65rem] text-gray-400 uppercase">Active Recruitments</div>
              <div className="text-xl font-bold text-yellow-400 mt-1">8</div>
              <div className="text-[0.6rem] text-gray-500">3 sales, 2 ops, 2 mktg, 1 mgmt</div>
            </div>
            <div className="bg-[#0a0a0a] border border-red-500/30 rounded-lg p-3 text-center">
              <div className="text-[0.65rem] text-gray-400 uppercase">Performance Issues</div>
              <div className="text-xl font-bold text-red-400 mt-1">11</div>
              <div className="text-[0.6rem] text-gray-500">4 on PIP, 7 under review</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Headcount by Department */}
            <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3">
              <div className="text-[0.65rem] text-gray-400 uppercase mb-2">Headcount by Department</div>
              <ExecutiveCharts
                type="bar"
                data={headcountData}
                height={200}
                color="#c8a951"
                horizontal
              />
            </div>

            {/* Training Completion by Topic */}
            <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3">
              <div className="text-[0.65rem] text-gray-400 uppercase mb-3">Training Completion by Topic</div>
              <div className="space-y-3">
                {trainingData.map((t) => (
                  <div key={t.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-300">{t.name}</span>
                      <span className={`text-xs font-medium ${t.value >= 85 ? 'text-green-400' : t.value >= 75 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {t.value}%
                      </span>
                    </div>
                    <div className="w-full bg-[#2a2a2a] rounded-full h-2">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${t.value}%`,
                          backgroundColor: t.value >= 85 ? '#22c55e' : t.value >= 75 ? '#eab308' : '#ef4444',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* ============================================================ */}
        {/*  SECTION 6: EXECUTIVE ACTION TRACKER                         */}
        {/* ============================================================ */}
        <Section number={6} title="Executive Action Tracker" subtitle="Priority Actions Requiring Owner Attention">
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th className="w-12">Priority</th>
                  <th>Action</th>
                  <th>Owner</th>
                  <th>Deadline</th>
                  <th className="text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {actionTracker.map((a, i) => (
                  <tr key={i} className="hover:bg-[#1a1a1a]">
                    <td>
                      <span className={`text-[0.65rem] font-bold px-2 py-0.5 rounded ${
                        a.priority === 'P1' ? 'bg-red-500/20 text-red-400' :
                        a.priority === 'P2' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>{a.priority}</span>
                    </td>
                    <td className="text-xs font-medium">{a.action}</td>
                    <td className="text-xs text-gray-400">{a.owner}</td>
                    <td className="text-xs">
                      <span className={a.deadline === 'Immediate' ? 'text-red-400 font-bold' : 'text-gray-400'}>
                        {a.deadline}
                      </span>
                    </td>
                    <td className="text-center">
                      <span className={`text-[0.65rem] px-2 py-0.5 rounded-full font-medium ${
                        a.status === 'In Progress' ? 'bg-green-500/20 text-green-400' :
                        a.status === 'At Risk' ? 'bg-red-500/20 text-red-400' :
                        a.status === 'On Track' ? 'bg-green-500/20 text-green-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>{a.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* CEO Attention Items from Brand Data */}
          <div className="mt-4 border-t border-[#2a2a2a] pt-3">
            <div className="text-[0.65rem] text-[#c8a951] uppercase font-bold tracking-wider mb-2">Items Requiring CEO / Owner Decision</div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {ceoActions.slice(0, 3).map((item, i) => (
                <div key={i} className={`bg-[#0a0a0a] border rounded-lg p-3 ${
                  item.priority === 'P1' ? 'border-red-500/40' : 'border-yellow-500/30'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[0.6rem] font-bold px-1.5 py-0.5 rounded ${
                      item.priority === 'P1' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                    }`}>{item.priority}</span>
                    <span className="text-xs font-medium">{item.issue}</span>
                  </div>
                  <div className="text-[0.6rem] text-gray-500">{item.impact}</div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[0.6rem] text-gray-400">{item.owner}</span>
                    <span className="text-[0.6rem] text-[#c8a951]">{item.dueDate}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* Footer */}
        <div className="text-center py-4 border-t border-[#1a1a1a]">
          <div className="text-[0.6rem] text-gray-600 uppercase tracking-widest">
            StateStreet Retail Group - Executive Command Center - Confidential
          </div>
          <div className="text-[0.55rem] text-gray-700 mt-1">
            Data refreshed: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} 09:00 AM
          </div>
        </div>
      </div>
    </div>
  );
}
