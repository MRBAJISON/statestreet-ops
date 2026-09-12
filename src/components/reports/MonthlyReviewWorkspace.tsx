'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, FieldLabel } from '@/components/ui/field';
import { Checkbox } from '@/components/ui/checkbox';
import { ProductPerformanceTable } from '@/components/analytics/ProductPerformancePanel';
import { downloadFile } from '@/lib/download-file';
import type { MonthlyReviewContext } from '@/lib/monthly-reviews';
import type {
  SaveMonthlyReviewInput,
  MonthlyActionInput,
} from '@/lib/contracts/monthly-review';

type Draft = Pick<
  SaveMonthlyReviewInput,
  | 'executiveSummary'
  | 'managementOutcomes'
  | 'operationalAssessment'
  | 'conclusion'
  | 'storeComments'
  | 'advisors'
  | 'actions'
  | 'carriedActions'
>;
type Options = {
  stores: { id: number; name: string }[];
  groups: { id: number; name: string; storeIds: number[] }[];
};
const empty: Draft = {
  executiveSummary: '',
  managementOutcomes: '',
  operationalAssessment: '',
  conclusion: '',
  storeComments: {},
  advisors: [],
  actions: [],
  carriedActions: [],
};

export function MonthlyReviewWorkspace({
  readOnly = false,
}: {
  readOnly?: boolean;
}) {
  const [options, setOptions] = useState<Options>({ stores: [], groups: [] }),
    [selection, setSelection] = useState('');
  const [month, setMonth] = useState(() => {
    const date = new Date();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() - 1);
    return date.toISOString().slice(0, 7);
  });
  const [context, setContext] = useState<MonthlyReviewContext | null>(null),
    [draft, setDraft] = useState<Draft>(empty);
  const [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [reopenReason, setReopenReason] = useState('');
  const [refresh, setRefresh] = useState(0),
    [dirty, setDirty] = useState(false);
  const query = selection
    ? `${selection.startsWith('group:') ? 'groupId' : 'storeId'}=${selection.split(':')[1]}&month=${month}-01`
    : '';
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/monthly-reviews?options=1', { signal: controller.signal })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error);
        setOptions(body);
        setSelection(
          body.groups[0]
            ? `group:${body.groups[0].id}`
            : body.stores[0]
              ? `store:${body.stores[0].id}`
              : ''
        );
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    void fetch(`/api/monthly-reviews?${query}`, { signal: controller.signal })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error);
        const data = body as MonthlyReviewContext;
        setContext(data);
        setError('');
        setConfirmed(data.narrativeCurrent);
        setDirty(false);
        setDraft({
          executiveSummary:
            data.review?.executiveSummary ?? data.summary.explanation,
          managementOutcomes: data.review?.managementOutcomes ?? '',
          operationalAssessment: data.review?.operationalAssessment ?? '',
          conclusion: data.review?.conclusion ?? '',
          storeComments: data.review?.storeComments ?? {},
          advisors: data.review?.advisors ?? [],
          actions: data.review?.actions ?? [],
          carriedActions: data.carriedActions.map((a) => ({
            id: a.id,
            status: a.status,
            progress: a.progress,
            expectedStatus: a.status,
            expectedProgress: a.progress,
          })),
        });
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [query, refresh]);
  function update<K extends keyof Draft>(field: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [field]: value }));
    setDirty(true);
    setConfirmed(false);
  }
  async function save(
    status: 'draft' | 'submitted',
    checkNarrative = confirmed
  ) {
    if (!context) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/monthly-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          scope: context.scope,
          status,
          lockVersion: context.review?.lockVersion,
          sourceHash: context.sourceHash,
          confirmNarrative: checkNarrative,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setMessage(
        status === 'submitted' ? 'Monthly review submitted.' : 'Draft saved.'
      );
      setRefresh((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function reopen() {
    if (!context?.review) return;
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/monthly-reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: context.scope,
          lockVersion: context.review.lockVersion,
          reason: reopenReason,
        }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error);
      setRefresh((v) => v + 1);
      setReopenReason('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    setBusy(true);
    try {
      await downloadFile(
        `/api/monthly-reviews/pdf?${query}`,
        `monthly-performance-${month}.pdf`
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const locked =
    readOnly || busy || !context || context.review?.status === 'submitted';
  const money = (value: number) =>
    `${context?.currency ?? 'GHS'} ${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const textField = (
    key:
      | 'executiveSummary'
      | 'managementOutcomes'
      | 'operationalAssessment'
      | 'conclusion',
    label: string
  ) => (
    <Field>
      <FieldLabel htmlFor={key}>{label}</FieldLabel>
      <Textarea
        id={key}
        value={draft[key]}
        disabled={locked}
        onChange={(e) => update(key, e.target.value)}
        className="min-h-28 resize-y"
      />
    </Field>
  );
  function actionField(
    index: number,
    key: keyof MonthlyActionInput,
    value: string
  ) {
    update(
      'actions',
      draft.actions.map((a, i) => (i === index ? { ...a, [key]: value } : a))
    );
  }
  return (
    <div className="page-shell flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href={readOnly ? '/store-reports' : '/forms/store-manager'}
            className="text-sm text-muted-foreground"
          >
            Back
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">
            Monthly performance review
          </h1>
          <p className="text-sm text-muted-foreground">
            Daily figures, weekly findings and next month’s commitments.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={busy || (dirty && locked)}
            onClick={() =>
              dirty ? void save('draft', false) : setRefresh((v) => v + 1)
            }
          >
            {dirty ? 'Save draft & refresh sources' : 'Refresh sources'}
          </Button>
          <Button
            variant="outline"
            disabled={busy || !context?.ready || dirty}
            onClick={() => void download()}
          >
            Download performance PDF
          </Button>
          {!readOnly ? (
            <>
              <Button
                variant="outline"
                disabled={locked}
                onClick={() => void save('draft')}
              >
                Save draft
              </Button>
              <Button
                disabled={
                  locked || !confirmed || Boolean(context?.missing.length)
                }
                onClick={() => void save('submitted')}
              >
                Submit monthly review
              </Button>
            </>
          ) : null}
        </div>
      </header>
      <div className="flex flex-wrap gap-4">
        <Field className="min-w-64">
          <FieldLabel htmlFor="monthly-scope">Store or cluster</FieldLabel>
          <select
            id="monthly-scope"
            className="h-10 rounded-md border bg-background px-3"
            value={selection}
            disabled={busy || dirty}
            onChange={(e) => {
              setContext(null);
              setSelection(e.target.value);
            }}
          >
            {options.groups.map((g) => (
              <option key={`g${g.id}`} value={`group:${g.id}`}>
                {g.name} (cluster)
              </option>
            ))}
            {options.stores
              .filter(
                (s) =>
                  readOnly ||
                  !options.groups.some((g) => g.storeIds.includes(s.id))
              )
              .map((s) => (
                <option key={s.id} value={`store:${s.id}`}>
                  {s.name}
                </option>
              ))}
          </select>
        </Field>
        <Field className="w-48">
          <FieldLabel htmlFor="monthly-month">Month</FieldLabel>
          <Input
            id="monthly-month"
            type="month"
            value={month}
            disabled={busy || dirty}
            onChange={(e) => {
              if (e.target.value) {
                setContext(null);
                setMonth(e.target.value);
              }
            }}
          />
        </Field>
      </div>
      {dirty ? (
        <p className="text-sm text-amber-700">
          Save this draft before changing the period. Refreshing saves your
          current wording as a draft and asks you to check it against the
          updated sources.
        </p>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive p-4 text-sm text-destructive whitespace-pre-wrap"
        >
          {error}
        </div>
      ) : null}
      {message ? (
        <p role="status" className="text-sm text-green-700">
          {message}
        </p>
      ) : null}
      {!context ? (
        <p>Loading monthly information…</p>
      ) : (
        <>
          <section className="surface p-5">
            <h2 className="font-semibold">Completion checklist</h2>
            <p className="mt-1 text-sm">
              {context.review?.status ?? 'Not started'} ·{' '}
              {context.missing.length} outstanding source submission(s) ·
              Narrative{' '}
              {context.narrativeCurrent
                ? 'checked against current sources'
                : 'needs checking'}
            </p>
            {context.missing.length ? (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-amber-700">
                  Show missing daily reports and weekly reviews
                </summary>
                <ul className="mt-2 list-disc pl-5 text-sm">
                  {context.missing.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </details>
            ) : null}
            <p className="mt-2 text-xs text-muted-foreground">
              Weeks crossing month-end must finish. Financial figures remain
              restricted to {context.range.from}–{context.range.to}. Ordinary
              financial-summary downloads are separate.
            </p>
          </section>
          <section className="surface p-5">
            <h2 className="font-semibold">Calculated executive summary</h2>
            <div className="mt-3 space-y-2 text-sm">
              {context.summary.facts.map((f) => (
                <p key={f}>{f}</p>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              System figures cannot be edited. Explanations below are attributed
              manager records, not automatically proven causes.
            </p>
            <div className="mt-4">
              {textField(
                'executiveSummary',
                'Executive explanation — check and edit wording'
              )}
            </div>
            <details className="mt-3 text-sm">
              <summary>Supporting weekly sources</summary>
              {context.summary.evidence.map((e) => (
                <blockquote key={e.id} className="my-3 border-l-2 pl-3">
                  <strong>{e.label}</strong>
                  <p className="whitespace-pre-wrap">{e.text}</p>
                </blockquote>
              ))}
            </details>
            {!locked ? (
              <label className="mt-4 flex items-center gap-3 text-sm">
                <Checkbox
                  checked={confirmed}
                  onCheckedChange={(v) => setConfirmed(v === true)}
                />
                I have checked these current figures, sources and my
                explanation.
              </label>
            ) : null}
          </section>
          <section className="surface p-5">
            <h2 className="font-semibold">Store results and comments</h2>
            <p className="mt-2 text-lg font-semibold">
              {money(context.totalSales)} / {money(context.totalTarget)} target
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {context.stores.map(({ store, report }) => (
                <Field key={store.id}>
                  <FieldLabel>
                    {store.name}: {money(report?.totals.netRevenue ?? 0)} /{' '}
                    {money(report?.target ?? 0)}
                  </FieldLabel>
                  <p className="text-xs text-muted-foreground">
                    {report?.totals.unitsSold ?? 0} units ·{' '}
                    {report?.totals.transactions ?? 0} transactions ·{' '}
                    {report?.totals.footfall ?? 0} footfall
                  </p>
                  <Textarea
                    aria-label={`${store.name} monthly comment`}
                    disabled={locked}
                    value={draft.storeComments[String(store.id)] ?? ''}
                    onChange={(e) =>
                      update('storeComments', {
                        ...draft.storeComments,
                        [store.id]: e.target.value,
                      })
                    }
                  />
                </Field>
              ))}
            </div>
          </section>
          <ProductPerformanceTable
            data={context.performance}
            currency={context.currency}
          />
          <section className="surface p-5">
            <h2 className="font-semibold">
              Weekly reviews and category findings
            </h2>
            {context.weeklyReviews.map((w) => (
              <details key={w.id} className="mt-3 rounded border p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  {w.storeName}: {w.weekFrom}–{w.weekTo} · {w.status}
                </summary>
                {w.status === 'draft' ? (
                  <p className="mt-2 text-sm">
                    Draft review is not included in the final report.
                  </p>
                ) : (
                  <div className="mt-3 space-y-3 text-sm">
                    <p className="whitespace-pre-wrap">{w.summary}</p>
                    <p>Risks: {w.risks || 'Not recorded'}</p>
                    <p>Opportunities: {w.opportunities || 'Not recorded'}</p>
                    {w.categoryNotes.map((n) => (
                      <div key={n.id} className="border-t pt-2">
                        <strong>
                          {
                            context.categories.find(
                              (c) => c.id === n.categoryId
                            )?.name
                          }
                        </strong>
                        <p>{n.performanceComment}</p>
                        <p>{n.correctiveAction}</p>
                        <p>{n.managerComment}</p>
                      </div>
                    ))}
                    {w.actions.map((a) => (
                      <p key={a.id}>
                        {a.action} — {a.ownerName ?? 'Assigned user'} ·{' '}
                        {a.status} · due {a.dueDate ?? 'not set'}
                      </p>
                    ))}
                  </div>
                )}
              </details>
            ))}
          </section>
          <section className="surface p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Style-advisor performance</h2>
              {!locked ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    update('advisors', [
                      ...draft.advisors,
                      {
                        storeId: context.stores[0].store.id,
                        name: '',
                        actualSales: '0.00',
                        target: '0.00',
                      },
                    ])
                  }
                >
                  Add advisor
                </Button>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Manually recorded attribution. This does not change store sales.
            </p>
            {draft.advisors.map((a, index) => (
              <div
                key={index}
                className="mt-3 grid items-end gap-3 md:grid-cols-5"
              >
                <Field>
                  <FieldLabel htmlFor={`advisor-${index}-store`}>
                    Store
                  </FieldLabel>
                  <select
                    id={`advisor-${index}-store`}
                    className="h-9 rounded border px-2"
                    value={a.storeId}
                    disabled={locked}
                    onChange={(e) =>
                      update(
                        'advisors',
                        draft.advisors.map((v, i) =>
                          i === index
                            ? { ...v, storeId: Number(e.target.value) }
                            : v
                        )
                      )
                    }
                  >
                    {context.stores.map((s) => (
                      <option key={s.store.id} value={s.store.id}>
                        {s.store.name}
                      </option>
                    ))}
                  </select>
                </Field>
                {(['name', 'actualSales', 'target'] as const).map((key) => (
                  <Field key={key}>
                    <FieldLabel htmlFor={`advisor-${index}-${key}`}>
                      {
                        {
                          name: 'Name',
                          actualSales: 'Actual sales',
                          target: 'Target',
                        }[key]
                      }
                    </FieldLabel>
                    <Input
                      id={`advisor-${index}-${key}`}
                      value={a[key]}
                      type={key === 'name' ? 'text' : 'number'}
                      min={0}
                      step="0.01"
                      disabled={locked}
                      onChange={(e) =>
                        update(
                          'advisors',
                          draft.advisors.map((v, i) =>
                            i === index ? { ...v, [key]: e.target.value } : v
                          )
                        )
                      }
                    />
                  </Field>
                ))}
                <div className="text-sm">
                  {Number(a.target) > 0
                    ? (
                        (Number(a.actualSales) / Number(a.target)) *
                        100
                      ).toFixed(1) + '%'
                    : 'No target'}
                  {!locked ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        update(
                          'advisors',
                          draft.advisors.filter((_, i) => i !== index)
                        )
                      }
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
            {context.stores.map((s) => {
              const allocated = draft.advisors
                .filter((a) => a.storeId === s.store.id)
                .reduce((sum, a) => sum + Number(a.actualSales || 0), 0);
              const difference = (s.report?.totals.netRevenue ?? 0) - allocated;
              return difference !== 0 ? (
                <p key={s.store.id} className="mt-3 text-xs text-amber-700">
                  {s.store.name}: advisor allocation differs from store sales by{' '}
                  {money(difference)}.
                </p>
              ) : null;
            })}
          </section>
          <section className="surface grid gap-5 p-5 md:grid-cols-2">
            {textField(
              'managementOutcomes',
              'Management actions executed and outcomes'
            )}
            {textField(
              'operationalAssessment',
              'Operational / maintenance assessment'
            )}
          </section>
          <section className="surface p-5">
            <h2 className="font-semibold">
              Outstanding commitments from previous months
            </h2>
            {context.carriedActions.length ? (
              context.carriedActions.map((a) => {
                const edit = draft.carriedActions.find((v) => v.id === a.id);
                return (
                  <div
                    className="mt-3 grid gap-3 rounded border p-3 md:grid-cols-3"
                    key={a.id}
                  >
                    <div className="text-sm">
                      <strong>{a.action}</strong>
                      <p>
                        {a.ownerName} · due {a.dueDate} · from {a.originMonth}
                      </p>
                    </div>
                    <select
                      aria-label={`Status for ${a.action}`}
                      className="h-9 rounded border px-2"
                      disabled={locked}
                      value={edit?.status ?? a.status}
                      onChange={(e) =>
                        update(
                          'carriedActions',
                          draft.carriedActions.map((v) =>
                            v.id === a.id
                              ? {
                                  ...v,
                                  status: e.target
                                    .value as MonthlyActionInput['status'],
                                }
                              : v
                          )
                        )
                      }
                    >
                      {['open', 'in-progress', 'completed', 'cancelled'].map(
                        (s) => (
                          <option key={s}>{s}</option>
                        )
                      )}
                    </select>
                    <Textarea
                      aria-label={`Progress for ${a.action}`}
                      disabled={locked}
                      value={edit?.progress ?? a.progress}
                      onChange={(e) =>
                        update(
                          'carriedActions',
                          draft.carriedActions.map((v) =>
                            v.id === a.id
                              ? { ...v, progress: e.target.value }
                              : v
                          )
                        )
                      }
                    />
                  </div>
                );
              })
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                No outstanding submitted commitments.
              </p>
            )}
          </section>
          <section className="surface p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">
                Next month: {context.nextRange.label}
              </h2>
              {!locked ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={draft.actions.length >= 5}
                  onClick={() =>
                    update('actions', [
                      ...draft.actions,
                      {
                        id: crypto.randomUUID(),
                        storeId: null,
                        action: '',
                        outcome: '',
                        ownerName: '',
                        dueDate: context.nextRange.to,
                        goal: '',
                        status: 'open',
                        progress: '',
                      },
                    ])
                  }
                >
                  Add priority ({draft.actions.length}/5)
                </Button>
              ) : null}
            </div>
            <div className="mt-3 text-sm">
              {context.nextTargets.map((t) => (
                <p key={t.storeId}>
                  {
                    context.stores.find((s) => s.store.id === t.storeId)?.store
                      .name
                  }
                  : {money(t.target)} Commercial target
                </p>
              ))}
            </div>
            {draft.actions.map((a, index) => (
              <div
                key={a.id}
                className="mt-4 grid gap-3 rounded border p-4 md:grid-cols-2"
              >
                {(
                  [
                    'action',
                    'outcome',
                    'ownerName',
                    'dueDate',
                    'goal',
                    'progress',
                  ] as const
                ).map((key) => (
                  <Field key={key}>
                    <FieldLabel htmlFor={`priority-${a.id}-${key}`}>
                      {
                        {
                          action: 'Action',
                          outcome: 'Intended outcome',
                          ownerName: 'Responsible person',
                          dueDate: 'Due date',
                          goal: 'Measurable goal',
                          progress: 'Progress',
                        }[key]
                      }
                    </FieldLabel>
                    <Input
                      id={`priority-${a.id}-${key}`}
                      value={a[key]}
                      type={key === 'dueDate' ? 'date' : 'text'}
                      disabled={locked}
                      onChange={(e) => actionField(index, key, e.target.value)}
                    />
                  </Field>
                ))}
                <Field>
                  <FieldLabel htmlFor={`priority-${a.id}-store`}>
                    Store
                  </FieldLabel>
                  <select
                    id={`priority-${a.id}-store`}
                    className="h-9 rounded border px-2"
                    disabled={locked}
                    value={a.storeId ?? ''}
                    onChange={(e) =>
                      update(
                        'actions',
                        draft.actions.map((v, i) =>
                          i === index
                            ? {
                                ...v,
                                storeId: e.target.value
                                  ? Number(e.target.value)
                                  : null,
                              }
                            : v
                        )
                      )
                    }
                  >
                    <option value="">Whole reporting scope</option>
                    {context.stores.map((s) => (
                      <option key={s.store.id} value={s.store.id}>
                        {s.store.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field>
                  <FieldLabel htmlFor={`priority-${a.id}-status`}>
                    Status
                  </FieldLabel>
                  <select
                    id={`priority-${a.id}-status`}
                    className="h-9 rounded border px-2"
                    disabled={locked}
                    value={a.status}
                    onChange={(e) =>
                      actionField(index, 'status', e.target.value)
                    }
                  >
                    {['open', 'in-progress', 'completed', 'cancelled'].map(
                      (s) => (
                        <option key={s}>{s}</option>
                      )
                    )}
                  </select>
                </Field>
                {!locked ? (
                  <Button
                    variant="ghost"
                    onClick={() =>
                      update(
                        'actions',
                        draft.actions.filter((_, i) => i !== index)
                      )
                    }
                  >
                    Remove priority
                  </Button>
                ) : null}
              </div>
            ))}
          </section>
          <section className="surface p-5">
            {textField('conclusion', 'Manager’s final conclusion')}
          </section>
          {!readOnly && context.review?.status === 'submitted' ? (
            <section className="surface p-5">
              <h2 className="font-semibold">Reopen for a correction</h2>
              <p className="my-2 text-sm text-muted-foreground">
                The reason and changes will be audited. Reopening pauses the
                final performance download until resubmission.
              </p>
              <Input
                aria-label="Reopen reason"
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
              />
              <Button
                className="mt-3"
                variant="outline"
                disabled={busy || !reopenReason.trim()}
                onClick={() => void reopen()}
              >
                Reopen monthly review
              </Button>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
