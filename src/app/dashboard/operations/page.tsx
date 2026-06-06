'use client';

import DashboardHeader from '@/components/layout/DashboardHeader';
import KPICard from '@/components/ui/KPICard';
import Section from '@/components/ui/Section';
import EmptyState from '@/components/ui/EmptyState';
import RecentEntries from '@/components/ui/RecentEntries';
import { SimpleBarChart, SimpleDonutChart } from '@/components/charts/Charts';
import { useMetrics } from '@/lib/api';

const pct = (n: number) => (n ? `${n}%` : '—');
const score = (v: number): 'green' | 'yellow' | 'red' => (v >= 90 ? 'green' : v >= 70 ? 'yellow' : 'red');

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
  storeScores: { store: string; ops: number; vm: number; readiness: number; cx: number }[];
  risk: { high: number; medium: number; low: number };
}

export default function OperationsPage() {
  const { data: m } = useMetrics<OperationsLive>('operations');
  const vmByStore = m?.vmByStore ?? [];
  const storeScores = m?.storeScores ?? [];
  const risk = m?.risk ?? { high: 0, medium: 0, low: 0 };
  const incidentsTotal = m?.incidentsTotal ?? 0;

  return (
    <div className="bg-[#0a0a0a] min-h-screen text-white">
      <DashboardHeader
        title="OPERATIONS COMMAND CENTER"
        subtitle="EXECUTION EXCELLENCE. OPERATIONAL DISCIPLINE. CUSTOMER EXPERIENCE."
        mission="Operations Mission"
        missionDetail="Consistent, compliant, customer-ready stores every day."
      />

      <div className="px-6 py-4">
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

        <Section number={2} title="Store Audit Scores">
          {storeScores.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#2a2a2a] text-gray-500">
                    <th className="text-left py-2 pr-3 font-medium">Store</th>
                    <th className="text-right py-2 px-3 font-medium">Ops</th>
                    <th className="text-right py-2 px-3 font-medium">VM</th>
                    <th className="text-right py-2 px-3 font-medium">Readiness</th>
                    <th className="text-right py-2 px-3 font-medium">CX</th>
                  </tr>
                </thead>
                <tbody>
                  {storeScores.map((s) => (
                    <tr key={s.store} className="border-b border-[#1a1a1a]">
                      <td className="py-2 pr-3">{s.store}</td>
                      <td className="py-2 px-3 text-right">{s.ops || '—'}</td>
                      <td className="py-2 px-3 text-right">{s.vm || '—'}</td>
                      <td className="py-2 px-3 text-right">{s.readiness || '—'}</td>
                      <td className="py-2 px-3 text-right">{s.cx || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="No store audits yet" hint="Submit Store Audit in the Operations form." height={140} />
          )}
        </Section>

        <Section number={3} title="Recent Entries">
          <RecentEntries department="operations" />
        </Section>
      </div>
    </div>
  );
}
