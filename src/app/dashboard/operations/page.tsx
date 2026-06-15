'use client';

import DashboardHeader from '@/components/layout/DashboardHeader';
import KPICard from '@/components/ui/KPICard';
import Section from '@/components/ui/Section';
import EmptyState from '@/components/ui/EmptyState';
import RecentEntries from '@/components/ui/RecentEntries';
import { SimpleBarChart, SimpleDonutChart } from '@/components/charts/Charts';
import { useState } from 'react';
import PeriodTabs from '@/components/ui/PeriodTabs';
import { useMetrics, type Period } from '@/lib/api';
import BrandedLoader from '@/components/ui/BrandedLoader';
import { useOrg } from '@/components/providers/OrgProvider';

const pct = (n: number) => (n ? `${n}%` : '—');
const score = (v: number): 'green' | 'yellow' | 'red' => (v >= 90 ? 'green' : v >= 70 ? 'yellow' : 'red');
const fmtGHS = (n: number) =>
  !n ? '—' : n >= 1_000_000 ? `GHS ${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `GHS ${(n / 1_000).toFixed(0)}K` : `GHS ${Math.round(n)}`;

interface OperationsLive {
  opsScore: number;
  vmScore: number;
  readiness: number;
  sopCompliance: number;
  cxScore: number;
  maintenanceCompliance: number;
  openIssues: number;
  incidentsTotal: number;
  vmByStore: { name: string; value: number }[];
  storeScores: { store: string; ops: number; vm: number; readiness: number; cx: number; clean: number; safety: number }[];
  keyIssues: { store: string; date: string; issues: string }[];
  risk: { high: number; medium: number; low: number };
  incidentTypes: { name: string; value: number }[];
  incidentsByStore: { name: string; value: number }[];
  vmBreakdown: { name: string; value: number }[];
  topRisks: { description: string; severity: string; store: string; status: string }[];
  priorityActions: { description: string; priority: string; owner: string; store: string; status: string }[];
  cxFeedback: { avgRating: number; avgNps: number; recommendRate: number; count: number };
  peopleHealth: { count: number; attendance: number; punctuality: number; training: number; absences: number; score: number; reasons: { name: string; value: number }[] };
  maintenance: { totalCost: number; openCost: number; overdue: number };
  sopByArea: { name: string; value: number }[];
  sopDeviations: { store: string; area: string; deviations: string; corrective: string }[];
  correctiveRegister: { source: string; store: string; text: string; status: string }[];
}

export default function OperationsPage() {
  const [period, setPeriod] = useState<Period>('mtd');
  const [anchor, setAnchor] = useState('');
  const [store, setStore] = useState('');
  const { org } = useOrg();
  const { data: m, loading } = useMetrics<OperationsLive>('operations', period, anchor, store);
  const vmByStore = m?.vmByStore ?? [];
  const storeScores = m?.storeScores ?? [];
  const risk = m?.risk ?? { high: 0, medium: 0, low: 0 };
  const incidentsTotal = m?.incidentsTotal ?? 0;
  const incidentTypes = m?.incidentTypes ?? [];
  const incidentsByStore = m?.incidentsByStore ?? [];
  const keyIssues = m?.keyIssues ?? [];
  const topRisks = m?.topRisks ?? [];
  const priorityActions = m?.priorityActions ?? [];
  const vmBreakdown = (m?.vmBreakdown ?? []).filter((v) => v.value > 0);
  const cx = m?.cxFeedback ?? { avgRating: 0, avgNps: 0, recommendRate: 0, count: 0 };
  const ph = m?.peopleHealth ?? { count: 0, attendance: 0, punctuality: 0, training: 0, absences: 0, score: 0, reasons: [] };
  const maintenance = m?.maintenance ?? { totalCost: 0, openCost: 0, overdue: 0 };
  const sopByArea = m?.sopByArea ?? [];
  const sopDeviations = m?.sopDeviations ?? [];
  const correctiveRegister = m?.correctiveRegister ?? [];
  const reasonLabel = (v: string) => ({ sick: 'Sick', leave: 'Approved Leave', 'no-show': 'No-show', other: 'Other' }[v] ?? v);

  if (loading && !m) return <BrandedLoader fullScreen />;

  return (
    <div className="bg-[var(--c-bg)] min-h-screen text-[var(--c-fg)]">
      <DashboardHeader
        title="OPERATIONS COMMAND CENTER"
        subtitle="EXECUTION EXCELLENCE. OPERATIONAL DISCIPLINE. CUSTOMER EXPERIENCE."
        mission="Operations Mission"
        missionDetail="Consistent, compliant, customer-ready stores every day."
      />

      <div className="px-6 pt-4 flex justify-end">
        <PeriodTabs value={period} date={anchor} onChange={setPeriod} onDateChange={setAnchor} store={store} stores={org.stores} onStoreChange={setStore} />
      </div>
      <div className="px-6 py-3">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <KPICard label="Store Ops Score" value={pct(m?.opsScore ?? 0)} status={score(m?.opsScore ?? 0)} small />
          <KPICard label="VM Compliance" value={pct(m?.vmScore ?? 0)} status={score(m?.vmScore ?? 0)} small />
          <KPICard label="Store Readiness" value={pct(m?.readiness ?? 0)} status={score(m?.readiness ?? 0)} small />
          <KPICard label="CX Score" value={pct(m?.cxScore ?? 0)} status={score(m?.cxScore ?? 0)} small />
          <KPICard label="SOP Compliance" value={pct(m?.sopCompliance ?? 0)} status={score(m?.sopCompliance ?? 0)} small />
          <KPICard label="Maintenance" value={pct(m?.maintenanceCompliance ?? 0)} status={score(m?.maintenanceCompliance ?? 0)} small />
          <KPICard label="Open Issues" value={String(m?.openIssues ?? 0)} status={(m?.openIssues ?? 0) > 0 ? 'red' : 'green'} small />
        </div>
      </div>

      <div className="px-6 pb-8 space-y-6">
        <Section number={1} title="Visual Merchandising & Risk">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <div className="text-xs text-gray-400 mb-2">VM Compliance by Store</div>
              {vmByStore.length ? (
                <SimpleBarChart data={vmByStore} height={220} color="#c8a951" horizontal />
              ) : (
                <EmptyState message="No VM checks yet" hint="Submit VM Compliance in the Operations form." height={220} />
              )}
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-2">Incident Risk Levels</div>
              {incidentsTotal ? (
                <SimpleDonutChart
                  data={[
                    { name: 'High', value: risk.high },
                    { name: 'Medium', value: risk.medium },
                    { name: 'Low', value: risk.low },
                  ]}
                  height={200}
                  colors={['#ef4444', '#eab308', '#22c55e']}
                  centerLabel="Incidents"
                  centerValue={String(incidentsTotal)}
                />
              ) : (
                <EmptyState message="No incidents logged" hint="Submit Incident Report in the Operations form." height={200} />
              )}
            </div>
          </div>
        </Section>

        <Section number={2} title="Store Standards Scores">
          {storeScores.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--c-border)] text-gray-500">
                    <th className="text-left py-2 pr-3 font-medium">Store</th>
                    <th className="text-right py-2 px-3 font-medium">Ops</th>
                    <th className="text-right py-2 px-3 font-medium">VM</th>
                    <th className="text-right py-2 px-3 font-medium">Readiness</th>
                    <th className="text-right py-2 px-3 font-medium">CX</th>
                    <th className="text-right py-2 px-3 font-medium">Clean &amp; Light</th>
                    <th className="text-right py-2 px-3 font-medium">Safety</th>
                  </tr>
                </thead>
                <tbody>
                  {storeScores.map((s) => (
                    <tr key={s.store} className="border-b border-[var(--c-hover)]">
                      <td className="py-2 pr-3">{s.store}</td>
                      <td className="py-2 px-3 text-right">{s.ops || '—'}</td>
                      <td className="py-2 px-3 text-right">{s.vm || '—'}</td>
                      <td className="py-2 px-3 text-right">{s.readiness || '—'}</td>
                      <td className="py-2 px-3 text-right">{s.cx || '—'}</td>
                      <td className="py-2 px-3 text-right">{s.clean || '—'}</td>
                      <td className="py-2 px-3 text-right">{s.safety || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="No store standards reviews yet" hint="Submit Store Standards in the Operations form." height={140} />
          )}
          {keyIssues.length > 0 && (
            <div className="mt-4">
              <div className="text-xs text-gray-400 mb-2">Key Issues Raised</div>
              <div className="space-y-2">
                {keyIssues.map((k, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs p-2.5 rounded-lg border border-[var(--c-border)] bg-[var(--c-card2)]">
                    <span className="text-gray-300 flex-1">{k.issues}</span>
                    <span className="text-gray-500 whitespace-nowrap">{k.store}</span>
                    <span className="text-gray-600 whitespace-nowrap">{k.date}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>

        <Section number={3} title="Risk & Incident Monitor">
          {incidentTypes.length > 0 && (
            <>
              <div className="text-xs text-gray-400 mb-2">Incidents by Type</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {incidentTypes.map((t) => (
                  <div key={t.name} className="bg-[var(--c-card2)] border border-[var(--c-border)] rounded-lg p-3">
                    <div className="text-[0.65rem] text-gray-500 uppercase tracking-wider">{t.name}</div>
                    <div className="text-lg font-bold text-[#c8a951]">{t.value}</div>
                  </div>
                ))}
              </div>
            </>
          )}
          {incidentsByStore.length > 0 && (
            <div className="mb-4">
              <div className="text-xs text-gray-400 mb-2">Incidents by Store</div>
              <div className="flex flex-wrap gap-2">
                {incidentsByStore.map((s) => (
                  <span key={s.name} className="text-xs bg-[var(--c-card2)] border border-[var(--c-border)] rounded-lg px-3 py-1.5">
                    {s.name} <span className="text-[#c8a951] font-semibold ml-1">{s.value}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="text-xs text-gray-400 mb-2">Top Risks (High / Critical incidents)</div>
          {topRisks.length ? (
            <div className="space-y-2">
              {topRisks.map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-xs p-2.5 rounded-lg border border-red-500/20 bg-red-500/5">
                  <span className="text-red-400 mt-0.5">▲</span>
                  <span className="text-gray-300 flex-1">{r.description}</span>
                  <span className="text-gray-500">{r.store}</span>
                  <span className="text-red-400 uppercase text-[0.6rem]">{r.severity}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="No high-severity incidents" hint="High/critical incidents from the Incident Report form appear here." height={120} />
          )}
        </Section>

        <Section number={4} title="Priority Actions" subtitle="Maintenance">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <KPICard label="Maintenance Spend" value={fmtGHS(maintenance.totalCost)} small />
            <KPICard label="Open / Unspent" value={fmtGHS(maintenance.openCost)} small />
            <KPICard label="Overdue" value={String(maintenance.overdue)} status={maintenance.overdue > 0 ? 'red' : 'green'} small />
          </div>
          {priorityActions.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--c-border)] text-gray-500">
                    <th className="text-left py-2 pr-3 font-medium">Action</th>
                    <th className="text-left py-2 px-3 font-medium">Priority</th>
                    <th className="text-left py-2 px-3 font-medium">Owner</th>
                    <th className="text-left py-2 px-3 font-medium">Store</th>
                    <th className="text-left py-2 pl-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {priorityActions.map((a, i) => (
                    <tr key={i} className="border-b border-[var(--c-hover)]">
                      <td className="py-2 pr-3">{a.description}</td>
                      <td className="py-2 px-3 capitalize">{a.priority || '—'}</td>
                      <td className="py-2 px-3">{a.owner || '—'}</td>
                      <td className="py-2 px-3">{a.store}</td>
                      <td className="py-2 pl-3 capitalize">{a.status || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="No maintenance actions yet" hint="Log maintenance under Store Standards in the Operations form." height={120} />
          )}
        </Section>

        <Section number={5} title="Customer Experience & VM Detail">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-gray-400 mb-2">Customer Experience</div>
              {cx.count ? (
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-[var(--c-card2)] border border-[var(--c-border)] rounded-lg p-3">
                    <div className="text-[0.65rem] text-gray-500 uppercase tracking-wider">Avg Rating</div>
                    <div className="text-lg font-bold">{cx.avgRating || '—'}</div>
                  </div>
                  <div className="bg-[var(--c-card2)] border border-[var(--c-border)] rounded-lg p-3">
                    <div className="text-[0.65rem] text-gray-500 uppercase tracking-wider">NPS</div>
                    <div className="text-lg font-bold">{cx.avgNps || '—'}</div>
                  </div>
                  <div className="bg-[var(--c-card2)] border border-[var(--c-border)] rounded-lg p-3">
                    <div className="text-[0.65rem] text-gray-500 uppercase tracking-wider">Recommend</div>
                    <div className="text-lg font-bold">{cx.recommendRate ? `${cx.recommendRate}%` : '—'}</div>
                  </div>
                </div>
              ) : (
                <EmptyState message="No CX feedback yet" hint="Submit Customer Experience in the Operations form." height={120} />
              )}
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-2">VM Compliance Breakdown</div>
              {vmBreakdown.length ? (
                <SimpleBarChart data={vmBreakdown} height={160} color="#c8a951" horizontal />
              ) : (
                <EmptyState message="No VM checklist data yet" hint="Submit VM Compliance (sub-scores) in the Operations form." height={160} />
              )}
            </div>
          </div>
        </Section>

        <Section number={6} title="People Health" subtitle="HR">
          {ph.count > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <KPICard label="People Health" value={pct(ph.score)} status={score(ph.score)} small />
                <KPICard label="Attendance" value={pct(ph.attendance)} status={score(ph.attendance)} small />
                <KPICard label="Punctuality" value={pct(ph.punctuality)} status={score(ph.punctuality)} small />
                <KPICard label="Training Completion" value={pct(ph.training)} status={score(ph.training)} small />
                <KPICard label="Absences" value={String(ph.absences)} status={ph.absences > 0 ? 'yellow' : 'green'} small />
              </div>
              {ph.reasons.length > 0 && (
                <div>
                  <div className="text-xs text-gray-400 mb-2">Absences by Reason</div>
                  <div className="flex flex-wrap gap-2">
                    {ph.reasons.map((r) => (
                      <span key={r.name} className="text-xs bg-[var(--c-card2)] border border-[var(--c-border)] rounded-lg px-3 py-1.5">
                        {reasonLabel(r.name)} <span className="text-[#c8a951] font-semibold ml-1">{r.value}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <EmptyState message="No HR entries yet" hint="Submit Human Resources in the Operations form." height={120} />
          )}
        </Section>

        <Section number={7} title="SOP Compliance" subtitle="By area">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-gray-400 mb-2">Compliance by Area</div>
              {sopByArea.length ? (
                <SimpleBarChart data={sopByArea} height={220} color="#c8a951" horizontal />
              ) : (
                <EmptyState message="No SOP checks yet" hint="Submit SOP Compliance in the Operations form." height={220} />
              )}
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-2">Deviations Found</div>
              {sopDeviations.length ? (
                <div className="space-y-2">
                  {sopDeviations.map((d, i) => (
                    <div key={i} className="text-xs p-2.5 rounded-lg border border-[var(--c-border)] bg-[var(--c-card2)]">
                      <div className="flex justify-between gap-2 mb-1">
                        <span className="text-[#c8a951]">{d.area}</span>
                        <span className="text-gray-500">{d.store}</span>
                      </div>
                      <div className="text-gray-300">{d.deviations}</div>
                      {d.corrective && <div className="text-gray-500 mt-1">→ {d.corrective}</div>}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState message="No deviations logged" height={160} />
              )}
            </div>
          </div>
        </Section>

        <Section number={8} title="Corrective Action Register">
          {correctiveRegister.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--c-border)] text-gray-500">
                    <th className="text-left py-2 pr-3 font-medium">Source</th>
                    <th className="text-left py-2 pr-3 font-medium">Action / Issue</th>
                    <th className="text-left py-2 px-3 font-medium">Store</th>
                    <th className="text-left py-2 pl-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {correctiveRegister.map((c, i) => (
                    <tr key={i} className="border-b border-[var(--c-hover)]">
                      <td className="py-2 pr-3 text-[#c8a951] whitespace-nowrap">{c.source}</td>
                      <td className="py-2 pr-3 text-gray-300">{c.text}</td>
                      <td className="py-2 px-3 text-gray-500 whitespace-nowrap">{c.store}</td>
                      <td className="py-2 pl-3 capitalize">{c.status || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="No corrective actions logged" hint="Issues from Store Standards, VM, SOP and Incidents appear here." height={120} />
          )}
        </Section>

        <Section number={9} title="Recent Entries">
          <RecentEntries department="operations" />
        </Section>
      </div>
    </div>
  );
}
