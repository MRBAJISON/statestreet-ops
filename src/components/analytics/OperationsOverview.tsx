import { AlertTriangle, ClipboardCheck, Gauge, Hammer, UserCheck } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { AnalyticsMeta, OperationsDomain, TradingOverview } from '@/lib/contracts/analytics';
import { MetricRail, SectionHeading, StatusBadge } from './DashboardPrimitives';
import { ComparisonBarChart, HorizontalBarChart, NamedBarChart } from './Charts';
import { formatCurrency, formatPercent } from './format';
import { TradingSnapshot } from './TradingSnapshot';

export function OperationsOverview({ meta, trading, domain }: { meta: AnalyticsMeta; trading: TradingOverview; domain: OperationsDomain }) {
  return (
    <div className="flex flex-col gap-5">
      <MetricRail items={[
        { label: 'Store standards', value: formatPercent(domain.summary.storeScore), detail: 'Average reviewed score', icon: Gauge, tone: 'green' },
        { label: 'Visual merchandising', value: formatPercent(domain.summary.visualMerchandisingScore), detail: 'Portfolio average', icon: ClipboardCheck, tone: 'teal' },
        { label: 'Open maintenance', value: String(domain.summary.openMaintenance), detail: `${domain.maintenanceSummary.overdue} overdue`, icon: Hammer, tone: 'amber' },
        { label: 'Open incidents', value: String(domain.summary.openIncidents), detail: 'Open or investigating', icon: AlertTriangle, tone: 'coral' },
        { label: 'Attendance', value: formatPercent(domain.summary.attendance), detail: 'Latest store snapshots', icon: UserCheck, tone: 'blue' },
        { label: 'SOP compliance', value: formatPercent(domain.summary.sopCompliance), detail: 'Selected period', icon: ClipboardCheck, tone: 'teal' },
      ]} />

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="surface min-w-0 p-5">
          <SectionHeading title="Visual Merchandising & Risk" description="VM score by store with current risk load" />
          <ComparisonBarChart data={domain.stores.map((store) => ({ name: store.name, primary: store.visualMerchandising, secondary: store.overall }))} primaryLabel="VM" secondaryLabel="Overall" valueFormatter={formatPercent} />
        </section>
        <section className="surface min-w-0 p-5">
          <SectionHeading title="Risk & Incident Monitor" description="Open operational risk by severity and incident type" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <HorizontalBarChart data={domain.riskLevels} />
            <HorizontalBarChart data={domain.incidentTypes} />
          </div>
        </section>
      </div>

      <section className="surface min-w-0 overflow-hidden">
        <div className="p-5 pb-3"><SectionHeading title="Store Standards Scores" description="Operations, visual merchandising, readiness, CX, cleanliness, safety, and attendance" /></div>
        <Table>
          <TableHeader><TableRow><TableHead>Store</TableHead><TableHead className="text-right">Overall</TableHead><TableHead className="text-right">Operations</TableHead><TableHead className="text-right">VM</TableHead><TableHead className="text-right">Readiness</TableHead><TableHead className="text-right">CX</TableHead><TableHead className="text-right">Cleanliness</TableHead><TableHead className="text-right">Safety</TableHead><TableHead className="text-right">Attendance</TableHead></TableRow></TableHeader>
          <TableBody>{domain.stores.map((store) => <TableRow key={store.id}><TableCell className="font-medium">{store.name}</TableCell><TableCell className="text-right font-semibold">{formatPercent(store.overall)}</TableCell><TableCell className="text-right">{formatPercent(store.operations)}</TableCell><TableCell className="text-right">{formatPercent(store.visualMerchandising)}</TableCell><TableCell className="text-right">{formatPercent(store.readiness)}</TableCell><TableCell className="text-right">{formatPercent(store.customerExperience)}</TableCell><TableCell className="text-right">{formatPercent(store.cleanliness)}</TableCell><TableCell className="text-right">{formatPercent(store.safety)}</TableCell><TableCell className="text-right">{formatPercent(store.attendance)}</TableCell></TableRow>)}</TableBody>
        </Table>
      </section>

      <div className="grid gap-5 xl:grid-cols-12">
        <section className="surface p-5 xl:col-span-4">
          <SectionHeading title="Customer Experience" description="Feedback quality and recommendation intent" />
          <div className="mt-5 grid gap-4">
            {[['Customer rating', domain.customerExperience.rating * 20], ['Recommend rate', domain.customerExperience.recommendRate], ['NPS', domain.customerExperience.nps ?? 0]].map(([label, value]) => <div key={String(label)}><div className="mb-2 flex justify-between text-xs"><span className="text-muted-foreground">{label}</span><span className="font-semibold">{formatPercent(Number(value))}</span></div><Progress value={Math.max(0, Number(value))} className="h-2" /></div>)}
          </div>
          <p className="mt-4 border-t pt-4 text-xs text-muted-foreground">Based on {domain.customerExperience.responses} responses.</p>
        </section>
        <section className="surface p-5 xl:col-span-4">
          <SectionHeading title="People Health" description="Attendance, punctuality, training, and absence pressure" />
          <div className="mt-4 grid grid-cols-3 gap-3 text-center"><div><p className="text-xl font-semibold">{domain.staffing.total}</p><p className="data-label">Employees</p></div><div><p className="text-xl font-semibold text-primary">{domain.staffing.present}</p><p className="data-label">Present</p></div><div><p className="text-xl font-semibold text-destructive">{domain.staffing.absent}</p><p className="data-label">Absent</p></div></div>
          <div className="mt-5"><HorizontalBarChart data={domain.peopleHealth.reasons} /></div>
        </section>
        <section className="surface p-5 xl:col-span-4">
          <SectionHeading title="Visual Merchandising Detail" description="Average visual-merchandising score by store" />
          <NamedBarChart data={domain.visualMerchandising} valueFormatter={formatPercent} />
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <section className="surface min-w-0 overflow-hidden xl:col-span-8">
          <div className="p-5 pb-3"><SectionHeading title="Priority Actions & Maintenance Backlog" description="Operational work requiring follow-through" /></div>
          <Table>
            <TableHeader><TableRow><TableHead>Store / Category</TableHead><TableHead>Due</TableHead><TableHead className="text-right">Cost</TableHead><TableHead>Priority</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>{domain.maintenance.slice(0, 14).map((item) => <TableRow key={item.id}><TableCell className="font-medium">{item.storeName} / {item.category}</TableCell><TableCell>{item.dueDate ?? 'No due date'}</TableCell><TableCell className="text-right">{formatCurrency(item.cost, meta.currency)}</TableCell><TableCell><StatusBadge value={item.priority} /></TableCell><TableCell><StatusBadge value={item.status} /></TableCell></TableRow>)}</TableBody>
          </Table>
        </section>
        <section className="surface min-w-0 p-5 xl:col-span-4">
          <SectionHeading title="Maintenance by Category" description={`${formatCurrency(domain.maintenanceSummary.openCost, meta.currency)} open cost`} />
          <HorizontalBarChart data={domain.maintenanceByCategory.map((item) => ({ name: item.name, value: item.open }))} />
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="surface p-5">
          <SectionHeading title="Incident Queue & Recent Entries" description="Recent incidents ordered by severity" />
          <div className="mt-4 divide-y">{domain.incidents.slice(0, 10).map((item) => <div key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"><span className="flex size-8 items-center justify-center rounded-md bg-chart-3/10 text-destructive"><AlertTriangle className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{item.storeName} / {item.type}</span><span className="text-xs text-muted-foreground">{new Date(item.occurredAt).toLocaleDateString('en-GB')}</span></span><StatusBadge value={item.severity} /><StatusBadge value={item.status} /></div>)}</div>
        </section>
        <section className="surface p-5">
          <SectionHeading title="Key Issues" description="Store-standard observations recorded in the period" />
          <div className="mt-4 divide-y">{domain.keyIssues.slice(0, 10).map((item) => <div key={item.id} className="flex gap-3 py-3 first:pt-0 last:pb-0"><span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-chart-2/12 text-amber-800"><Gauge className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{item.storeName} / {item.date}</span><span className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.issues}</span></span></div>)}</div>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <section className="surface min-w-0 p-5 xl:col-span-4">
          <SectionHeading title="SOP Compliance" description="Compliance score by operating area" />
          <HorizontalBarChart data={domain.sopByArea} valueFormatter={formatPercent} />
        </section>
        <section className="surface min-w-0 overflow-hidden xl:col-span-8">
          <div className="p-5 pb-3"><SectionHeading title="Corrective Action Register" description="SOP deviations and corrective commitments" /></div>
          <Table><TableHeader><TableRow><TableHead>Store</TableHead><TableHead>Area</TableHead><TableHead>Deviation</TableHead><TableHead>Corrective action</TableHead></TableRow></TableHeader><TableBody>{domain.sopDeviations.slice(0, 12).map((item) => <TableRow key={item.id}><TableCell className="font-medium">{item.storeName}</TableCell><TableCell>{item.area}</TableCell><TableCell className="max-w-64 truncate text-muted-foreground">{item.deviations}</TableCell><TableCell className="max-w-64 truncate">{item.correctiveAction ?? 'Not recorded'}</TableCell></TableRow>)}</TableBody></Table>
        </section>
      </div>

      <section className="surface p-5">
        <SectionHeading title="Corrective Actions" description="Owners, priorities, deadlines, and progress" />
        <div className="mt-4 grid gap-x-6 md:grid-cols-2">{domain.correctiveActions.slice(0, 12).map((item) => <div key={item.id} className="flex gap-3 border-b py-3 first:pt-0 md:[&:nth-last-child(-n+2)]:border-b-0"><span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><ClipboardCheck className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{item.title}</span><span className="block truncate text-xs text-muted-foreground">{item.ownerName} / {item.storeName ?? 'Group'}</span></span><StatusBadge value={item.status} /></div>)}</div>
      </section>

      <TradingSnapshot meta={meta} trading={trading} showStores={false} />
    </div>
  );
}
