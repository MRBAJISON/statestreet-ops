'use client';

import { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { LeadMetricPage, LeadMetricRecord } from '@/lib/contracts/lead-metrics';
import { leadMetricSchema } from '@/lib/contracts/workflows';
import { formatContractError } from '@/lib/contracts/shared';

function emptyDraft() {
  const today = new Date().toISOString().slice(0, 10);
  return { periodStart: today, periodEnd: today, channel: '', leadCount: '', qualifiedCount: '', convertedCount: '', averageValue: '', notes: '' };
}

export function LeadSummarySheet({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState('entry');
  const [draft, setDraft] = useState(emptyDraft);
  const [editing, setEditing] = useState<LeadMetricRecord | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [history, setHistory] = useState<LeadMetricPage | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/lead-metrics?page=${page}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? 'Summaries could not be loaded');
        setHistory(data);
        setHistoryError(null);
      })
      .catch((failure: Error) => { if (failure.name !== 'AbortError') setHistoryError(failure.message); });
    return () => controller.abort();
  }, [page, refresh]);

  function startNew() {
    setEditing(null); setDraft(emptyDraft()); setReason(''); setError(null); setTab('entry');
  }

  function edit(record: LeadMetricRecord) {
    setEditing(record);
    setDraft({
      periodStart: record.periodStart, periodEnd: record.periodEnd, channel: record.channel,
      leadCount: String(record.leadCount), qualifiedCount: String(record.qualifiedCount), convertedCount: String(record.convertedCount),
      averageValue: record.averageValue ?? '', notes: record.notes ?? '',
    });
    setReason(''); setError(null); setTab('entry');
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    const parsed = leadMetricSchema.safeParse({
      ...draft, leadCount: Number(draft.leadCount), qualifiedCount: Number(draft.qualifiedCount), convertedCount: Number(draft.convertedCount),
      campaignReportId: editing?.campaignReportId ?? undefined,
    });
    if (!parsed.success) { setError(formatContractError(parsed.error)); return; }
    if (editing && !reason.trim()) { setError('Explain the correction before saving'); return; }
    setSaving(true); setError(null);
    try {
      const response = await fetch(editing ? `/api/lead-metrics?id=${editing.id}` : '/api/workflows/lead-metric', {
        method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? { summary: parsed.data, lockVersion: editing.lockVersion, reason } : parsed.data),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Summary could not be saved');
      toast.success(editing ? 'Lead summary corrected' : 'Lead summary saved');
      startNew(); setTab('history'); setPage(1); setHistory(null); setRefresh((value) => value + 1);
    } catch (failure) { setError((failure as Error).message); }
    finally { setSaving(false); }
  }

  const fields = [
    ['periodStart', 'Start date', 'date'], ['periodEnd', 'End date', 'date'],
    ['channel', 'Channel', 'text'], ['leadCount', 'Leads', 'number'],
    ['qualifiedCount', 'Qualified', 'number'], ['convertedCount', 'Converted', 'number'],
    ['averageValue', 'Average value (optional)', 'number'],
  ] as const;

  return <Sheet open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
    <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
      <SheetHeader>
        <SheetTitle>Lead channel summary</SheetTitle>
        <SheetDescription>Record totals for the whole date range, including both dates. Use the same date for a single day. Split ranges crossing month-end into separate summaries.</SheetDescription>
      </SheetHeader>
      <Tabs value={tab} onValueChange={setTab} className="px-5 pb-5">
        <TabsList><TabsTrigger value="entry">{editing ? 'Edit summary' : 'New summary'}</TabsTrigger><TabsTrigger value="history" disabled={saving}>Saved summaries</TabsTrigger></TabsList>
        <TabsContent value="entry">
          <form onSubmit={(event) => void save(event)} className="mt-4 space-y-5">
            {editing ? <div className="flex items-center justify-between gap-3 text-sm"><span>Correcting summary #{editing.id}{editing.campaignReportId ? ` · Campaign #${editing.campaignReportId}` : ' · Group channel'}</span><Button type="button" variant="outline" disabled={saving} onClick={startNew}>New summary</Button></div> : null}
            <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
              {fields.map(([key, label, type]) => <Field key={key}>
                <FieldLabel htmlFor={`lead-${key}`}>{label}</FieldLabel>
                <Input id={`lead-${key}`} type={type} required={key !== 'averageValue'} min={type === 'number' ? 0 : undefined}
                  max={type === 'number' && key !== 'averageValue' ? 100000000 : undefined}
                  maxLength={key === 'channel' ? 120 : undefined} step={key === 'averageValue' ? '0.01' : undefined}
                  value={draft[key]} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))} />
              </Field>)}
              <Field className="sm:col-span-2"><FieldLabel htmlFor="lead-notes">Notes</FieldLabel><Textarea id="lead-notes" maxLength={1000} value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} /></Field>
              {editing ? <Field className="sm:col-span-2"><FieldLabel htmlFor="lead-reason">Reason for correction</FieldLabel><Textarea id="lead-reason" required maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} /></Field> : null}
            </fieldset>
            <p className="text-xs text-muted-foreground">Counts are not spread across individual days. Only summaries fully within a dashboard or export date range enter its totals.</p>
            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={saving} onClick={onClose}>Close</Button><Button type="submit" disabled={saving}>{saving ? <LoaderCircle className="animate-spin" /> : null}{editing ? 'Save correction' : 'Save summary'}</Button></div>
          </form>
        </TabsContent>
        <TabsContent value="history" className="space-y-3">
          <div className="flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Edit existing entries to avoid double counting.</p><Button variant="outline" onClick={() => { setHistory(null); setRefresh((value) => value + 1); }}>Reload</Button></div>
          {historyError ? <p role="alert" className="text-sm text-destructive">{historyError}</p> : !history ? <p>Loading summaries…</p> : <>
            {history.records.length ? history.records.map((record) => <div key={record.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
              <div className="min-w-0 text-sm"><p className="break-words font-medium">{record.channel}</p><p>{record.periodStart} to {record.periodEnd}</p><p className="text-muted-foreground">{record.leadCount} leads · {record.qualifiedCount} qualified · {record.convertedCount} converted</p>{record.campaignReportId ? <p>Campaign #{record.campaignReportId}</p> : null}</div>
              <Button variant="outline" onClick={() => edit(record)} aria-label={`Edit ${record.channel} ${record.periodStart} to ${record.periodEnd}`}>Edit</Button>
            </div>) : <p className="py-5 text-sm text-muted-foreground">No lead summaries saved yet.</p>}
            <div className="flex items-center justify-between gap-2"><Button variant="outline" disabled={page <= 1} onClick={() => { setHistory(null); setPage(page - 1); }}>Previous</Button><span className="text-sm">Page {history.page} of {history.totalPages}</span><Button variant="outline" disabled={page >= history.totalPages} onClick={() => { setHistory(null); setPage(page + 1); }}>Next</Button></div>
          </>}
        </TabsContent>
      </Tabs>
    </SheetContent>
  </Sheet>;
}
