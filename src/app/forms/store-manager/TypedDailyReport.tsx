'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, Download, LoaderCircle, LockKeyhole, RotateCcw, Save, Send, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShowMoreButton } from '@/components/ui/show-more-button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { PeriodReportDownload, type DownloadableStoreGroup } from '@/components/reports/PeriodReportDownload';
import { useOrg } from '@/components/providers/OrgProvider';
import { useExpandable } from '@/hooks/use-expandable';
import type { DailyReportMutationResponse, DailyReportRecord, DailyReportsResponse, DailyReportStatus } from '@/lib/contracts/daily-report';
import {
  buildDailyReportInput,
  calculateDailyReportTotals,
  createDailyReportDraft,
  createSavedDailyReportRecord,
  mergeDailyReportsResponses,
  sumProductUnits,
  sumProductValue,
  type DailyProductDraftRow,
  type DailyReportDraft,
  type DailySalesDraftRow,
  upsertDailyReport,
} from '@/lib/daily-report-form';
import { CategoryProductLines } from './CategoryProductLines';
import { downloadFile } from '@/lib/download-file';
import { cn } from '@/lib/utils';

type SalesField = Exclude<keyof DailySalesDraftRow, 'categoryId' | 'products' | 'totalsOverridden'>;
type HeaderField = Exclude<keyof DailyReportDraft, 'businessDate' | 'sales' | 'payments' | 'noSales'>;

const SALES_FIELDS: Array<{ key: SalesField; label: string; step: number }> = [
  { key: 'unitsSold', label: 'Units sold', step: 1 },
  { key: 'grossRevenue', label: 'Gross sales', step: 0.01 },
  { key: 'cogs', label: 'COGS', step: 0.01 },
  { key: 'discounts', label: 'Discounts', step: 0.01 },
  { key: 'returns', label: 'Returns', step: 0.01 },
  { key: 'creditSales', label: 'Credit sales', step: 0.01 },
];

const STATUS_VARIANTS: Record<DailyReportStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  submitted: 'border-chart-2/30 bg-chart-2/15 text-amber-800',
  approved: 'border-primary/20 bg-primary/10 text-primary',
};

function money(cents: number, currency: string) {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function reportNetCents(report: DailyReportRecord) {
  return report.sales.reduce(
    (sum, line) => sum + Math.round((Number(line.grossRevenue) - Number(line.discounts) - Number(line.returns)) * 100),
    0
  );
}

async function responseError(response: Response) {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? `Request failed (${response.status})`;
}

function StatusBadge({ status }: { status: DailyReportStatus }) {
  return <Badge variant="outline" className={cn('capitalize', STATUS_VARIANTS[status])}>{status}</Badge>;
}

export default function TypedDailyReport({
  assignedStore,
  stores = [],
  storeGroup = null,
}: {
  assignedStore: string;
  stores?: Array<{ id: number; code: string; name: string }>;
  // Present only when this manager can open every store in the group.
  storeGroup?: DownloadableStoreGroup | null;
}) {
  const { org } = useOrg();
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  // Only meaningful for a manager covering more than one shop; with one store the
  // server ignores it and uses the single assignment.
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(() => stores[0]?.id ?? null);
  const [data, setData] = useState<DailyReportsResponse | null>(null);
  const [draft, setDraft] = useState<DailyReportDraft | null>(null);
  const [visibleCategoryIds, setVisibleCategoryIds] = useState<Set<number>>(() => new Set());
  const [categoryToAdd, setCategoryToAdd] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'draft' | 'submitted' | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadSequence = useRef(0);

  const loadReports = useCallback(async (businessDate: string) => {
    const requestId = ++loadSequence.current;
    setLoading(true);
    try {
      const query = new URLSearchParams({ from: businessDate, to: businessDate });
      const recentQuery = new URLSearchParams();
      if (selectedStoreId) {
        query.set('storeId', String(selectedStoreId));
        recentQuery.set('storeId', String(selectedStoreId));
      }
      const [recentResponse, selectedResponse] = await Promise.all([
        fetch(`/api/daily-reports?${recentQuery}`, { cache: 'no-store' }),
        fetch(`/api/daily-reports?${query}`, { cache: 'no-store' }),
      ]);
      if (!recentResponse.ok) throw new Error(await responseError(recentResponse));
      if (!selectedResponse.ok) throw new Error(await responseError(selectedResponse));
      const next = mergeDailyReportsResponses(
        (await recentResponse.json()) as DailyReportsResponse,
        (await selectedResponse.json()) as DailyReportsResponse
      );
      if (requestId !== loadSequence.current) return null;
      setData(next);
      return next;
    } finally {
      if (requestId === loadSequence.current) setLoading(false);
    }
  }, [selectedStoreId]);

  useEffect(() => {
    void loadReports(selectedDate).catch((loadError) => setError((loadError as Error).message));
  }, [loadReports, selectedDate]);

  const currentReport = useMemo(
    () => data?.reports.find((report) => report.businessDate === selectedDate),
    [data, selectedDate]
  );

  useEffect(() => {
    if (data) {
      const nextDraft = createDailyReportDraft(selectedDate, data.references, currentReport);
      setDraft(nextDraft);
      setVisibleCategoryIds(new Set(currentReport?.sales.map((line) => line.categoryId) ?? []));
      setCategoryToAdd('');
    }
  }, [currentReport, data, selectedDate]);

  const categoryNames = useMemo(
    () => new Map(data?.references.categories.map((category) => [category.id, category.name]) ?? []),
    [data]
  );
  const paymentNames = useMemo(
    () => new Map(data?.references.paymentMethods.map((method) => [method.id, method.name]) ?? []),
    [data]
  );
  const totals = useMemo(() => (draft ? calculateDailyReportTotals(draft) : null), [draft]);
  const locked = currentReport?.status === 'approved';
  const correctingSubmission = currentReport?.status === 'submitted';
  const storeName = data?.references.store?.name ?? assignedStore;

  function updateHeader(field: HeaderField, value: string) {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
  }

  function updateSales(categoryId: number, field: SalesField, value: string) {
    // Editing units or gross by hand is the manager overriding the computed total,
    // and is recorded as such so it survives further product edits.
    const overridesTotals = field === 'unitsSold' || field === 'grossRevenue';
    setDraft((current) => current ? {
      ...current,
      sales: current.sales.map((line) => line.categoryId === categoryId
        ? { ...line, [field]: value, ...(overridesTotals ? { totalsOverridden: true } : {}) }
        : line),
    } : current);
  }

  function updatePayment(paymentMethodId: number, value: string) {
    setDraft((current) => current ? {
      ...current,
      payments: current.payments.map((line) => line.paymentMethodId === paymentMethodId ? { ...line, amount: value } : line),
    } : current);
  }

  function updateProducts(categoryId: number, products: DailyProductDraftRow[]) {
    setDraft((current) => current ? {
      ...current,
      sales: current.sales.map((line) => {
        if (line.categoryId !== categoryId) return line;
        // Category totals track the product lines until someone corrects a total by
        // hand, after which adding a product must not overwrite their figure.
        if (line.totalsOverridden) return { ...line, products };
        return {
          ...line,
          products,
          unitsSold: products.length ? String(sumProductUnits(products)) : line.unitsSold,
          grossRevenue: products.length ? sumProductValue(products) : line.grossRevenue,
        };
      }),
    } : current);
  }

  function resetDraft() {
    if (!data) return;
    setDraft(createDailyReportDraft(selectedDate, data.references, currentReport));
    setVisibleCategoryIds(new Set(currentReport?.sales.map((line) => line.categoryId) ?? []));
    setError(null);
  }

  function removeCategory(categoryId: number) {
    setDraft((current) => current ? {
      ...current,
      sales: current.sales.map((line) => line.categoryId === categoryId ? {
        ...line,
        unitsSold: '',
        grossRevenue: '',
        cogs: '',
        discounts: '',
        returns: '',
        creditSales: '',
        products: [],
        totalsOverridden: false,
      } : line),
    } : current);
    setVisibleCategoryIds((current) => {
      const next = new Set(current);
      next.delete(categoryId);
      return next;
    });
  }

  async function downloadPdf() {
    if (!currentReport || currentReport.status === 'draft' || downloadingPdf) return;
    setDownloadingPdf(true);
    setError(null);
    try {
      await downloadFile(
        `/api/daily-reports/${currentReport.id}/pdf`,
        `daily-report-${currentReport.storeCode}-${currentReport.businessDate}.pdf`
      );
    } catch (downloadError) {
      setError((downloadError as Error).message);
    } finally {
      setDownloadingPdf(false);
    }
  }

  async function save(status: 'draft' | 'submitted') {
    if (!data || !draft || locked) return;
    setBusy(status);
    setError(null);
    try {
      const input = buildDailyReportInput(draft, status, currentReport?.lockVersion);
      const response = await fetch(currentReport ? `/api/daily-reports/${currentReport.id}` : '/api/daily-reports', {
        method: currentReport ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Name the store on create so a manager covering two shops files against
        // the one they picked. The server still checks it is assigned to them.
        body: JSON.stringify(selectedStoreId && !currentReport ? { ...input, storeId: selectedStoreId } : input),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const result = (await response.json()) as DailyReportMutationResponse;
      const localRecord = createSavedDailyReportRecord(input, result.report, data.references, currentReport);
      try {
        await loadReports(selectedDate);
      } catch {
        setData((current) => current ? { ...current, reports: upsertDailyReport(current.reports, localRecord) } : current);
      }
      toast.success(status === 'submitted' ? (correctingSubmission ? 'Correction saved' : 'Daily report submitted') : 'Draft saved');
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const historyRows = useExpandable(data?.reports ?? []);

  if (loading && !data) {
    return (
      <div className="page-shell flex flex-col gap-5">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-[520px] w-full" />
      </div>
    );
  }

  if (!data || !draft || !totals) {
    return (
      <div className="page-shell">
        <Alert variant="destructive"><AlertCircle /><AlertTitle>Daily report unavailable</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>
      </div>
    );
  }

  const disabled = Boolean(loading || locked || busy);
  const status = currentReport?.status ?? 'draft';
  const paymentBalanced = totals.paymentVarianceCents === 0;
  const visibleSales = draft.sales.filter((line) => visibleCategoryIds.has(line.categoryId));
  const availableCategories = data.references.categories.filter((category) => category.available && !visibleCategoryIds.has(category.id));

  return (
    <div className="page-shell flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="outline" size="icon" asChild aria-label="Back to store workflows"><Link href="/forms/store-manager"><ArrowLeft /></Link></Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold leading-8">Daily store report</h1>
              <StatusBadge status={status} />
              {locked ? <LockKeyhole className="text-muted-foreground" aria-label="Locked" /> : null}
            </div>
            {stores.length > 1 ? (
              <Select
                value={selectedStoreId ? String(selectedStoreId) : ''}
                onValueChange={(value) => setSelectedStoreId(Number(value))}
                disabled={busy !== null}
              >
                <SelectTrigger className="mt-1 h-8 w-56" aria-label="Store">
                  <SelectValue placeholder="Choose a store" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={String(store.id)}>{store.name}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm text-muted-foreground">{storeName}</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            aria-label="Business date"
            className="w-40"
            max={new Date().toISOString().slice(0, 10)}
            value={selectedDate}
            disabled={Boolean(busy)}
            onChange={(event) => {
              setSelectedDate(event.target.value);
              setError(null);
            }}
          />
          {currentReport && currentReport.status !== 'draft' ? (
            <Button variant="outline" disabled={downloadingPdf} onClick={() => void downloadPdf()}>
              {downloadingPdf ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Download data-icon="inline-start" />}
              Download PDF
            </Button>
          ) : null}
          {data.references.store ? (
            <PeriodReportDownload
              storeId={data.references.store.id}
              storeCode={data.references.store.code}
              anchorDate={selectedDate}
              disabled={Boolean(busy)}
              group={storeGroup}
            />
          ) : null}
          <Button variant="outline" disabled={disabled || correctingSubmission} onClick={() => void save('draft')}>
            {busy === 'draft' ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Save data-icon="inline-start" />}
            Save draft
          </Button>
          <Button disabled={disabled || !paymentBalanced} onClick={() => void save('submitted')}>
            {busy === 'submitted' ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Send data-icon="inline-start" />}
            {correctingSubmission ? 'Save correction' : 'Submit'}
          </Button>
        </div>
      </header>

      {error ? (
        <Alert variant="destructive"><AlertCircle /><AlertTitle>Check this report</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>
      ) : null}

      {locked ? (
        <Alert><LockKeyhole /><AlertTitle>Report locked</AlertTitle><AlertDescription>Finance must reopen this approved report before it can be changed.</AlertDescription></Alert>
      ) : null}

      <section className="surface grid overflow-hidden grid-cols-2 lg:grid-cols-6">
        {[
          ['Gross sales', totals.grossCents, 'text-chart-1'],
          ['Net sales', totals.netCents, 'text-primary'],
          ['Returns', totals.returnCents, 'text-chart-3'],
          ['Credit sales', totals.creditCents, 'text-chart-5'],
          ['Payments', totals.paymentsCents, 'text-chart-4'],
          ['Variance', totals.paymentVarianceCents, paymentBalanced ? 'text-primary' : 'text-destructive'],
        ].map(([label, cents, tone], index) => (
          <div key={String(label)} className={cn('min-w-0 px-4 py-3', index > 0 && 'border-l', index > 1 && 'max-lg:border-t', index === 2 && 'max-lg:border-l-0')}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn('mt-1 truncate text-sm font-semibold', tone)} title={money(Number(cents), org.currency)}>{money(Number(cents), org.currency)}</p>
          </div>
        ))}
      </section>

      <Tabs defaultValue="sales" className="gap-5">
        <TabsList>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="store">Totals</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="sales">
          <label className="mb-3 flex items-start gap-3 rounded-md border bg-muted/35 px-4 py-3">
            <input
              type="checkbox"
              className="mt-0.5 size-4"
              checked={draft.noSales}
              disabled={disabled}
              onChange={(event) => setDraft((current) => (current ? { ...current, noSales: event.target.checked } : current))}
            />
            <span className="text-sm">
              <span className="font-medium">Nothing sold today</span>
              <span className="mt-0.5 block text-muted-foreground">
                Records the day as traded with no sales, so it still counts as filed. Tick this instead of adding a
                category and typing zeros.
              </span>
            </span>
          </label>

          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {draft.noSales
                ? 'No sales recorded for this day'
                : `${visibleSales.length} ${visibleSales.length === 1 ? 'category' : 'categories'} in this report`}
            </p>
            <Select
              value={categoryToAdd}
              onValueChange={(value) => {
                const categoryId = Number(value);
                setVisibleCategoryIds((current) => new Set([...current, categoryId]));
                setCategoryToAdd('');
              }}
              disabled={disabled || draft.noSales || !availableCategories.length}
            >
              <SelectTrigger className="w-52"><SelectValue placeholder="Add category" /></SelectTrigger>
              <SelectContent><SelectGroup>{availableCategories.map((category) => <SelectItem key={category.id} value={String(category.id)}>{category.name}</SelectItem>)}</SelectGroup></SelectContent>
            </Select>
          </div>

          {draft.noSales ? null : (
          <div className="overflow-x-auto rounded-md border bg-card shadow-sm hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-32">Category</TableHead>
                  <TableHead className="min-w-40">Product name</TableHead>
                  {SALES_FIELDS.map((field) => <TableHead key={field.key}>{field.label}</TableHead>)}
                  <TableHead className="w-12"><span className="sr-only">Remove</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleSales.map((line) => {
                  const category = categoryNames.get(line.categoryId) ?? `Category ${line.categoryId}`;
                  return (
                    <TableRow key={line.categoryId}>
                      <TableCell className="font-medium align-top">{category}</TableCell>
                      <TableCell className="min-w-80">
                        <CategoryProductLines
                          categoryId={line.categoryId}
                          categoryName={category}
                          products={line.products}
                          storeId={data?.references.store?.id ?? null}
                          disabled={disabled}
                          onChange={(products) => updateProducts(line.categoryId, products)}
                        />
                      </TableCell>
                      {SALES_FIELDS.map((field) => (
                        <TableCell key={field.key}>
                          <Input
                            aria-label={`${category}: ${field.label}`}
                            type="number"
                            inputMode={field.step === 1 ? 'numeric' : 'decimal'}
                            min={0}
                            step={field.step}
                            className="min-w-24"
                            value={line[field.key]}
                            disabled={disabled}
                            onChange={(event) => updateSales(line.categoryId, field.key, event.target.value)}
                          />
                        </TableCell>
                      ))}
                      <TableCell>
                        <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${category}`} disabled={disabled} onClick={() => removeCategory(line.categoryId)}><Trash2 /></Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          )}
          {draft.noSales ? null : (

          <div className="flex flex-col gap-5 md:hidden">
            {visibleSales.map((line) => {
              const category = categoryNames.get(line.categoryId) ?? `Category ${line.categoryId}`;
              return (
                <section key={line.categoryId} className="border-b pb-5 last:border-b-0">
                  <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-sm font-semibold">{category}</h2><Button type="button" variant="ghost" size="icon" aria-label={`Remove ${category}`} disabled={disabled} onClick={() => removeCategory(line.categoryId)}><Trash2 /></Button></div>
                  <FieldGroup className="grid grid-cols-2 gap-4">
                    <Field className="col-span-2">
                      <FieldLabel>Products sold</FieldLabel>
                      <CategoryProductLines
                        categoryId={line.categoryId}
                        categoryName={category}
                        products={line.products}
                        storeId={data?.references.store?.id ?? null}
                        disabled={disabled}
                        onChange={(products) => updateProducts(line.categoryId, products)}
                      />
                    </Field>
                    {SALES_FIELDS.map((field) => (
                      <Field key={field.key}>
                        <FieldLabel>{field.label}</FieldLabel>
                        <Input type="number" min={0} step={field.step} value={line[field.key]} disabled={disabled} onChange={(event) => updateSales(line.categoryId, field.key, event.target.value)} />
                      </Field>
                    ))}
                  </FieldGroup>
                </section>
              );
            })}
            {!visibleSales.length ? <p className="py-12 text-center text-sm text-muted-foreground">Add the first category sold today.</p> : null}
          </div>
          )}
        </TabsContent>

        <TabsContent value="store">
          <section className="border-y bg-card px-4 py-5 sm:px-5">
            <FieldGroup className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
              {[
                ['transactions', 'Transactions'],
                ['footfall', 'Footfall'],
                ['totalCustomers', 'Total customers'],
                ['newCustomers', 'New customers'],
                ['returningCustomers', 'Returning customers'],
              ].map(([field, label]) => (
                <Field key={field}>
                  <FieldLabel htmlFor={`report-${field}`}>{label}</FieldLabel>
                  <Input id={`report-${field}`} type="number" min={0} step={1} value={draft[field as HeaderField]} disabled={disabled} onChange={(event) => updateHeader(field as HeaderField, event.target.value)} />
                </Field>
              ))}
              <Field className="sm:col-span-2 lg:col-span-5">
                <FieldLabel htmlFor="report-notes">Notes</FieldLabel>
                <Textarea id="report-notes" value={draft.notes} disabled={disabled} onChange={(event) => updateHeader('notes', event.target.value)} />
              </Field>
              <Field className="sm:col-span-2 lg:col-span-5">
                <FieldLabel htmlFor="report-staffPerformanceNote">Staff performance note</FieldLabel>
                <Textarea id="report-staffPerformanceNote" value={draft.staffPerformanceNote} disabled={disabled} onChange={(event) => updateHeader('staffPerformanceNote', event.target.value)} />
              </Field>
              <Field className="sm:col-span-2 lg:col-span-5">
                <FieldLabel htmlFor="report-closingFacilityStatus">Closing &amp; facility status</FieldLabel>
                <Textarea id="report-closingFacilityStatus" value={draft.closingFacilityStatus} disabled={disabled} onChange={(event) => updateHeader('closingFacilityStatus', event.target.value)} />
              </Field>
            </FieldGroup>
          </section>
        </TabsContent>

        <TabsContent value="payments">
          <section className="flex flex-col gap-5">
            {!paymentBalanced ? (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>Payments do not reconcile</AlertTitle>
                <AlertDescription>Resolve the {money(Math.abs(totals.paymentVarianceCents), org.currency)} variance before submitting.</AlertDescription>
              </Alert>
            ) : (
              <Alert><CheckCircle2 /><AlertTitle>Payments reconciled</AlertTitle><AlertDescription>Payment total matches net cash sales.</AlertDescription></Alert>
            )}
            <FieldGroup className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {draft.payments.map((line) => (
                <Field key={line.paymentMethodId}>
                  <FieldLabel htmlFor={`payment-${line.paymentMethodId}`}>{paymentNames.get(line.paymentMethodId) ?? `Method ${line.paymentMethodId}`}</FieldLabel>
                  <Input id={`payment-${line.paymentMethodId}`} type="number" min={0} step={0.01} value={line.amount} disabled={disabled} onChange={(event) => updatePayment(line.paymentMethodId, event.target.value)} />
                </Field>
              ))}
            </FieldGroup>
          </section>
        </TabsContent>

        <TabsContent value="history">
          <div className="overflow-hidden rounded-md border bg-card shadow-sm">
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Net sales</TableHead><TableHead className="text-right">Transactions</TableHead></TableRow></TableHeader>
              <TableBody>
                {historyRows.visible.map((report) => (
                  <TableRow key={report.id} data-state={report.businessDate === selectedDate ? 'selected' : undefined}>
                    <TableCell><Button variant="link" className="h-auto px-0" onClick={() => setSelectedDate(report.businessDate)}>{report.businessDate}</Button></TableCell>
                    <TableCell><StatusBadge status={report.status} /></TableCell>
                    <TableCell className="text-right font-medium">{money(reportNetCents(report), org.currency)}</TableCell>
                    <TableCell className="text-right">{report.transactions}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ShowMoreButton expanded={historyRows.expanded} hiddenCount={historyRows.hiddenCount} canExpand={historyRows.canExpand} onClick={historyRows.toggle} />
          </div>
        </TabsContent>
      </Tabs>

      <footer className="flex justify-end border-t pt-5">
        <Button variant="ghost" disabled={Boolean(loading || busy)} onClick={resetDraft}><RotateCcw data-icon="inline-start" />Reset changes</Button>
      </footer>
    </div>
  );
}
