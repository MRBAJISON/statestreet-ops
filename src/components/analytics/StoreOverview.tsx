import { CircleAlert, ClipboardCheck, PackageSearch, Repeat2, Truck, UsersRound } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { AnalyticsMeta, StoreDomain, TradingOverview } from '@/lib/contracts/analytics';
import { MetricRail, SectionHeading, StatusBadge } from './DashboardPrimitives';
import { HorizontalBarChart, NamedBarChart } from './Charts';
import { formatCurrency, formatNumber, formatPercent } from './format';
import { TradingSnapshot } from './TradingSnapshot';

export function StoreOverview({ meta, trading, domain }: { meta: AnalyticsMeta; trading: TradingOverview; domain: StoreDomain }) {
  return (
    <div className="flex flex-col gap-5">
      <TradingSnapshot meta={meta} trading={trading} showStores={false} />

      <MetricRail items={[
        { label: 'Customers captured', value: formatNumber(domain.customerHealth.total), detail: `${domain.customerHealth.new} new`, icon: UsersRound, tone: 'blue' },
        { label: 'Returning customers', value: formatNumber(domain.customerHealth.returning), detail: `${formatPercent(domain.customerHealth.repeatRate)} repeat rate`, icon: Repeat2, tone: 'green' },
        { label: 'Low-stock products', value: formatNumber(domain.lowStock.length), detail: 'At or below threshold', icon: PackageSearch, tone: 'coral' },
        { label: 'Stock transfers', value: formatNumber(domain.transfers.length), detail: 'Recent incoming and outgoing', icon: Truck, tone: 'teal' },
      ]} className="xl:grid-cols-4 2xl:grid-cols-4" />

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="surface min-w-0 p-5"><SectionHeading title="Sales by Category" description="Approved category revenue for this store" /><NamedBarChart data={trading.categories.map((item) => ({ name: item.name, value: item.revenue }))} valueFormatter={(value) => formatCurrency(value, meta.currency)} /></section>
        <section className="surface min-w-0 p-5"><SectionHeading title="Sell-Through by Category" description="Units sold against opening stock" /><HorizontalBarChart data={trading.categories.map((item) => ({ name: item.name, value: item.sellThrough }))} valueFormatter={formatPercent} /></section>
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <section className="surface p-5 xl:col-span-7">
          <SectionHeading title="Recent Daily Reports" description="Status, approved revenue, and payment reconciliation" />
          <div className="mt-4 divide-y">{domain.recentReports.map((report) => <div key={report.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"><span className="flex size-8 items-center justify-center rounded-md bg-chart-1/10 text-chart-1"><ClipboardCheck className="size-4" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{report.businessDate}</span><span className="text-xs text-muted-foreground">{formatCurrency(report.revenue, meta.currency)} / variance {formatCurrency(report.paymentVariance, meta.currency)}</span></span><StatusBadge value={report.status} /></div>)}</div>
        </section>
        <section className="surface p-5 xl:col-span-5">
          <SectionHeading title="Current Weekly Review" description="Manager judgement and committed actions" />
          {domain.weeklyReview ? <div className="mt-4 flex flex-col gap-4"><div className="flex items-center justify-between gap-3"><span className="text-sm font-medium">Week ending {domain.weeklyReview.weekEnd}</span><StatusBadge value={domain.weeklyReview.status} /></div>{domain.weeklyReview.risks ? <div className="surface-subtle p-3"><p className="text-xs font-medium text-muted-foreground">Risks</p><p className="mt-1 text-sm leading-5">{domain.weeklyReview.risks}</p></div> : null}{domain.weeklyReview.opportunities ? <div className="surface-subtle p-3"><p className="text-xs font-medium text-muted-foreground">Opportunities</p><p className="mt-1 text-sm leading-5">{domain.weeklyReview.opportunities}</p></div> : null}<div className="divide-y">{domain.weeklyReview.actions.map((action) => <div key={action.id} className="flex items-center gap-3 py-2.5"><CircleAlert className="size-4 shrink-0 text-chart-2" /><span className="min-w-0 flex-1 truncate text-sm">{action.action}</span><StatusBadge value={action.status} /></div>)}</div></div> : <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">No weekly review has been saved.</div>}
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <section className="surface min-w-0 p-5 xl:col-span-4"><SectionHeading title="Customer Sources" description="Where captured customers originated" /><NamedBarChart data={domain.customerSources} /></section>
        <section className="surface min-w-0 overflow-hidden xl:col-span-8">
          <div className="p-5 pb-3"><SectionHeading title="Stock Transfers" description="Recent incoming and outgoing inventory movement" /></div>
          <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Direction</TableHead><TableHead>Other store</TableHead><TableHead className="text-right">Units</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{domain.transfers.map((item) => <TableRow key={item.id}><TableCell>{item.date}</TableCell><TableCell className="capitalize"><span className="inline-flex items-center gap-2"><Truck className="size-4 text-chart-4" />{item.direction}</span></TableCell><TableCell className="font-medium">{item.otherStore}</TableCell><TableCell className="text-right">{item.units}</TableCell><TableCell><StatusBadge value={item.status} /></TableCell></TableRow>)}</TableBody></Table>
        </section>
      </div>

      <section className="surface p-5">
        <SectionHeading title="Low-Stock Watch" description="Products at or below the store threshold" />
        {domain.lowStock.length ? <div className="mt-4 grid gap-x-6 sm:grid-cols-2 xl:grid-cols-3">{domain.lowStock.map((item) => <div key={item.productId} className="flex items-center gap-3 border-b py-3 first:pt-0 xl:[&:nth-last-child(-n+3)]:border-b-0"><span className="flex size-8 items-center justify-center rounded-md bg-chart-2/12 text-amber-800"><PackageSearch className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{item.name}</span><span className="text-xs text-muted-foreground">{item.sku}</span></span><span className="text-sm font-semibold">{item.units}</span></div>)}</div> : <div className="mt-4 flex min-h-24 items-center justify-center text-sm text-muted-foreground">No products are below the store threshold.</div>}
      </section>
    </div>
  );
}
