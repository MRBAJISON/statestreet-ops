'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, Check, Clock3, LoaderCircle, LockOpen, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useOrg } from '@/components/providers/OrgProvider';
import type { DailyReportRecord, DailyReportsResponse, DailyReportStatus } from '@/lib/contracts/daily-report';
import type { ReferenceDataResponse } from '@/lib/contracts/reference-data';
import { cn } from '@/lib/utils';

async function responseError(response: Response) {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return payload?.error ?? 'The report could not be loaded';
}

function reportTotals(report: DailyReportRecord) {
  const sales = report.sales.reduce((totals, line) => ({
    gross: totals.gross + Number(line.grossRevenue),
    cogs: totals.cogs + Number(line.cogs),
    discounts: totals.discounts + Number(line.discounts),
    returns: totals.returns + Number(line.returns),
    credit: totals.credit + Number(line.creditSales),
    units: totals.units + line.unitsSold,
  }), { gross: 0, cogs: 0, discounts: 0, returns: 0, credit: 0, units: 0 });
  const net = sales.gross - sales.discounts - sales.returns;
  const expectedPayments = net - sales.credit;
  const payments = report.payments.reduce((sum, line) => sum + Number(line.amount), 0);
  return { ...sales, net, expectedPayments, payments, variance: payments - expectedPayments };
}

function StatusBadge({ status }: { status: DailyReportStatus }) {
  return <Badge variant="outline" className="capitalize">{status}</Badge>;
}

const activityLabels: Record<string, string> = {
  create: 'Report created',
  update: 'Report updated',
  submit: 'Submitted for review',
  approve: 'Approved by Finance',
  reopen: 'Reopened for correction',
};

function ReportDetail({
  report,
  references,
  currency,
  busy,
  onDecision,
}: {
  report: DailyReportRecord;
  references: DailyReportsResponse['references'];
  currency: string;
  busy: boolean;
  onDecision: (action: 'approve' | 'reopen', reason?: string) => void;
}) {
  const [reopenReason, setReopenReason] = useState('');
  const categoryNames = useMemo(() => new Map(references.categories.map((item) => [item.id, item.name])), [references.categories]);
  const paymentNames = useMemo(() => new Map(references.paymentMethods.map((item) => [item.id, item.name])), [references.paymentMethods]);
  const totals = reportTotals(report);
  const formatMoney = (value: number) => new Intl.NumberFormat('en-GH', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <section className="mb-6 grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-4">
          {[
            ['Net sales', formatMoney(totals.net)],
            ['Payments', formatMoney(totals.payments)],
            ['Variance', formatMoney(totals.variance)],
            ['Transactions', report.transactions.toLocaleString()],
            ['Footfall', report.footfall.toLocaleString()],
            ['Units sold', totals.units.toLocaleString()],
            ['Customers', report.totalCustomers.toLocaleString()],
            ['Credit sales', formatMoney(totals.credit)],
          ].map(([label, value]) => (
            <div key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>
          ))}
        </section>

        {Math.abs(totals.variance) > 0.005 ? (
          <Alert variant="destructive" className="mb-6"><AlertCircle /><AlertTitle>Payment variance</AlertTitle><AlertDescription>{formatMoney(totals.variance)}</AlertDescription></Alert>
        ) : null}

        <section className="mb-6">
          <h3 className="mb-2 text-sm font-semibold">Category sales</h3>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader><TableRow><TableHead>Category</TableHead><TableHead className="text-right">Net sales</TableHead><TableHead className="text-right">Units</TableHead></TableRow></TableHeader>
              <TableBody>{report.sales.map((line) => <TableRow key={line.categoryId}><TableCell>{categoryNames.get(line.categoryId) ?? `Category ${line.categoryId}`}</TableCell><TableCell className="text-right">{formatMoney(Number(line.grossRevenue) - Number(line.discounts) - Number(line.returns))}</TableCell><TableCell className="text-right">{line.unitsSold}</TableCell></TableRow>)}</TableBody>
            </Table>
          </div>
        </section>

        <section className="mb-6">
          <h3 className="mb-2 text-sm font-semibold">Payments</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {report.payments.map((line) => <div key={line.paymentMethodId} className="flex items-center justify-between border-b py-2 text-sm"><span className="text-muted-foreground">{paymentNames.get(line.paymentMethodId) ?? `Method ${line.paymentMethodId}`}</span><span className="font-medium">{formatMoney(Number(line.amount))}</span></div>)}
          </div>
        </section>

        {report.notes ? <section><h3 className="mb-2 text-sm font-semibold">Store note</h3><p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{report.notes}</p></section> : null}

        <Separator className="mt-6" />
        <section className="pt-5">
          <div className="mb-3 flex items-center gap-2">
            <Clock3 className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Activity</h3>
          </div>
          <div className="flex flex-col gap-4">
            {report.activity.length ? report.activity.map((event) => (
              <div key={event.id} className="grid grid-cols-[0.5rem_1fr] gap-3">
                <span className="mt-1.5 size-2 rounded-full bg-primary" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{activityLabels[event.action] ?? event.action}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {event.actorName ?? 'System'} · {new Intl.DateTimeFormat('en-GH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(event.createdAt))}
                  </p>
                  {event.reason ? <p className="mt-1 text-sm leading-5 text-muted-foreground">{event.reason}</p> : null}
                </div>
              </div>
            )) : <p className="text-sm text-muted-foreground">No recorded activity for this report.</p>}
          </div>
        </section>

        {report.status === 'approved' ? (
          <Field className="mt-6"><FieldLabel htmlFor="reopen-reason">Reason to reopen</FieldLabel><Textarea id="reopen-reason" value={reopenReason} disabled={busy} onChange={(event) => setReopenReason(event.target.value)} /></Field>
        ) : null}
      </div>
      <SheetFooter className="border-t bg-background px-5 py-4 sm:flex-row sm:justify-end">
        {report.status === 'submitted' ? <Button disabled={busy || Math.abs(totals.variance) > 0.005} onClick={() => onDecision('approve')}>{busy ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Check data-icon="inline-start" />}Approve report</Button> : null}
        {report.status === 'approved' ? <Button variant="outline" disabled={busy || !reopenReason.trim()} onClick={() => onDecision('reopen', reopenReason)}>{busy ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <LockOpen data-icon="inline-start" />}Reopen report</Button> : null}
      </SheetFooter>
    </div>
  );
}

export default function DailyReportReview() {
  const { org } = useOrg();
  const [status, setStatus] = useState<DailyReportStatus>('submitted');
  const [storeId, setStoreId] = useState('all');
  const [stores, setStores] = useState<ReferenceDataResponse['stores']>([]);
  const [date, setDate] = useState('');
  const [data, setData] = useState<DailyReportsResponse | null>(null);
  const [selected, setSelected] = useState<DailyReportRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/reference-data', { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response));
        return response.json() as Promise<ReferenceDataResponse>;
      })
      .then((references) => setStores(references.stores.filter((store) => store.type === 'store')))
      .catch((loadError: Error) => {
        if (loadError.name !== 'AbortError') setError(loadError.message);
      });
    return () => controller.abort();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ status });
      if (storeId !== 'all') params.set('storeId', storeId);
      if (date) {
        params.set('from', date);
        params.set('to', date);
      }
      const response = await fetch(`/api/daily-reports?${params}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(await responseError(response));
      setData((await response.json()) as DailyReportsResponse);
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  }, [date, status, storeId]);

  useEffect(() => { void load(); }, [load]);

  async function decide(action: 'approve' | 'reopen', reason?: string) {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/daily-reports/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, lockVersion: selected.lockVersion, reason }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      toast.success(action === 'approve' ? 'Daily report approved' : 'Daily report reopened');
      setSelected(null);
      await load();
    } catch (decisionError) {
      setError((decisionError as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-shell flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" asChild aria-label="Back to finance workflows"><Link href="/forms/finance"><ArrowLeft /></Link></Button>
          <h1 className="text-2xl font-semibold leading-8">Daily report review</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={storeId} onValueChange={setStoreId}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All stores" /></SelectTrigger>
            <SelectContent><SelectGroup><SelectItem value="all">All stores</SelectItem>{stores.map((store) => <SelectItem key={store.id} value={String(store.id)}>{store.name}</SelectItem>)}</SelectGroup></SelectContent>
          </Select>
          <Input type="date" aria-label="Filter by date" className="w-40" value={date} onChange={(event) => setDate(event.target.value)} />
          <Button variant="outline" size="icon" aria-label="Refresh reports" onClick={() => void load()}><RotateCcw className={cn(loading && 'animate-spin')} /></Button>
        </div>
      </header>

      <Tabs value={status} onValueChange={(value) => setStatus(value as DailyReportStatus)}>
        <TabsList><TabsTrigger value="submitted">Awaiting review</TabsTrigger><TabsTrigger value="approved">Approved</TabsTrigger><TabsTrigger value="draft">Drafts</TabsTrigger></TabsList>
      </Tabs>

      {error ? <Alert variant="destructive"><AlertCircle /><AlertTitle>Review unavailable</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}

      {loading && !data ? <Skeleton className="h-96 w-full" /> : (
        <div className="overflow-hidden rounded-md border bg-card shadow-sm">
          <Table>
            <TableHeader><TableRow><TableHead>Store</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Net sales</TableHead><TableHead className="text-right">Transactions</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {data?.reports.length ? data.reports.map((report) => {
                const totals = reportTotals(report);
                return <TableRow key={report.id} className="cursor-pointer" tabIndex={0} onClick={() => setSelected(report)} onKeyDown={(event) => { if (event.key === 'Enter') setSelected(report); }}><TableCell className="font-medium">{report.storeName}</TableCell><TableCell>{report.businessDate}</TableCell><TableCell className="text-right">{new Intl.NumberFormat('en-GH', { style: 'currency', currency: org.currency, maximumFractionDigits: 0 }).format(totals.net)}</TableCell><TableCell className="text-right">{report.transactions}</TableCell><TableCell><StatusBadge status={report.status} /></TableCell></TableRow>;
              }) : <TableRow><TableCell colSpan={5} className="h-28 text-center text-muted-foreground">No reports in this view.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      )}

      <Sheet open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 data-[side=right]:sm:max-w-2xl">
          {selected && data ? (
            <>
              <SheetHeader className="border-b px-5 py-5 pr-12 text-left">
                <div className="flex items-center gap-2"><SheetTitle>{selected.storeName}</SheetTitle><StatusBadge status={selected.status} /></div>
                <SheetDescription>{selected.businessDate}</SheetDescription>
              </SheetHeader>
              <ReportDetail report={selected} references={data.references} currency={org.currency} busy={busy} onDecision={decide} />
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
