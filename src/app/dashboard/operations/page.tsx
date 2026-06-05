'use client';

import DashboardHeader from '@/components/layout/DashboardHeader';
import KPICard from '@/components/ui/KPICard';
import Section from '@/components/ui/Section';
import StatusBadge from '@/components/ui/StatusBadge';
import ScoreGauge from '@/components/ui/ScoreGauge';
import ProgressBar from '@/components/ui/ProgressBar';
import { SimpleBarChart, SimpleDonutChart } from '@/components/charts/Charts';
import { operationsData } from '@/lib/data';

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

const d = operationsData;

function scoreColor(v: number): 'green' | 'yellow' | 'red' {
  if (v >= 90) return 'green';
  if (v >= 70) return 'yellow';
  return 'red';
}

function scoreCellClass(v: number): string {
  if (v >= 90) return 'text-green-400';
  if (v >= 70) return 'text-yellow-400';
  return 'text-red-400';
}

function priorityColor(p: string): string {
  const l = p.toLowerCase();
  if (l === 'critical') return 'text-red-400';
  if (l === 'high') return 'text-orange-400';
  if (l === 'medium') return 'text-yellow-400';
  return 'text-gray-400';
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default function OperationsPage() {
  const totalDeployments = d.deployment.categories.reduce((s, c) => s + c.planned, 0);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* HEADER */}
      <DashboardHeader
        title="BUSINESS OPERATIONS COMMAND CENTER"
        subtitle="EXECUTION EXCELLENCE. OPERATIONAL DISCIPLINE. CUSTOMER EXPERIENCE."
      />

      <div className="p-4 space-y-4">
        {/* ============================================================ */}
        {/*  TOP KPI BAR                                                 */}
        {/* ============================================================ */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <KPICard
            label="Store Operations Score"
            value={`${d.storeOpsScore.pct}%`}
            target={`${d.storeOpsScore.target}%`}
            change={d.storeOpsScore.pct - d.storeOpsScore.target}
            changeLabel="pp"
            status={scoreColor(d.storeOpsScore.pct)}
            small
          />
          <KPICard
            label="VM Compliance Score"
            value={`${d.vmCompliance.pct}%`}
            target={`${d.vmCompliance.target}%`}
            change={d.vmCompliance.pct - d.vmCompliance.target}
            changeLabel="pp"
            status={scoreColor(d.vmCompliance.pct)}
            small
          />
          <KPICard
            label="Store Readiness Score"
            value={`${d.storeReadiness.pct}%`}
            target={`${d.storeReadiness.target}%`}
            change={d.storeReadiness.pct - d.storeReadiness.target}
            changeLabel="pp"
            status={scoreColor(d.storeReadiness.pct)}
            small
          />
          <KPICard
            label="Maintenance Compliance"
            value={`${d.maintenanceCompliance.pct}%`}
            target={`${d.maintenanceCompliance.target}%`}
            change={2}
            changeLabel="pp"
            status={scoreColor(d.maintenanceCompliance.pct)}
            small
          />
          <KPICard
            label="SOP Compliance"
            value={`${d.sopCompliance.pct}%`}
            target={`${d.sopCompliance.target}%`}
            change={1}
            changeLabel="pp"
            status={scoreColor(d.sopCompliance.pct)}
            small
          />
          <KPICard
            label="Customer Experience Score"
            value={`${d.cxScore.pct}%`}
            target={`${d.cxScore.target}%`}
            change={d.cxScore.pct - d.cxScore.target}
            changeLabel="pp"
            status={scoreColor(d.cxScore.pct)}
            small
          />
          <KPICard
            label="Open Issues"
            value={d.openIssues}
            status="red"
            small
            icon={
              <span className="flex flex-col text-[0.6rem] leading-tight text-right">
                <span className="text-red-400">13 Critical</span>
                <span className="text-orange-400">7 Immediate</span>
              </span>
            }
          />
        </div>

        {/* ============================================================ */}
        {/*  1 - STORE OPERATIONS OVERVIEW                               */}
        {/* ============================================================ */}
        <Section number={1} title="Store Operations Overview" subtitle="All 7 Stores">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-[#2a2a2a]">
                  <th className="text-left py-2 pr-3">#</th>
                  <th className="text-left py-2 pr-3">Store</th>
                  <th className="text-center py-2 px-2">Operations Score</th>
                  <th className="text-center py-2 px-2">VM Score</th>
                  <th className="text-center py-2 px-2">Readiness</th>
                  <th className="text-center py-2 px-2">CX Score</th>
                </tr>
              </thead>
              <tbody>
                {d.storeOverview.map((s) => (
                  <tr key={s.name} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]/40">
                    <td className="py-2 pr-3 text-gray-500">{s.rank}</td>
                    <td className="py-2 pr-3 font-medium">{s.name}</td>
                    <td className={`py-2 px-2 text-center font-bold ${scoreCellClass(s.opsScore)}`}>{s.opsScore}%</td>
                    <td className={`py-2 px-2 text-center font-bold ${scoreCellClass(s.vmScore)}`}>{s.vmScore}%</td>
                    <td className={`py-2 px-2 text-center font-bold ${scoreCellClass(s.readiness)}`}>{s.readiness}%</td>
                    <td className={`py-2 px-2 text-center font-bold ${scoreCellClass(s.cxScore)}`}>{s.cxScore}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-4 mt-3 text-[0.65rem] text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> &ge;90% On Target</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" /> 70-89% Watch</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> &lt;70% Critical</span>
          </div>
        </Section>

        {/* ============================================================ */}
        {/*  2 - VISUAL MERCHANDISING COMMAND                            */}
        {/* ============================================================ */}
        <Section number={2} title="Visual Merchandising Command">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* VM Compliance by Store */}
            <div className="lg:col-span-2">
              <p className="text-[0.65rem] text-gray-500 uppercase tracking-wider mb-2">VM Compliance % by Store</p>
              <SimpleBarChart
                data={d.vmByStore.map((s) => ({ name: s.store, value: s.compliance }))}
                height={180}
                color="#c8a951"
                horizontal
              />
            </div>

            {/* Gauge + Alerts */}
            <div className="space-y-4">
              <div className="flex flex-col items-center">
                <p className="text-[0.65rem] text-gray-500 uppercase tracking-wider mb-2">VM Checklist Compliance</p>
                <ScoreGauge score={d.vmCompliance.pct} label="Overall" size="lg" color="#c8a951" />
              </div>

              <div>
                <p className="text-[0.65rem] text-gray-500 uppercase tracking-wider mb-2">VM Alerts</p>
                <ul className="space-y-1.5 text-xs">
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 mt-0.5">&#9679;</span>
                    <span>Campaign signage missing in 3 stores</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-400 mt-0.5">&#9679;</span>
                    <span>Mannequin update overdue in 2 stores</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-400 mt-0.5">&#9679;</span>
                    <span>Window display not changed in 4 stores</span>
                  </li>
                </ul>
              </div>

              <div>
                <p className="text-[0.65rem] text-gray-500 uppercase tracking-wider mb-1">Needs Improvement</p>
                <div className="flex flex-wrap gap-1.5">
                  {d.vmByStore.filter((s) => s.compliance < 85).map((s) => (
                    <span key={s.store} className="bg-red-500/10 text-red-400 text-[0.65rem] px-2 py-0.5 rounded-full">{s.store}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* ============================================================ */}
        {/*  3 - MAINTENANCE & FACILITIES                                */}
        {/* ============================================================ */}
        <Section number={3} title="Maintenance & Facilities">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Summary KPIs */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3 text-center">
                  <p className="text-[0.6rem] text-gray-500 uppercase">Open Work Orders</p>
                  <p className="text-xl font-bold text-yellow-400">{d.maintenanceOrders.open}</p>
                </div>
                <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3 text-center">
                  <p className="text-[0.6rem] text-gray-500 uppercase">Completed</p>
                  <p className="text-xl font-bold text-green-400">{d.maintenanceOrders.completed}</p>
                  <p className="text-[0.6rem] text-gray-500">vs last week</p>
                </div>
                <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3 text-center">
                  <p className="text-[0.6rem] text-gray-500 uppercase">Overdue</p>
                  <p className="text-xl font-bold text-red-400">{d.maintenanceOrders.overdue}</p>
                  <p className="text-[0.6rem] text-green-400">-1 vs last week</p>
                </div>
                <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3 text-center">
                  <p className="text-[0.6rem] text-gray-500 uppercase">Critical Orders</p>
                  <p className="text-xl font-bold text-red-400">{d.maintenanceOrders.critical}</p>
                  <p className="text-[0.6rem] text-red-400">Immediate action</p>
                </div>
              </div>

              {/* Facility Condition Index */}
              <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3 flex items-center gap-3">
                <ScoreGauge score={82} label="FCI" size="sm" color="#22c55e" />
                <div>
                  <p className="text-xs font-medium">Facility Condition Index</p>
                  <p className="text-[0.65rem] text-green-400">Good</p>
                </div>
              </div>
            </div>

            {/* Maintenance by Category */}
            <div>
              <p className="text-[0.65rem] text-gray-500 uppercase tracking-wider mb-2">Maintenance by Category</p>
              <SimpleBarChart
                data={[
                  { name: 'Electrical', value: 16 },
                  { name: 'HVAC', value: 12 },
                  { name: 'Plumbing', value: 11 },
                  { name: 'Carpentry', value: 10 },
                ]}
                height={180}
                color="#c8a951"
              />
            </div>

            {/* Preventive Maintenance Calendar (simplified) */}
            <div>
              <p className="text-[0.65rem] text-gray-500 uppercase tracking-wider mb-2">Preventive Maintenance Calendar</p>
              <div className="space-y-2 text-xs">
                {[
                  { task: 'HVAC Filter Replacement', due: 'Jun 7', stores: 'All Stores', status: 'Planned' },
                  { task: 'Fire Extinguisher Inspection', due: 'Jun 10', stores: 'All Stores', status: 'Planned' },
                  { task: 'Electrical Panel Check', due: 'Jun 14', stores: 'Dzorwulu, Labore', status: 'Planned' },
                  { task: 'Pest Control', due: 'Jun 15', stores: 'All Stores', status: 'Planned' },
                ].map((m, i) => (
                  <div key={i} className="flex items-center justify-between bg-[#0a0a0a] border border-[#1a1a1a] rounded p-2">
                    <div>
                      <p className="font-medium">{m.task}</p>
                      <p className="text-[0.6rem] text-gray-500">{m.stores}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[#c8a951]">{m.due}</p>
                      <StatusBadge status={m.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* ============================================================ */}
        {/*  4 - MERCHANDISE DEPLOYMENT                                  */}
        {/* ============================================================ */}
        <Section number={4} title="Merchandise Deployment">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Deployment Gauge */}
            <div className="flex flex-col items-center justify-center">
              <ScoreGauge score={d.deployment.completion} label="Deployment Completion" size="lg" color="#c8a951" />
              <p className="text-xs text-gray-400 mt-2">{totalDeployments} Total Deployments</p>
            </div>

            {/* Deployment by Category table */}
            <div className="lg:col-span-2">
              <p className="text-[0.65rem] text-gray-500 uppercase tracking-wider mb-2">Deployment by Category</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-[#2a2a2a]">
                    <th className="text-left py-2 pr-3">Category</th>
                    <th className="text-center py-2 px-2">Planned</th>
                    <th className="text-center py-2 px-2">Completed</th>
                    <th className="text-center py-2 px-2">Progress</th>
                    <th className="text-center py-2 px-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {d.deployment.categories.map((c) => {
                    const pct = Math.round((c.completed / c.planned) * 100);
                    return (
                      <tr key={c.name} className="border-b border-[#1a1a1a]">
                        <td className="py-2 pr-3 font-medium">{c.name}</td>
                        <td className="py-2 px-2 text-center text-gray-400">{c.planned}</td>
                        <td className="py-2 px-2 text-center">{c.completed}</td>
                        <td className="py-2 px-2 w-32">
                          <ProgressBar value={pct} showLabel />
                        </td>
                        <td className="py-2 px-2 text-center">
                          <StatusBadge status={pct === 100 ? 'On Track' : pct >= 80 ? 'In Progress' : 'At Risk'} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[#2a2a2a] font-bold text-[#c8a951]">
                    <td className="py-2 pr-3">Total</td>
                    <td className="py-2 px-2 text-center">{d.deployment.categories.reduce((s, c) => s + c.planned, 0)}</td>
                    <td className="py-2 px-2 text-center">{d.deployment.categories.reduce((s, c) => s + c.completed, 0)}</td>
                    <td className="py-2 px-2" />
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </Section>

        {/* ============================================================ */}
        {/*  5 - STORE READINESS CHECK                                   */}
        {/* ============================================================ */}
        <Section number={5} title="Store Readiness Check">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Readiness scores */}
            <div>
              <p className="text-[0.65rem] text-gray-500 uppercase tracking-wider mb-3">Readiness Breakdown</p>
              <div className="space-y-3">
                {[
                  { label: 'Opening Readiness', value: 90 },
                  { label: 'Staff Availability', value: 88 },
                  { label: 'Cash & Systems', value: 92 },
                  { label: 'Safety & Security', value: 85 },
                  { label: 'Cleanliness', value: 88 },
                ].map((r) => (
                  <div key={r.label} className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-36 shrink-0">{r.label}</span>
                    <ProgressBar value={r.value} showLabel />
                  </div>
                ))}
              </div>
            </div>

            {/* Readiness Issues table */}
            <div>
              <p className="text-[0.65rem] text-gray-500 uppercase tracking-wider mb-2">Readiness Issues</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-[#2a2a2a]">
                    <th className="text-left py-2 pr-2">Store</th>
                    <th className="text-left py-2 pr-2">Issue</th>
                    <th className="text-center py-2 px-2">Impact</th>
                    <th className="text-center py-2 px-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {d.readinessIssues.map((ri, i) => (
                    <tr key={i} className="border-b border-[#1a1a1a]">
                      <td className="py-2 pr-2">{ri.store}</td>
                      <td className="py-2 pr-2 text-gray-300">{ri.issue}</td>
                      <td className="py-2 px-2 text-center"><StatusBadge status={ri.impact} /></td>
                      <td className="py-2 px-2 text-center"><StatusBadge status={ri.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Section>

        {/* ============================================================ */}
        {/*  6 - CUSTOMER EXPERIENCE & QUALITY                           */}
        {/* ============================================================ */}
        <Section number={6} title="Customer Experience & Quality">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* CX Score by Store */}
            <div>
              <p className="text-[0.65rem] text-gray-500 uppercase tracking-wider mb-2">CX Score by Store</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-[#2a2a2a]">
                    <th className="text-left py-2 pr-2">Store</th>
                    <th className="text-center py-2 px-2">CX Score</th>
                  </tr>
                </thead>
                <tbody>
                  {d.storeOverview.map((s) => (
                    <tr key={s.name} className="border-b border-[#1a1a1a]">
                      <td className="py-1.5 pr-2">{s.name}</td>
                      <td className={`py-1.5 px-2 text-center font-bold ${scoreCellClass(s.cxScore)}`}>{s.cxScore}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Customer Feedback Themes */}
            <div>
              <p className="text-[0.65rem] text-gray-500 uppercase tracking-wider mb-2">Customer Feedback Themes (MTD)</p>
              <SimpleBarChart
                data={d.cxFeedbackThemes.map((t) => ({ name: t.theme, value: t.count }))}
                height={200}
                color="#c8a951"
                horizontal
              />
            </div>

            {/* Resolution Time */}
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-4 text-center w-full">
                <p className="text-[0.65rem] text-gray-500 uppercase tracking-wider">Average Resolution Time</p>
                <p className="text-3xl font-bold text-[#c8a951] mt-1">2.3</p>
                <p className="text-xs text-gray-500">Days</p>
              </div>
              <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-4 text-center w-full">
                <p className="text-[0.65rem] text-gray-500 uppercase tracking-wider">Total Feedback (MTD)</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {d.cxFeedbackThemes.reduce((s, t) => s + t.count, 0)}
                </p>
              </div>
            </div>
          </div>
        </Section>

        {/* ============================================================ */}
        {/*  7 - SOP & COMPLIANCE                                        */}
        {/* ============================================================ */}
        <Section number={7} title="SOP & Compliance">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* SOP Compliance by Area */}
            <div>
              <p className="text-[0.65rem] text-gray-500 uppercase tracking-wider mb-2">SOP Compliance by Area</p>
              <div className="space-y-2.5">
                {d.sopAreas.map((a) => (
                  <div key={a.area} className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-40 shrink-0">{a.area}</span>
                    <ProgressBar value={a.compliance} showLabel />
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Audit Results */}
            <div>
              <p className="text-[0.65rem] text-gray-500 uppercase tracking-wider mb-2">Recent Audit Results</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-[#2a2a2a]">
                    <th className="text-left py-2 pr-2">Store</th>
                    <th className="text-left py-2 pr-2">Area</th>
                    <th className="text-center py-2 px-2">Score</th>
                    <th className="text-center py-2 px-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { store: 'Dzorwulu Men', area: 'Opening Procedures', score: 95, status: 'On Track' },
                    { store: 'East Legon Men', area: 'Cash Handling', score: 88, status: 'On Track' },
                    { store: 'D\'Angelo Palace', area: 'Loss Prevention', score: 72, status: 'At Risk' },
                    { store: 'Woodpeckers', area: 'Customer Service', score: 68, status: 'Off Track' },
                    { store: 'Boulevard Women Labore', area: 'Closing Procedures', score: 78, status: 'At Risk' },
                  ].map((a, i) => (
                    <tr key={i} className="border-b border-[#1a1a1a]">
                      <td className="py-2 pr-2">{a.store}</td>
                      <td className="py-2 pr-2 text-gray-300">{a.area}</td>
                      <td className={`py-2 px-2 text-center font-bold ${scoreCellClass(a.score)}`}>{a.score}%</td>
                      <td className="py-2 px-2 text-center"><StatusBadge status={a.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Section>

        {/* ============================================================ */}
        {/*  8 - RISK & INCIDENT MONITOR                                 */}
        {/* ============================================================ */}
        <Section number={8} title="Risk & Incident Monitor">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Incidents This Month */}
            <div>
              <p className="text-[0.65rem] text-gray-500 uppercase tracking-wider mb-2">Incidents This Month</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3 text-center">
                  <p className="text-[0.6rem] text-gray-500 uppercase">Security</p>
                  <p className="text-lg font-bold text-orange-400">{d.incidents.security}</p>
                </div>
                <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3 text-center">
                  <p className="text-[0.6rem] text-gray-500 uppercase">Safety</p>
                  <p className="text-lg font-bold text-yellow-400">{d.incidents.safety}</p>
                </div>
                <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3 text-center">
                  <p className="text-[0.6rem] text-gray-500 uppercase">Operational</p>
                  <p className="text-lg font-bold text-red-400">{d.incidents.operational}</p>
                </div>
                <div className="bg-[#0a0a0a] border border-[#c8a951]/30 rounded-lg p-3 text-center">
                  <p className="text-[0.6rem] text-gray-500 uppercase">Total</p>
                  <p className="text-lg font-bold text-[#c8a951]">{d.incidents.total}</p>
                </div>
              </div>
            </div>

            {/* Risk Level distribution */}
            <div>
              <p className="text-[0.65rem] text-gray-500 uppercase tracking-wider mb-2">Risk Level Distribution</p>
              <SimpleDonutChart
                data={[
                  { name: 'High', value: d.riskLevel.high },
                  { name: 'Medium', value: d.riskLevel.medium },
                  { name: 'Low', value: d.riskLevel.low },
                ]}
                height={160}
                innerRadius={35}
                outerRadius={55}
                colors={['#ef4444', '#eab308', '#22c55e']}
                centerLabel="Incidents"
                centerValue={String(d.incidents.total)}
              />
              <div className="flex justify-center gap-4 text-[0.65rem] mt-1">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />High: {d.riskLevel.high}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" />Medium: {d.riskLevel.medium}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />Low: {d.riskLevel.low}</span>
              </div>
            </div>

            {/* Top Risks */}
            <div>
              <p className="text-[0.65rem] text-gray-500 uppercase tracking-wider mb-2">Top Risks</p>
              <ul className="space-y-2 text-xs">
                {[
                  { risk: 'AC failure at Woodpeckers affecting customer comfort', level: 'High' },
                  { risk: 'Safe malfunction at D\'Angelo Palace - cash security risk', level: 'High' },
                  { risk: 'Electrical panel aging at Labore Men', level: 'High' },
                  { risk: 'Fire extinguisher inspection overdue - 3 stores', level: 'Medium' },
                  { risk: 'CCTV blind spots identified at 2 stores', level: 'Medium' },
                ].map((r, i) => (
                  <li key={i} className="flex items-start gap-2 bg-[#0a0a0a] border border-[#1a1a1a] rounded p-2">
                    <StatusBadge status={r.level} />
                    <span className="text-gray-300">{r.risk}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        {/* ============================================================ */}
        {/*  ACTION TRACKER                                              */}
        {/* ============================================================ */}
        <Section title="Action Tracker" subtitle="Operations Priority Actions">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-[#2a2a2a]">
                  <th className="text-left py-2 pr-3">Action</th>
                  <th className="text-left py-2 pr-3">Owner</th>
                  <th className="text-left py-2 pr-3">Deadline</th>
                  <th className="text-center py-2 px-2">Priority</th>
                  <th className="text-center py-2 px-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {d.actions.map((a, i) => (
                  <tr key={i} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]/40">
                    <td className="py-2 pr-3 font-medium">{a.action}</td>
                    <td className="py-2 pr-3 text-gray-400">{a.owner}</td>
                    <td className="py-2 pr-3 text-gray-400">{a.deadline}</td>
                    <td className={`py-2 px-2 text-center font-bold ${priorityColor(a.priority)}`}>{a.priority}</td>
                    <td className="py-2 px-2 text-center"><StatusBadge status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </div>
  );
}
