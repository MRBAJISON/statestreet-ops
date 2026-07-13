'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, LoaderCircle, RefreshCw, Search, SquarePen } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  actionDecisionSchema,
  dispositionDecisionSchema,
  incidentDecisionSchema,
  maintenanceDecisionSchema,
  mutableWorkflowSchema,
  type MutableWorkflow,
} from '@/lib/contracts/decisions';
import type { ReferenceDataResponse } from '@/lib/contracts/reference-data';
import type { MutableWorkflowRecord } from '@/lib/workflow-queries';
import { cn } from '@/lib/utils';
import type { WorkflowDefinition } from './workflow-config';

type MutableWorkflowDefinition = WorkflowDefinition & { id: MutableWorkflow };
type DecisionWorkflow = Exclude<MutableWorkflow, 'working-capital'>;

const TONE_STYLES: Record<WorkflowDefinition['tone'], string> = {
  blue: 'bg-chart-1/10 text-chart-1',
  green: 'bg-primary/10 text-primary',
  amber: 'bg-chart-2/14 text-amber-800',
  coral: 'bg-chart-3/10 text-destructive',
  teal: 'bg-chart-4/10 text-chart-4',
  orchid: 'bg-chart-5/10 text-chart-5',
};

const STATUS_STYLES: Record<string, string> = {
  approved: 'border-primary/20 bg-primary/10 text-primary',
  completed: 'border-primary/20 bg-primary/10 text-primary',
  resolved: 'border-primary/20 bg-primary/10 text-primary',
  partial: 'border-chart-2/25 bg-chart-2/12 text-amber-800',
  'in-progress': 'border-chart-1/20 bg-chart-1/10 text-chart-1',
  investigating: 'border-chart-1/20 bg-chart-1/10 text-chart-1',
  blocked: 'border-chart-3/20 bg-chart-3/10 text-destructive',
  rejected: 'border-chart-3/20 bg-chart-3/10 text-destructive',
  open: 'border-border bg-muted/70 text-foreground',
  proposed: 'border-border bg-muted/70 text-foreground',
};

function isMutableWorkflow(value: WorkflowDefinition['id']): value is MutableWorkflow {
  return mutableWorkflowSchema.safeParse(value).success;
}

function statusesFor(workflow: DecisionWorkflow): readonly string[] {
  if (workflow === 'action') return actionDecisionSchema.shape.status.options;
  if (workflow === 'maintenance') return maintenanceDecisionSchema.shape.status.options;
  if (workflow === 'incident') return incidentDecisionSchema.shape.status.options;
  return dispositionDecisionSchema.shape.status.options;
}

function localDatePart() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function titleCase(value: string) {
  return value.replaceAll('-', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value: string) {
  const date = value.includes('T') ? new Date(value) : new Date(`${value}T00:00:00Z`);
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function recordPresentation(record: MutableWorkflowRecord, money: Intl.NumberFormat) {
  if (record.workflow === 'action') {
    return {
      title: record.title,
      detail: [titleCase(record.department), titleCase(record.priority), record.storeName, record.dueDate ? `Due ${formatDate(record.dueDate)}` : null],
    };
  }
  if (record.workflow === 'maintenance') {
    return {
      title: record.category,
      detail: [record.storeName, titleCase(record.priority), record.dueDate ? `Due ${formatDate(record.dueDate)}` : formatDate(record.businessDate)],
    };
  }
  if (record.workflow === 'incident') {
    return {
      title: record.type,
      detail: [record.storeName, titleCase(record.severity), formatDate(record.occurredAt), record.followUpRequired ? 'Follow-up required' : null],
    };
  }
  if (record.workflow === 'inventory-disposition') {
    return {
      title: record.productName,
      detail: [record.productSku, record.storeName, titleCase(record.action), formatDate(record.reviewDate)],
    };
  }
  return {
    title: record.counterparty,
    detail: [titleCase(record.type), record.dueDate ? `Due ${formatDate(record.dueDate)}` : 'No due date', `${money.format(Number(record.openAmount))} open`],
  };
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'rounded-md px-1.5 py-0 text-[0.68rem] font-semibold capitalize',
        STATUS_STYLES[status] ?? 'bg-muted text-muted-foreground'
      )}
    >
      {status.replaceAll('-', ' ')}
    </Badge>
  );
}

async function responseError(response: Response) {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return payload?.error ?? 'The workflow could not be updated';
}

function LifecycleSheet({
  record,
  references,
  onOpenChange,
  onUpdated,
}: {
  record: MutableWorkflowRecord;
  references: ReferenceDataResponse;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}) {
  const [status, setStatus] = useState('');
  const [note, setNote] = useState('');
  const [businessDate, setBusinessDate] = useState(localDatePart);
  const [amount, setAmount] = useState('');
  const [cashAccountId, setCashAccountId] = useState('');
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const money = useMemo(
    () => new Intl.NumberFormat('en-GH', { style: 'currency', currency: references.organization.currency }),
    [references.organization.currency]
  );
  const isSettlement = record.workflow === 'working-capital';
  const statusOptions = isSettlement ? [] : statusesFor(record.workflow).filter((option) => option !== record.status);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let payload: Record<string, unknown>;
    if (isSettlement) {
      const openAmount = Number(record.openAmount);
      const settlementAmount = Number(amount);
      if (!Number.isFinite(settlementAmount) || settlementAmount <= 0) {
        setError('Enter a settlement amount greater than zero.');
        return;
      }
      if (settlementAmount > openAmount) {
        setError('Settlement amount cannot exceed the open amount.');
        return;
      }
      payload = {
        businessDate,
        amount,
        ...(cashAccountId ? { cashAccountId: Number(cashAccountId) } : {}),
        ...(reference.trim() ? { reference: reference.trim() } : {}),
      };
    } else {
      if (!statusOptions.includes(status)) {
        setError('Choose a new status.');
        return;
      }
      payload = { status, ...(note.trim() ? { note: note.trim() } : {}) };
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/workflows/${record.workflow}/${record.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await responseError(response));
      toast.success(isSettlement ? 'Settlement recorded' : 'Status updated');
      onOpenChange(false);
      onUpdated();
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open onOpenChange={(open) => { if (!saving) onOpenChange(open); }}>
      <SheetContent className="flex w-full flex-col p-0 data-[side=right]:sm:max-w-md">
        <SheetHeader className="border-b px-5 py-5 pr-12 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <SheetTitle>{isSettlement ? 'Record settlement' : 'Update lifecycle'}</SheetTitle>
            <StatusBadge status={record.status} />
          </div>
          <SheetDescription>
            {recordPresentation(record, money).title}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
            {error ? (
              <Alert variant="destructive" className="mb-5">
                <AlertCircle />
                <AlertTitle>Could not update</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            {isSettlement ? (
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="settlement-business-date">Business date</FieldLabel>
                  <Input
                    id="settlement-business-date"
                    type="date"
                    value={businessDate}
                    required
                    disabled={saving}
                    onChange={(event) => setBusinessDate(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="settlement-amount">Amount</FieldLabel>
                  <Input
                    id="settlement-amount"
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    max={record.openAmount}
                    step="0.01"
                    value={amount}
                    required
                    disabled={saving}
                    onChange={(event) => setAmount(event.target.value)}
                  />
                  <FieldDescription>
                    Open amount: {money.format(Number(record.openAmount))}
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="settlement-account">Cash account</FieldLabel>
                  <Select
                    value={cashAccountId || 'none'}
                    disabled={saving}
                    onValueChange={(value) => setCashAccountId(value === 'none' ? '' : value)}
                  >
                    <SelectTrigger id="settlement-account" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="none">No cash account</SelectItem>
                        {references.cashAccounts.map((account) => (
                          <SelectItem key={account.id} value={String(account.id)}>{account.name}</SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="settlement-reference">Reference</FieldLabel>
                  <Input
                    id="settlement-reference"
                    value={reference}
                    maxLength={120}
                    disabled={saving}
                    onChange={(event) => setReference(event.target.value)}
                  />
                </Field>
              </FieldGroup>
            ) : (
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="lifecycle-status">New status</FieldLabel>
                  <Select value={status} disabled={saving} onValueChange={setStatus}>
                    <SelectTrigger id="lifecycle-status" className="w-full">
                      <SelectValue placeholder="Choose status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {statusOptions.map((option) => (
                          <SelectItem key={option} value={option}>{titleCase(option)}</SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="lifecycle-note">Note</FieldLabel>
                  <Textarea
                    id="lifecycle-note"
                    value={note}
                    maxLength={1000}
                    disabled={saving}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </Field>
              </FieldGroup>
            )}
          </div>
          <SheetFooter className="border-t bg-background px-5 py-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Check data-icon="inline-start" />}
              {isSettlement ? 'Record settlement' : 'Update status'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function WorkflowRecordRow({
  definition,
  record,
  money,
  onSelect,
}: {
  definition: MutableWorkflowDefinition;
  record: MutableWorkflowRecord;
  money: Intl.NumberFormat;
  onSelect: (record: MutableWorkflowRecord) => void;
}) {
  const Icon = definition.icon;
  const presentation = recordPresentation(record, money);
  return (
    <div className="flex min-h-[4.5rem] min-w-0 items-center gap-3 px-3 py-2.5 sm:px-4">
      <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-md', TONE_STYLES[definition.tone])}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{presentation.title}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {presentation.detail.filter(Boolean).join(' / ')}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <StatusBadge status={record.status} />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`Update ${presentation.title}`}
          title="Update lifecycle"
          onClick={() => onSelect(record)}
        >
          <SquarePen />
          <span className="hidden sm:inline">Update</span>
        </Button>
      </div>
    </div>
  );
}

export function WorkflowLifecycle({
  definitions,
  references,
  refreshKey,
}: {
  definitions: WorkflowDefinition[];
  references: ReferenceDataResponse;
  refreshKey: number;
}) {
  const mutableDefinitions = useMemo(
    () => definitions.filter((definition): definition is MutableWorkflowDefinition => isMutableWorkflow(definition.id)),
    [definitions]
  );
  const workflowKey = mutableDefinitions.map((definition) => definition.id).join(',');
  const [records, setRecords] = useState<Partial<Record<MutableWorkflow, MutableWorkflowRecord[]>> | null>(null);
  const [selected, setSelected] = useState<MutableWorkflowRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const money = useMemo(
    () => new Intl.NumberFormat('en-GH', { style: 'currency', currency: references.organization.currency }),
    [references.organization.currency]
  );

  useEffect(() => {
    if (!workflowKey) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const workflows = workflowKey.split(',') as MutableWorkflow[];
    setLoading(true);
    setError(null);
    Promise.all(
      workflows.map(async (workflow) => {
        const response = await fetch(`/api/workflows/${workflow}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok) throw new Error(await responseError(response));
        const payload = (await response.json()) as { records?: MutableWorkflowRecord[] };
        if (!Array.isArray(payload.records) || payload.records.some((record) => record.workflow !== workflow)) {
          throw new Error('Workflow records returned an invalid response');
        }
        return [workflow, payload.records] as const;
      })
    )
      .then((entries) => setRecords(Object.fromEntries(entries)))
      .catch((loadError: Error) => {
        if (loadError.name !== 'AbortError') setError(loadError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [workflowKey, refreshKey, reloadKey]);

  if (!mutableDefinitions.length) return null;
  const visibleGroups = mutableDefinitions
    .map((definition) => ({ definition, records: records?.[definition.id] ?? [] }))
    .filter((group) => group.records.length > 0);
  const totalRecords = visibleGroups.reduce((total, group) => total + group.records.length, 0);

  return (
    <section className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-[0.94rem] font-semibold leading-5">Recent and open items</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Progress work without reopening its original form.</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Refresh recent items"
          title="Refresh recent items"
          disabled={loading}
          onClick={() => setReloadKey((current) => current + 1)}
        >
          <RefreshCw className={cn(loading && 'animate-spin')} />
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive" className="mb-3">
          <AlertCircle />
          <AlertTitle>Recent items unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading && !records ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-[4.5rem] w-full" />
          <Skeleton className="h-[4.5rem] w-full" />
        </div>
      ) : error && !records ? null : totalRecords === 0 ? (
        <Empty className="min-h-36 border border-dashed border-border/70 bg-card/40 py-5">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Search /></EmptyMedia>
            <EmptyTitle>No open or recent items</EmptyTitle>
            <EmptyDescription>New mutable records will appear here after they are saved.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-md bg-card/70 ring-1 ring-border/70 shadow-[0_1px_2px_oklch(0.25_0.025_235/0.04)]">
          {visibleGroups.map(({ definition, records: workflowRecords }, groupIndex) => {
            return (
              <div key={definition.id} className={cn(groupIndex > 0 && 'border-t border-border/60')}>
                {mutableDefinitions.length > 1 ? (
                  <div className="bg-muted/35 px-4 py-2 text-xs font-semibold text-muted-foreground">
                    {definition.title}
                  </div>
                ) : null}
                <div className="divide-y divide-border/55">
                  {workflowRecords.map((record) => (
                    <WorkflowRecordRow
                      key={`${record.workflow}-${record.id}`}
                      definition={definition}
                      record={record}
                      money={money}
                      onSelect={setSelected}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected ? (
        <LifecycleSheet
          key={`${selected.workflow}-${selected.id}`}
          record={selected}
          references={references}
          onOpenChange={(open) => { if (!open) setSelected(null); }}
          onUpdated={() => setReloadKey((current) => current + 1)}
        />
      ) : null}
    </section>
  );
}
