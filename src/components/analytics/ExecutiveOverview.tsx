import Link from 'next/link';
import {
  BanknoteArrowUp,
  Boxes,
  Building2,
  ChartNoAxesCombined,
  CircleAlert,
  CircleDollarSign,
  ClipboardCheck,
  HeartPulse,
  Megaphone,
  ReceiptText,
  ShoppingBag,
  UserRoundCheck,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { ShowMoreButton } from '@/components/ui/show-more-button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useExpandable } from '@/hooks/use-expandable';
import type { AnalyticsMeta, ExecutiveDomain, TradingOverview } from '@/lib/contracts/analytics';
import { EmptyPanel, EmptyTableRow, MetricRail, SectionHeading, StatusBadge } from './DashboardPrimitives';
import {
  DonutChart,
  HorizontalBarChart,
  RevenueTrendChart,
  StoreRankingChart,
} from './Charts';
import { formatCurrency, formatNumber, formatPercent, percentageChange } from './format';

const departmentLinks = [
  { label: 'Finance', href: '/dashboard/finance', icon: WalletCards, tone: 'text-chart-1 bg-chart-1/10' },
  { label: 'Commercial', href: '/dashboard/commercial', icon: ShoppingBag, tone: 'text-chart-2 bg-chart-2/12' },
  { label: 'Marketing', href: '/dashboard/marketing', icon: Megaphone, tone: 'text-chart-5 bg-chart-5/10' },
  { label: 'Operations', href: '/dashboard/operations', icon: ClipboardCheck, tone: 'text-chart-4 bg-chart-4/10' },
  { label: 'Inventory', href: '/dashboard/inventory', icon: Boxes, tone: 'text-chart-3 bg-chart-3/10' },
  { label: 'Brand Health', href: '/dashboard/brand-health', icon: HeartPulse, tone: 'text-destructive bg-chart-3/10' },
];

function DashboardLegend({ data, currency }: { data: Array<{ name: string; value: number }>; currency: string }) {
  return (
    <div className="mt-2 grid gap-2">
      {data.slice(0, 6).map((item, index) => (
        <div key={item.name} className="flex items-center gap-3 text-xs">
          <span className={`size-2 rounded-full ${['bg-chart-1', 'bg-chart-4', 'bg-chart-2', 'bg-chart-5', 'bg-chart-3'][index % 5]}`} />
          <span className="min-w-0 flex-1 truncate">{item.name}</span>
          <span className="font-medium">{formatCurrency(item.value, currency)}</span>
        </div>
      ))}
    </div>
  );
}

export function ExecutiveOverview({
  meta,
  trading,
  domain,
}: {
  meta: AnalyticsMeta;
  trading: TradingOverview;
  domain: ExecutiveDomain;
}) {
  const summary = trading.summary;
  const metrics = [
    {
      label: 'Group revenue',
      value: formatCurrency(summary.netRevenue, meta.currency),
      previous: percentageChange(summary.netRevenue, summary.previousNetRevenue),
      detail: `Target ${formatCurrency(summary.targetRevenue, meta.currency)}`,
      icon: CircleDollarSign,
      tone: 'blue' as const,
    },
    {
      label: 'Gross profit',
      value: formatCurrency(summary.grossProfit, meta.currency),
      previous: percentageChange(summary.grossProfit, summary.previousGrossProfit),
      detail: `${formatPercent(summary.grossMargin)} margin`,
      icon: BanknoteArrowUp,
      tone: 'teal' as const,
    },
    {
      label: 'Operating profit',
      value: formatCurrency(summary.operatingProfit, meta.currency),
      previous: percentageChange(summary.operatingProfit, summary.previousOperatingProfit),
      detail: `${formatPercent(summary.operatingMargin)} margin`,
      icon: ChartNoAxesCombined,
      tone: 'green' as const,
    },
    {
      label: 'Net profit',
      value: formatCurrency(summary.netProfit, meta.currency),
      detail: `${formatPercent(summary.netMargin)} margin`,
      icon: ReceiptText,
      tone: 'amber' as const,
    },
    {
      label: 'People health',
      value: formatPercent(domain.peopleHealth.score),
      detail: `${formatNumber(domain.staffing.total)} employees`,
      icon: UsersRound,
      tone: 'blue' as const,
    },
  ];

  const profitability = [
    { label: 'Gross margin', value: domain.finance.grossMargin },
    { label: 'Operating margin', value: domain.finance.operatingMargin },
    { label: 'Net margin', value: domain.finance.netMargin },
    { label: 'ROCE', value: domain.finance.roce },
    { label: 'ROI', value: domain.finance.roi },
  ];

  const stores = useExpandable(trading.stores);
  const categoryRows = useExpandable(trading.categories);
  const attention = useExpandable(trading.attention);
  const activity = useExpandable(domain.activity);
  const actions = useExpandable(trading.actions);
  const managerVoices = useExpandable(domain.managerVoices);
  const weeklyReviews = useExpandable(domain.weeklyReviews);

  return (
    <div className="flex flex-col gap-5">
      <MetricRail items={metrics} />

      <section className="chart-canvas min-w-0 p-5">
        <SectionHeading title="Group Revenue & Margin Trend" description="Approved net revenue, target, and gross profit by day" />
        <div className="mt-3"><RevenueTrendChart data={trading.trend} currency={meta.currency} /></div>
      </section>

      <div className="grid gap-5 xl:grid-cols-3">
        <section className="surface min-w-0 p-5">
          <SectionHeading title="Revenue by Category" description="Share of approved group revenue" />
          <DonutChart data={trading.categories.map((item) => ({ name: item.name, value: item.revenue }))} valueFormatter={(value) => formatCurrency(value, meta.currency)} />
          <DashboardLegend data={trading.categories.map((item) => ({ name: item.name, value: item.revenue }))} currency={meta.currency} />
        </section>
        <section className="surface min-w-0 p-5">
          <SectionHeading title="Brand Performance" description="Revenue contribution across the portfolio" />
          <HorizontalBarChart data={trading.brands} valueFormatter={(value) => formatCurrency(value, meta.currency)} />
        </section>
        <section className="surface min-w-0 p-5">
          <SectionHeading title="Payment Mix" description="How approved sales were collected" />
          <DonutChart data={trading.payments} valueFormatter={(value) => formatCurrency(value, meta.currency)} />
          <DashboardLegend data={trading.payments} currency={meta.currency} />
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <section className="surface min-w-0 p-5 xl:col-span-5">
          <SectionHeading title="Sales by Store" description="Approved revenue ranked across active stores" />
          <div className="mt-3"><StoreRankingChart data={trading.stores} currency={meta.currency} /></div>
        </section>
        <section className="surface min-w-0 overflow-hidden xl:col-span-7">
          <div className="p-5 pb-3"><SectionHeading title="Store Performance" description="Sales, target delivery, standards, and visual merchandising" /></div>
          <Table>
            <TableHeader><TableRow><TableHead>Store</TableHead><TableHead>Brand</TableHead><TableHead className="text-right">Revenue</TableHead><TableHead className="text-right">Target</TableHead><TableHead className="text-right">Operations</TableHead><TableHead className="text-right">VM</TableHead></TableRow></TableHeader>
            <TableBody>
              {trading.stores.length ? stores.visible.map((store) => (
                <TableRow key={store.id}>
                  <TableCell className="font-medium">{store.name}</TableCell>
                  <TableCell className="text-muted-foreground">{store.brandName ?? 'Unassigned'}</TableCell>
                  <TableCell className="text-right">{formatCurrency(store.revenue, meta.currency)}</TableCell>
                  <TableCell className="text-right font-medium">{formatPercent(store.attainment)}</TableCell>
                  <TableCell className="text-right">{formatPercent(store.operationsScore)}</TableCell>
                  <TableCell className="text-right">{formatPercent(store.visualMerchandisingScore)}</TableCell>
                </TableRow>
              )) : <EmptyTableRow colSpan={6} message="No approved store sales for this period" />}
            </TableBody>
          </Table>
          <ShowMoreButton expanded={stores.expanded} hiddenCount={stores.hiddenCount} canExpand={stores.canExpand} onClick={stores.toggle} />
        </section>
      </div>

      <section className="surface min-w-0 overflow-hidden">
        <div className="p-5 pb-3"><SectionHeading title="Sales by Category" description="Revenue, units, and period movement" /></div>
        <Table>
          <TableHeader><TableRow><TableHead>Category</TableHead><TableHead className="text-right">Revenue</TableHead><TableHead className="text-right">Share</TableHead><TableHead className="text-right">Units</TableHead><TableHead className="text-right">Change</TableHead></TableRow></TableHeader>
          <TableBody>
            {trading.categories.length ? categoryRows.visible.map((category) => (
              <TableRow key={category.id}>
                <TableCell className="font-medium">{category.name}</TableCell>
                <TableCell className="text-right">{formatCurrency(category.revenue, meta.currency)}</TableCell>
                <TableCell className="text-right">{formatPercent(category.share)}</TableCell>
                <TableCell className="text-right">{formatNumber(category.units)}</TableCell>
                <TableCell className="text-right font-medium">{percentageChange(category.revenue, category.previousRevenue)?.toFixed(1) ?? '0.0'}%</TableCell>
              </TableRow>
            )) : <EmptyTableRow colSpan={5} message="No approved category sales for this period" />}
          </TableBody>
        </Table>
        <ShowMoreButton expanded={categoryRows.expanded} hiddenCount={categoryRows.hiddenCount} canExpand={categoryRows.canExpand} onClick={categoryRows.toggle} />
      </section>

      <div className="grid gap-5 xl:grid-cols-12">
        <section className="surface p-5 xl:col-span-4">
          <SectionHeading title="People Health" description="Attendance, punctuality, and training readiness" />
          <div className="mt-5 grid gap-4">
            {[
              ['Attendance', domain.peopleHealth.attendance],
              ['Punctuality', domain.peopleHealth.punctuality],
              ['Training', domain.peopleHealth.training],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <div className="mb-2 flex justify-between text-xs"><span className="text-muted-foreground">{label}</span><span className="font-semibold">{formatPercent(Number(value))}</span></div>
                <Progress value={Number(value)} className="h-2" />
              </div>
            ))}
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3 border-t pt-4 text-center">
            <div><p className="text-lg font-semibold">{domain.staffing.present}</p><p className="data-label">Present</p></div>
            <div><p className="text-lg font-semibold">{domain.staffing.absent}</p><p className="data-label">Absent</p></div>
            <div><p className="text-lg font-semibold">{domain.peopleHealth.absences}</p><p className="data-label">Absences</p></div>
          </div>
        </section>
        <section className="surface p-5 xl:col-span-4">
          <SectionHeading title="Profitability Ratios" description="Group returns and margin quality" />
          <div className="mt-4 divide-y">
            {profitability.map((ratio) => (
              <div key={ratio.label} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <span className="text-sm text-muted-foreground">{ratio.label}</span>
                <span className="text-base font-semibold">{formatPercent(ratio.value)}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="surface p-5 xl:col-span-4">
          <SectionHeading title="Departments" description="Open each command center for its full operating view" />
          <div className="mt-4 grid grid-cols-2 gap-2">
            {departmentLinks.map((department) => (
              <Link key={department.href} href={department.href} className="flex min-h-14 items-center gap-3 rounded-md border bg-background px-3 transition-colors hover:bg-muted/60">
                <span className={`flex size-8 items-center justify-center rounded-md ${department.tone}`}><department.icon className="size-4" /></span>
                <span className="min-w-0 truncate text-sm font-medium">{department.label}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="surface min-w-0 p-5">
          <SectionHeading title="CEO Attention Index" description="The highest-priority risks requiring leadership attention" action={<span className="text-xs font-semibold text-destructive">{trading.summary.openActions} open</span>} />
          {trading.attention.length ? <><div className="mt-4 divide-y">
            {attention.visible.map((item) => (
              <div key={item.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-chart-3/10 text-destructive"><CircleAlert className="size-4" /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{item.title}</span><span className="block truncate text-xs text-muted-foreground">{[item.department, item.storeName, item.ownerName].filter(Boolean).join(' / ')}</span></span>
                <StatusBadge value={item.priority} />
              </div>
            ))}
          </div><ShowMoreButton expanded={attention.expanded} hiddenCount={attention.hiddenCount} canExpand={attention.canExpand} onClick={attention.toggle} /></> : <EmptyPanel message="No issues currently require CEO attention" />}
        </section>
        <section className="surface min-w-0 p-5">
          <SectionHeading title="Operations Feed" description="Recent submissions and workflow changes from the audit trail" />
          {domain.activity.length ? <><div className="mt-4 divide-y">
            {activity.visible.map((item) => (
              <div key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-chart-1/10 text-chart-1"><ClipboardCheck className="size-4" /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium capitalize">{item.action} {item.entityType.replaceAll('-', ' ')}</span><span className="text-xs text-muted-foreground">{item.actorName} / {new Date(item.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</span></span>
              </div>
            ))}
          </div><ShowMoreButton expanded={activity.expanded} hiddenCount={activity.hiddenCount} canExpand={activity.canExpand} onClick={activity.toggle} /></> : <EmptyPanel message="No recent workflow activity" />}
        </section>
      </div>

      <section className="surface min-w-0 overflow-hidden">
        <div className="p-5 pb-3"><SectionHeading title="Action Tracker" description="Cross-functional commitments, owners, due dates, and status" /></div>
        <Table>
          <TableHeader><TableRow><TableHead>Action</TableHead><TableHead>Department</TableHead><TableHead>Owner</TableHead><TableHead>Store</TableHead><TableHead>Due</TableHead><TableHead>Priority</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {trading.actions.length ? actions.visible.map((item) => (
              <TableRow key={item.id}><TableCell className="max-w-80 truncate font-medium">{item.title}</TableCell><TableCell className="capitalize">{item.department}</TableCell><TableCell>{item.ownerName}</TableCell><TableCell>{item.storeName ?? 'Group'}</TableCell><TableCell>{item.dueDate ?? 'Not set'}</TableCell><TableCell><StatusBadge value={item.priority} /></TableCell><TableCell><StatusBadge value={item.status} /></TableCell></TableRow>
            )) : <EmptyTableRow colSpan={7} message="No cross-functional actions recorded" />}
          </TableBody>
        </Table>
        <ShowMoreButton expanded={actions.expanded} hiddenCount={actions.hiddenCount} canExpand={actions.canExpand} onClick={actions.toggle} />
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="surface p-5">
          <SectionHeading title="Manager Voices" description="What store managers want leadership to hear" />
          {domain.managerVoices.length ? <><div className="mt-4 divide-y">
            {managerVoices.visible.map((voice) => (
              <div key={voice.reviewId} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-chart-5/10 text-chart-5"><UserRoundCheck className="size-4" /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{voice.storeName} / {voice.managerName}</span><span className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{voice.marketingAmplify ?? voice.differentThisWeek ?? 'No management note submitted.'}</span></span>
              </div>
            ))}
          </div><ShowMoreButton expanded={managerVoices.expanded} hiddenCount={managerVoices.hiddenCount} canExpand={managerVoices.canExpand} onClick={managerVoices.toggle} /></> : <EmptyPanel message="No manager observations have been submitted" />}
        </section>
        <section className="surface p-5">
          <SectionHeading title="Store Manager - Key Insights" description="Latest store judgement, risks, and target delivery" />
          {domain.weeklyReviews.length ? <><div className="mt-4 divide-y">
            {weeklyReviews.visible.map((review) => (
              <div key={review.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><Building2 className="size-4" /></span>
                <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="truncate text-sm font-medium">{review.storeName}</span><StatusBadge value={review.status} /></span><span className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{review.summary ?? review.risks ?? review.differentThisWeek ?? 'No insight submitted.'}</span></span>
                <span className="text-xs font-semibold">{formatPercent(review.achievement)}</span>
              </div>
            ))}
          </div><ShowMoreButton expanded={weeklyReviews.expanded} hiddenCount={weeklyReviews.hiddenCount} canExpand={weeklyReviews.canExpand} onClick={weeklyReviews.toggle} /></> : <EmptyPanel message="No store-manager insights have been submitted" />}
        </section>
      </div>
    </div>
  );
}
