'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  LoaderCircle,
  LockKeyhole,
  RotateCcw,
  Save,
  Send,
} from 'lucide-react';
import FormSection from '@/components/forms/FormSection';
import { useOrg } from '@/components/providers/OrgProvider';
import type {
  DailyReportMutationResponse,
  DailyReportRecord,
  DailyReportsResponse,
  DailyReportStatus,
} from '@/lib/contracts/daily-report';
import {
  buildDailyReportInput,
  calculateDailyReportTotals,
  createDailyReportDraft,
  createSavedDailyReportRecord,
  mergeDailyReportsResponses,
  type DailyReportDraft,
  type DailySalesDraftRow,
  upsertDailyReport,
} from '@/lib/daily-report-form';

type SalesField = Exclude<keyof DailySalesDraftRow, 'categoryId'>;
type HeaderField = Exclude<keyof DailyReportDraft, 'businessDate' | 'sales' | 'payments'>;

const SALES_FIELDS: { key: SalesField; label: string; step: number }[] = [
  { key: 'openingStock', label: 'Opening stock', step: 1 },
  { key: 'unitsSold', label: 'Units sold', step: 1 },
  { key: 'grossRevenue', label: 'Gross sales', step: 0.01 },
  { key: 'cogs', label: 'COGS', step: 0.01 },
  { key: 'discounts', label: 'Discounts', step: 0.01 },
  { key: 'creditSales', label: 'Credit sales', step: 0.01 },
];

const STATUS_LABELS: Record<DailyReportStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
};

const STATUS_CLASSES: Record<DailyReportStatus, string> = {
  draft: 'border-gray-500/30 bg-gray-500/10 text-gray-300',
  submitted: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  approved: 'border-green-500/30 bg-green-500/10 text-green-300',
};

function NumericInput({
  label,
  ariaLabel,
  value,
  step,
  disabled,
  onChange,
}: {
  label: string;
  ariaLabel: string;
  value: string;
  step: number;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="min-w-0">
      <span className="mb-1 block text-[0.72rem] text-gray-500 md:sr-only">{label}</span>
      <input
        aria-label={ariaLabel}
        className="h-10 w-full min-w-0 tabular-nums disabled:cursor-not-allowed disabled:opacity-55"
        type="number"
        inputMode={step === 1 ? 'numeric' : 'decimal'}
        min={0}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function StatusPill({ status }: { status: DailyReportStatus }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold ${STATUS_CLASSES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function moneyFromCents(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `${currency} ${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  }
}

function reportNetCents(report: DailyReportRecord) {
  return report.sales.reduce(
    (sum, line) => sum + Math.round((Number(line.grossRevenue) - Number(line.discounts)) * 100),
    0
  );
}

function reportPaymentsCents(report: DailyReportRecord) {
  return report.payments.reduce((sum, line) => sum + Math.round(Number(line.amount) * 100), 0);
}

async function responseError(response: Response) {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error || `Request failed (${response.status})`;
}

export default function TypedDailyReport({ assignedStore }: { assignedStore: string }) {
  const { org } = useOrg();
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<DailyReportsResponse | null>(null);
  const [draft, setDraft] = useState<DailyReportDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'draft' | 'submitted' | null>(null);
  const [notice, setNotice] = useState<{
    kind: 'success' | 'warning' | 'error';
    text: string;
  } | null>(null);
  const loadSequence = useRef(0);

  const loadReports = useCallback(async (businessDate: string) => {
    const requestId = ++loadSequence.current;
    setLoading(true);
    try {
      const selectedDateQuery = new URLSearchParams({ from: businessDate, to: businessDate });
      const [recentResponse, selectedResponse] = await Promise.all([
        fetch('/api/daily-reports', { cache: 'no-store' }),
        fetch(`/api/daily-reports?${selectedDateQuery}`, { cache: 'no-store' }),
      ]);
      if (!recentResponse.ok) throw new Error(await responseError(recentResponse));
      if (!selectedResponse.ok) throw new Error(await responseError(selectedResponse));
      const nextData = mergeDailyReportsResponses(
        (await recentResponse.json()) as DailyReportsResponse,
        (await selectedResponse.json()) as DailyReportsResponse
      );
      if (requestId !== loadSequence.current) return null;
      setData(nextData);
      return nextData;
    } catch (error) {
      if (requestId !== loadSequence.current) return null;
      throw error;
    } finally {
      if (requestId === loadSequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReports(selectedDate).catch((error) => {
      setNotice({ kind: 'error', text: (error as Error).message });
    });
  }, [loadReports, selectedDate]);

  const currentReport = useMemo(
    () => data?.reports.find((report) => report.businessDate === selectedDate),
    [data, selectedDate]
  );

  useEffect(() => {
    if (!data) return;
    setDraft(createDailyReportDraft(selectedDate, data.references, currentReport));
  }, [currentReport, data, selectedDate]);

  const categoryNames = useMemo(
    () =>
      new Map(
        data?.references.categories.map((category) => [
          category.id,
          category.available ? category.name : `${category.name} (inactive)`,
        ]) ?? []
      ),
    [data]
  );
  const paymentNames = useMemo(
    () =>
      new Map(
        data?.references.paymentMethods.map((method) => [
          method.id,
          method.available ? method.name : `${method.name} (inactive)`,
        ]) ?? []
      ),
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
    setDraft((current) =>
      current
        ? {
            ...current,
            sales: current.sales.map((line) =>
              line.categoryId === categoryId ? { ...line, [field]: value } : line
            ),
          }
        : current
    );
  }

  function updatePayment(paymentMethodId: number, value: string) {
    setDraft((current) =>
      current
        ? {
            ...current,
            payments: current.payments.map((line) =>
              line.paymentMethodId === paymentMethodId ? { ...line, amount: value } : line
            ),
          }
        : current
    );
  }

  function resetDraft() {
    if (!data) return;
    setDraft(createDailyReportDraft(selectedDate, data.references, currentReport));
    setNotice(null);
  }

  async function save(status: 'draft' | 'submitted') {
    if (!data || !draft || locked) return;
    setBusy(status);
    setNotice(null);
    try {
      const input = buildDailyReportInput(draft, status, currentReport?.lockVersion);
      const response = await fetch(currentReport ? `/api/daily-reports/${currentReport.id}` : '/api/daily-reports', {
        method: currentReport ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const result = (await response.json()) as DailyReportMutationResponse;
      const savedReport = createSavedDailyReportRecord(
        input,
        result.report,
        data.references,
        currentReport
      );
      try {
        await loadReports(selectedDate);
        setNotice({
          kind: 'success',
          text:
            status === 'submitted'
              ? correctingSubmission
                ? 'Correction saved for Finance review.'
                : 'Daily report submitted to Finance.'
              : 'Draft saved.',
        });
      } catch {
        setData((current) =>
          current
            ? { ...current, reports: upsertDailyReport(current.reports, savedReport) }
            : current
        );
        setNotice({
          kind: 'warning',
          text: 'Saved, but the latest report list could not be reloaded.',
        });
      }
    } catch (error) {
      setNotice({ kind: 'error', text: (error as Error).message });
    } finally {
      setBusy(null);
    }
  }

  if (loading && !data) {
    return (
      <div className="flex min-h-56 items-center justify-center text-sm text-gray-400">
        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Loading daily report
      </div>
    );
  }

  if (!data || !draft || !totals) {
    return (
      <div className="flex min-h-40 items-center rounded-md border border-red-500/25 bg-red-500/10 p-5 text-sm text-red-300">
        <AlertCircle className="mr-2 h-4 w-4 shrink-0" />
        {notice?.text ?? 'The daily report is unavailable.'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <FormSection title="Daily Store Report" description={`${storeName} · ${selectedDate}`}>
        <div className="flex flex-col gap-4 border-b border-[var(--c-border)] py-3 md:flex-row md:items-end md:justify-between">
          <label className="w-full md:max-w-56">
            <span className="mb-1 block text-xs text-gray-400">Business date</span>
            <input
              className="h-10 w-full"
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              value={selectedDate}
              disabled={Boolean(busy)}
              onChange={(event) => {
                setLoading(true);
                setSelectedDate(event.target.value);
                setNotice(null);
              }}
            />
          </label>
          <div className="flex items-center gap-2">
            {currentReport ? <StatusPill status={currentReport.status} /> : <StatusPill status="draft" />}
            {locked ? <LockKeyhole className="h-4 w-4 text-gray-500" aria-label="Locked" /> : null}
          </div>
        </div>

        {notice ? (
          <div
            className={`mt-4 flex items-start rounded-md border p-3 text-sm ${
              notice.kind === 'success'
                ? 'border-green-500/25 bg-green-500/10 text-green-300'
                : notice.kind === 'warning'
                  ? 'border-amber-500/25 bg-amber-500/10 text-amber-200'
                  : 'border-red-500/25 bg-red-500/10 text-red-300'
            }`}
          >
            {notice.kind === 'success' ? (
              <CheckCircle2 className="mr-2 mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="mr-2 mt-0.5 h-4 w-4 shrink-0" />
            )}
            {notice.text}
          </div>
        ) : null}

        {locked ? (
          <div className="mt-4 flex items-center rounded-md border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-200">
            <LockKeyhole className="mr-2 h-4 w-4 shrink-0" />
            This report is locked. Finance must reopen it before changes can be made.
          </div>
        ) : null}

        <section className="mt-6">
          <h4 className="text-sm font-semibold">Sales by category</h4>
          <div className="mt-3 hidden grid-cols-[minmax(140px,1.35fr)_repeat(6,minmax(92px,1fr))] gap-3 border-b border-[var(--c-border)] pb-2 text-[0.72rem] font-semibold text-gray-500 md:grid">
            <span>Category</span>
            {SALES_FIELDS.map((field) => (
              <span key={field.key}>{field.label}</span>
            ))}
          </div>
          <div className="divide-y divide-[var(--c-border)]">
            {draft.sales.map((line) => {
              const categoryName = categoryNames.get(line.categoryId) ?? `Category ${line.categoryId}`;
              return (
                <div
                  key={line.categoryId}
                  className="grid grid-cols-2 gap-3 py-4 md:grid-cols-[minmax(140px,1.35fr)_repeat(6,minmax(92px,1fr))] md:items-center"
                >
                  <div className="col-span-2 min-w-0 md:col-span-1">
                    <span className="text-sm font-medium text-[var(--c-fg)]">{categoryName}</span>
                  </div>
                  {SALES_FIELDS.map((field) => (
                    <NumericInput
                      key={field.key}
                      label={field.label}
                      ariaLabel={`${categoryName}: ${field.label}`}
                      value={line[field.key]}
                      step={field.step}
                      disabled={Boolean(loading || locked || busy)}
                      onChange={(value) => updateSales(line.categoryId, field.key, value)}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </section>

        <section className="border-t border-[var(--c-border)] pt-6">
          <h4 className="text-sm font-semibold">Store totals</h4>
          <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-3">
            {[
              ['transactions', 'Transactions'],
              ['footfall', 'Footfall'],
              ['totalCustomers', 'Total customers'],
              ['newCustomers', 'New customers'],
              ['returningCustomers', 'Returning customers'],
            ].map(([field, label]) => (
              <label key={field}>
                <span className="mb-1 block text-xs text-gray-400">{label}</span>
                <input
                  className="h-10 w-full tabular-nums"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={draft[field as HeaderField]}
                  disabled={Boolean(loading || locked || busy)}
                  onChange={(event) => updateHeader(field as HeaderField, event.target.value)}
                />
              </label>
            ))}
          </div>
        </section>

        <section className="mt-6 border-t border-[var(--c-border)] pt-6">
          <h4 className="text-sm font-semibold">Payments received</h4>
          <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-3">
            {draft.payments.map((line) => {
              const methodName = paymentNames.get(line.paymentMethodId) ?? `Method ${line.paymentMethodId}`;
              return (
                <label key={line.paymentMethodId}>
                  <span className="mb-1 block text-xs text-gray-400">{methodName}</span>
                  <input
                    aria-label={methodName}
                    className="h-10 w-full tabular-nums"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={0.01}
                    value={line.amount}
                    disabled={Boolean(loading || locked || busy)}
                    onChange={(event) => updatePayment(line.paymentMethodId, event.target.value)}
                  />
                </label>
              );
            })}
          </div>
        </section>

        <div className="mt-6 grid grid-cols-2 border-y border-[var(--c-border)] md:grid-cols-6">
          {[
            ['Gross sales', totals.grossCents],
            ['Discounts', totals.discountCents],
            ['Net sales', totals.netCents],
            ['Credit sales', totals.creditCents],
            ['Payments', totals.paymentsCents],
            ['Variance', totals.paymentVarianceCents],
          ].map(([label, cents], index) => (
            <div
              key={String(label)}
              className={`min-w-0 px-3 py-3 ${index % 2 ? '' : 'border-r border-[var(--c-border)]'} md:border-r md:last:border-r-0`}
            >
              <div className="text-[0.72rem] text-gray-500">{label}</div>
              <div
                className={`mt-1 truncate text-sm font-semibold tabular-nums ${
                  label === 'Variance' && cents !== 0 ? 'text-red-300' : 'text-[var(--c-fg)]'
                }`}
                title={moneyFromCents(Number(cents), org.currency)}
              >
                {moneyFromCents(Number(cents), org.currency)}
              </div>
            </div>
          ))}
        </div>

        <label className="mt-6 block">
          <span className="mb-1 block text-xs text-gray-400">Notes</span>
          <textarea
            className="min-h-24 w-full resize-y"
            maxLength={2000}
            value={draft.notes}
            disabled={Boolean(loading || locked || busy)}
            onChange={(event) => updateHeader('notes', event.target.value)}
          />
        </label>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#c8a951] px-4 text-sm font-semibold text-black hover:bg-[#d4bf7a] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={Boolean(
              loading || locked || correctingSubmission || busy || !data.references.categories.length
            )}
            onClick={() => void save('draft')}
          >
            {busy === 'draft' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save draft
          </button>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-green-500/35 bg-green-500/10 px-4 text-sm font-semibold text-green-300 hover:bg-green-500/15 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={Boolean(loading || locked || busy || !data.references.categories.length)}
            onClick={() => void save('submitted')}
          >
            {busy === 'submitted' ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {correctingSubmission ? 'Save correction' : 'Submit to Finance'}
          </button>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--c-border2)] px-4 text-sm text-gray-400 hover:bg-[var(--c-hover)] hover:text-[var(--c-fg)] disabled:opacity-50"
            disabled={Boolean(loading || busy)}
            onClick={resetDraft}
          >
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
        </div>
      </FormSection>

      <FormSection title="Recent Daily Reports" defaultOpen>
        {data.reports.length ? (
          <>
            <div className="divide-y divide-[var(--c-border)] md:hidden">
              {data.reports.slice(0, 12).map((report) => (
                <button
                  key={report.id}
                  type="button"
                  className={`grid w-full grid-cols-[1fr_auto] gap-2 px-1 py-3 text-left ${
                    report.businessDate === selectedDate ? 'bg-[var(--c-hover)]' : ''
                  }`}
                  onClick={() => {
                    setSelectedDate(report.businessDate);
                    setNotice(null);
                  }}
                >
                  <span className="inline-flex items-center gap-2 text-sm font-medium">
                    <CalendarDays className="h-3.5 w-3.5" /> {report.businessDate}
                  </span>
                  <StatusPill status={report.status} />
                  <span className="text-xs text-gray-500">Net sales</span>
                  <span className="text-right text-xs font-semibold tabular-nums">
                    {moneyFromCents(reportNetCents(report), org.currency)}
                  </span>
                  <span className="text-xs text-gray-500">Payments</span>
                  <span className="text-right text-xs font-semibold tabular-nums">
                    {moneyFromCents(reportPaymentsCents(report), org.currency)}
                  </span>
                </button>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
            <table className="min-w-[640px]">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Status</th>
                  <th className="text-right">Net sales</th>
                  <th className="text-right">Payments</th>
                  <th className="text-right">Transactions</th>
                </tr>
              </thead>
              <tbody>
                {data.reports.slice(0, 12).map((report) => (
                  <tr key={report.id} className={report.businessDate === selectedDate ? 'bg-[var(--c-hover)]' : ''}>
                    <td>
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 font-medium text-[var(--c-fg)] hover:text-[#d4bf7a]"
                        onClick={() => {
                          setSelectedDate(report.businessDate);
                          setNotice(null);
                        }}
                      >
                        <CalendarDays className="h-3.5 w-3.5" /> {report.businessDate}
                      </button>
                    </td>
                    <td><StatusPill status={report.status} /></td>
                    <td className="text-right tabular-nums">{moneyFromCents(reportNetCents(report), org.currency)}</td>
                    <td className="text-right tabular-nums">{moneyFromCents(reportPaymentsCents(report), org.currency)}</td>
                    <td className="text-right tabular-nums">{report.transactions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </>
        ) : (
          <div className="py-8 text-center text-sm text-gray-500">No daily reports yet.</div>
        )}
      </FormSection>
    </div>
  );
}
