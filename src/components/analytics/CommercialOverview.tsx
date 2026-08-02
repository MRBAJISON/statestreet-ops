'use client';

import { useState } from 'react';
import { Check, ContactRound, LoaderCircle, LockOpen, PackagePlus, PackageSearch, ShoppingBag, UserRoundCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ShowMoreButton } from '@/components/ui/show-more-button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useExpandable } from '@/hooks/use-expandable';
import type { AnalyticsMeta, CommercialDomain, TradingOverview } from '@/lib/contracts/analytics';
import { EmptyPanel, EmptyTableRow, MetricRail, SectionHeading, StatusBadge } from './DashboardPrimitives';
import { ComparisonBarChart, NamedBarChart, ValueTrendChart } from './Charts';
import { formatCurrency, formatNumber, formatPercent } from './format';
import { TradingSnapshot } from './TradingSnapshot';

type CommercialReview = CommercialDomain['weeklyReviews'][number];

function WeeklyReviewDecision({ review, onRefresh }: { review: CommercialReview; onRefresh: () => void }) {
  const [busy, setBusy] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reason, setReason] = useState('');

  async function decide(action: 'approve' | 'reopen') {
    setBusy(true);
    try {
      const response = await fetch(`/api/weekly-reviews/${review.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          lockVersion: review.lockVersion,
          reason: action === 'reopen' ? reason.trim() : undefined,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? 'The weekly review could not be updated');
      toast.success(action === 'approve' ? 'Weekly review approved' : 'Weekly review reopened');
      setReopenOpen(false);
      setReason('');
      onRefresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (review.status === 'submitted') {
    return (
      <Button type="button" size="sm" disabled={busy} onClick={() => void decide('approve')}>
        {busy ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Check data-icon="inline-start" />}
        Approve
      </Button>
    );
  }

  if (review.status !== 'approved') return <span className="text-xs text-muted-foreground">Awaiting submission</span>;

  return (
    <>
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setReopenOpen(true)}>
        <LockOpen data-icon="inline-start" />
        Reopen
      </Button>
      <Dialog open={reopenOpen} onOpenChange={(open) => !busy && setReopenOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reopen weekly review</DialogTitle>
            <DialogDescription>
              {review.storeName} will be able to correct the review for the week ending {review.weekEnd}.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            aria-label="Reason for reopening"
            autoFocus
            maxLength={1000}
            placeholder="Explain what needs to be corrected"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={busy}
          />
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setReopenOpen(false)}>Cancel</Button>
            <Button type="button" disabled={busy || !reason.trim()} onClick={() => void decide('reopen')}>
              {busy ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <LockOpen data-icon="inline-start" />}
              Reopen review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function CommercialOverview({
  meta,
  trading,
  domain,
  onRefresh,
  canDecideWeeklyReviews,
}: {
  meta: AnalyticsMeta;
  trading: TradingOverview;
  domain: CommercialDomain;
  onRefresh: () => void;
  canDecideWeeklyReviews: boolean;
}) {
  const productVelocity = useExpandable(domain.productVelocity);
  const weeklyReviews = useExpandable(domain.weeklyReviews);
  const actions = useExpandable(domain.actions);
  const managerVoices = useExpandable(domain.managerVoices);
  const newArrivals = useExpandable(domain.newArrivals);
  const customers = useExpandable(domain.customers);

  return (
    <div className="flex flex-col gap-5">
      <TradingSnapshot meta={meta} trading={trading} />
      <MetricRail items={[
        { label: 'Captured leads', value: formatNumber(domain.customerFunnel.leads), detail: 'Customer interactions', icon: ContactRound, tone: 'blue' },
        { label: 'Captured buyers', value: formatNumber(domain.customerFunnel.buyers), detail: 'Recorded purchasers', icon: ShoppingBag, tone: 'green' },
        { label: 'Tracked products', value: formatNumber(domain.productVelocity.length), detail: 'SKU performance lines', icon: PackageSearch, tone: 'amber' },
        { label: 'New arrivals', value: formatNumber(domain.newArrivals.reduce((sum, item) => sum + item.units, 0)), detail: 'Units received', icon: PackagePlus, tone: 'teal' },
      ]} className="xl:grid-cols-4 2xl:grid-cols-4" />

      <section className="surface min-w-0 p-5">
        <SectionHeading title="Category Target vs Actual" description="Revenue delivery against the active target plan" />
        <ComparisonBarChart data={domain.categoryTargets.map((item) => ({ name: item.name, primary: item.actualRevenue, secondary: item.targetRevenue }))} valueFormatter={(value) => formatCurrency(value, meta.currency)} />
      </section>

      <section className="surface min-w-0 overflow-hidden">
        <div className="p-5 pb-3"><SectionHeading title="SKU Performance" description="Velocity, current stock, movement age, and commercial judgement" /></div>
        <Table>
          <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Brand / Category</TableHead><TableHead className="text-right">Sold</TableHead><TableHead className="text-right">Stock</TableHead><TableHead>Performance</TableHead><TableHead>Commercial Insight</TableHead></TableRow></TableHeader>
          <TableBody>{domain.productVelocity.length ? productVelocity.visible.map((product) => <TableRow key={product.id}><TableCell><span className="block max-w-56 truncate font-medium">{product.name}</span><span className="text-xs text-muted-foreground">{product.sku}</span></TableCell><TableCell><span className="block text-sm">{product.brandName}</span><span className="text-xs text-muted-foreground">{product.categoryName}</span></TableCell><TableCell className="text-right font-medium">{product.unitsSold}</TableCell><TableCell className="text-right">{product.stock}</TableCell><TableCell><StatusBadge value={product.performance ?? product.status ?? 'unrated'} /></TableCell><TableCell className="max-w-72 truncate text-muted-foreground">{product.insight ?? product.campaign ?? 'No insight recorded'}</TableCell></TableRow>) : <EmptyTableRow colSpan={6} message="No SKU performance has been submitted for this period" />}</TableBody>
        </Table>
        <ShowMoreButton expanded={productVelocity.expanded} hiddenCount={productVelocity.hiddenCount} canExpand={productVelocity.canExpand} onClick={productVelocity.toggle} />
      </section>

      <div className="grid gap-5 xl:grid-cols-12">
        <section className="surface min-w-0 overflow-hidden xl:col-span-8">
          <div className="p-5 pb-3"><SectionHeading title="Weekly Review & Review Submissions" description="Store performance, management judgement, and action coverage" /></div>
          <Table>
            <TableHeader><TableRow><TableHead>Store</TableHead><TableHead>Manager</TableHead><TableHead>Week end</TableHead><TableHead className="text-right">Actual</TableHead><TableHead className="text-right">Target</TableHead><TableHead className="text-right">Achievement</TableHead><TableHead>Status</TableHead>{canDecideWeeklyReviews ? <TableHead className="text-right">Decision</TableHead> : null}</TableRow></TableHeader>
            <TableBody>{domain.weeklyReviews.length ? weeklyReviews.visible.map((review) => <TableRow key={review.id}><TableCell className="font-medium">{review.storeName}</TableCell><TableCell>{review.managerName}</TableCell><TableCell>{review.weekEnd}</TableCell><TableCell className="text-right">{formatCurrency(review.actualRevenue, meta.currency)}</TableCell><TableCell className="text-right">{formatCurrency(review.targetRevenue, meta.currency)}</TableCell><TableCell className="text-right font-semibold">{formatPercent(review.achievement)}</TableCell><TableCell><StatusBadge value={review.status} /></TableCell>{canDecideWeeklyReviews ? <TableCell className="text-right"><WeeklyReviewDecision review={review} onRefresh={onRefresh} /></TableCell> : null}</TableRow>) : <EmptyTableRow colSpan={canDecideWeeklyReviews ? 8 : 7} message="No weekly reviews have been submitted" />}</TableBody>
          </Table>
          <ShowMoreButton expanded={weeklyReviews.expanded} hiddenCount={weeklyReviews.hiddenCount} canExpand={weeklyReviews.canExpand} onClick={weeklyReviews.toggle} />
        </section>
        <section className="surface min-w-0 p-5 xl:col-span-4">
          <SectionHeading title="Achievement Trend" description="Weekly target delivery across submitted reviews" />
          <ValueTrendChart data={domain.achievementTrend.map((item) => ({ date: item.weekEnd, value: item.attainment }))} valueFormatter={formatPercent} />
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="surface p-5">
          <SectionHeading title="Accountability & Action Tracker" description="Commercial commitments ordered by priority" />
          {domain.actions.length ? <><div className="mt-4 divide-y">{actions.visible.map((item) => <div key={item.id} className="flex gap-3 py-3 first:pt-0 last:pb-0"><span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-chart-2/12 text-amber-800"><ShoppingBag className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{item.title}</span><span className="block truncate text-xs text-muted-foreground">{item.ownerName} / {item.storeName ?? 'Group'} / {item.dueDate ?? 'No due date'}</span></span><StatusBadge value={item.status} /></div>)}</div><ShowMoreButton expanded={actions.expanded} hiddenCount={actions.hiddenCount} canExpand={actions.canExpand} onClick={actions.toggle} /></> : <EmptyPanel message="No commercial actions recorded" />}
        </section>
        <section className="surface p-5">
          <SectionHeading title="Manager Voices" description="Direct store-manager observations for the commercial team" />
          {domain.managerVoices.length ? <><div className="mt-4 divide-y">{managerVoices.visible.map((voice) => <div key={voice.reviewId} className="flex gap-3 py-3 first:pt-0 last:pb-0"><span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-chart-5/10 text-chart-5"><UserRoundCheck className="size-4" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{voice.storeName} / {voice.managerName}</span><span className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{voice.marketingAmplify ?? voice.differentThisWeek ?? voice.firstThreeActions ?? 'No note submitted.'}</span></span></div>)}</div><ShowMoreButton expanded={managerVoices.expanded} hiddenCount={managerVoices.hiddenCount} canExpand={managerVoices.canExpand} onClick={managerVoices.toggle} /></> : <EmptyPanel message="No manager observations have been submitted" />}
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <section className="surface min-w-0 overflow-hidden xl:col-span-8">
          <div className="p-5 pb-3"><SectionHeading title="New Arrivals & Deployment" description="Recent goods receipts and their store destination" /></div>
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Brand / Category</TableHead><TableHead>Store</TableHead><TableHead>Supplier</TableHead><TableHead className="text-right">Units</TableHead><TableHead className="text-right">Value</TableHead></TableRow></TableHeader>
            <TableBody>{domain.newArrivals.length ? newArrivals.visible.map((item) => <TableRow key={`${item.id}-${item.brandName}-${item.categoryName}`}><TableCell>{item.date}</TableCell><TableCell><span className="block font-medium">{item.brandName}</span><span className="text-xs text-muted-foreground">{item.categoryName}</span></TableCell><TableCell>{item.storeName}</TableCell><TableCell>{item.supplierName}</TableCell><TableCell className="text-right">{item.units}</TableCell><TableCell className="text-right">{formatCurrency(item.value, meta.currency)}</TableCell></TableRow>) : <EmptyTableRow colSpan={6} message="No goods receipts recorded for this period" />}</TableBody>
          </Table>
          <ShowMoreButton expanded={newArrivals.expanded} hiddenCount={newArrivals.hiddenCount} canExpand={newArrivals.canExpand} onClick={newArrivals.toggle} />
        </section>
        <section className="surface min-w-0 p-5 xl:col-span-4">
          <SectionHeading title="Deployment by Store" description="New-arrival units allocated by location" />
          <NamedBarChart data={domain.deploymentByStore} />
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <section className="surface min-w-0 p-5 xl:col-span-4">
          <SectionHeading title="Customer Sources" description="Where captured leads and buyers originated" />
          <NamedBarChart data={domain.customerFunnel.sources} />
        </section>
        <section className="surface min-w-0 overflow-hidden xl:col-span-8">
          <div className="p-5 pb-3"><SectionHeading title="Customer Database & Recent Entries" description="Recent customer captures and commercial interests" /></div>
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Customer</TableHead><TableHead>Store</TableHead><TableHead>Source</TableHead><TableHead>Interest</TableHead><TableHead>Lifecycle</TableHead></TableRow></TableHeader>
            <TableBody>{domain.customers.length ? customers.visible.map((customer) => <TableRow key={customer.id}><TableCell>{customer.date}</TableCell><TableCell><span className="block font-medium">{customer.name}</span><span className="text-xs text-muted-foreground">{customer.phone}</span></TableCell><TableCell>{customer.storeName}</TableCell><TableCell>{customer.source}</TableCell><TableCell className="max-w-52 truncate">{customer.interest ?? 'Not recorded'}</TableCell><TableCell><StatusBadge value={customer.lifecycle} /></TableCell></TableRow>) : <EmptyTableRow colSpan={6} message="No customers were captured for this period" />}</TableBody>
          </Table>
          <ShowMoreButton expanded={customers.expanded} hiddenCount={customers.hiddenCount} canExpand={customers.canExpand} onClick={customers.toggle} />
        </section>
      </div>
    </div>
  );
}
