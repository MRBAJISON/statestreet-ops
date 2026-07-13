'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileUp,
  History,
  LoaderCircle,
  ReceiptText,
  RotateCcw,
  Upload,
  WalletCards,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

interface RowError {
  rowNum: number;
  messages: string[];
  values: Record<string, string>;
}

interface ExpenseRow {
  rowNum: number;
  data: { date: string; category: string; store: string; amount: number; description: string };
}

interface BudgetRow {
  rowNum: number;
  data: { year: string; item: string; amount: number; notes: string };
}

interface Conflict {
  rowNum: number;
  key: string;
  existingAmount: number;
  data: { year: string; item: string; amount: number };
}

interface Preview {
  expenses: { valid: ExpenseRow[]; errors: RowError[] };
  budget: { newRows: BudgetRow[]; conflicts: Conflict[]; errors: RowError[] };
}

interface ImportBatch {
  id: number;
  batchId: string;
  filename: string;
  status: string;
  uploadedBy: string;
  uploadedAt: string;
  undoneAt: string | null;
  canUndo: boolean;
  expensesAdded: number;
  budgetAdded: number;
  budgetUpdated: number;
  budgetSkipped: number;
  expenseErrors: number;
  budgetErrors: number;
}

async function responseError(response: Response) {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return payload?.error ?? 'The request could not be completed';
}

async function fileBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error ?? new Error('The file could not be read'));
    reader.readAsDataURL(file);
  });
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'completed') return <Badge className="bg-primary/10 text-primary">Completed</Badge>;
  if (status === 'undone') return <Badge variant="outline">Undone</Badge>;
  return <Badge variant="secondary" className="capitalize">{status}</Badge>;
}

function countLabel(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function humanize(value: string) {
  return value.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function ImportPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [fileData, setFileData] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [decisions, setDecisions] = useState<Record<string, 'allow' | 'deny'>>({});
  const [history, setHistory] = useState<ImportBatch[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [pending, setPending] = useState<'preview' | 'import' | 'undo' | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [undoTarget, setUndoTarget] = useState<ImportBatch | null>(null);
  const [undoError, setUndoError] = useState('');

  const loadHistory = useCallback(async () => {
    try {
      const response = await fetch('/api/import/finance', { cache: 'no-store' });
      if (!response.ok) throw new Error(await responseError(response));
      const payload = (await response.json()) as { batches: ImportBatch[] };
      setHistory(payload.batches ?? []);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  function resetPreview() {
    setPreview(null);
    setFileName('');
    setFileData('');
    setDecisions({});
    if (inputRef.current) inputRef.current.value = '';
  }

  async function previewFile(file: File) {
    setError('');
    setSuccess('');
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setError('Choose an .xlsx workbook');
      return;
    }
    if (file.size > 5_000_000) {
      setError('File is larger than 5 MB');
      return;
    }
    setPending('preview');
    try {
      const base64 = await fileBase64(file);
      const response = await fetch('/api/import/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileBase64: base64, filename: file.name, confirm: false }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const payload = (await response.json()) as Preview;
      setFileName(file.name);
      setFileData(base64);
      setPreview(payload);
      setDecisions(Object.fromEntries(payload.budget.conflicts.map((conflict) => [conflict.key, 'deny'])));
    } catch (caught) {
      resetPreview();
      setError((caught as Error).message);
    } finally {
      setPending(null);
    }
  }

  function updateAll(decision: 'allow' | 'deny') {
    if (!preview) return;
    setDecisions(Object.fromEntries(preview.budget.conflicts.map((conflict) => [conflict.key, decision])));
  }

  async function confirmImport() {
    if (!preview || !fileData) return;
    setPending('import');
    setError('');
    try {
      const response = await fetch('/api/import/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileBase64: fileData, filename: fileName, confirm: true, decisions }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const payload = (await response.json()) as {
        result: { expensesAdded: number; budgetAdded: number; budgetUpdated: number; budgetSkipped: number };
      };
      const result = payload.result;
      const message = `${countLabel(result.expensesAdded, 'expense')}, ${countLabel(result.budgetAdded, 'budget')} added, ${countLabel(result.budgetUpdated, 'budget')} updated`;
      setSuccess(message);
      toast.success('Finance import completed');
      resetPreview();
      await loadHistory();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setPending(null);
    }
  }

  async function undoImport() {
    if (!undoTarget) return;
    setPending('undo');
    setUndoError('');
    try {
      const response = await fetch(`/api/import/finance?batchId=${encodeURIComponent(undoTarget.batchId)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await responseError(response));
      const payload = (await response.json()) as { deleted: number; restored: number };
      setSuccess(`${countLabel(payload.deleted, 'inserted row')} removed and ${countLabel(payload.restored, 'overwritten budget')} restored`);
      toast.success('Finance import undone');
      setUndoTarget(null);
      await loadHistory();
    } catch (caught) {
      setUndoError((caught as Error).message);
    } finally {
      setPending(null);
    }
  }

  const conflictsAllowed = preview?.budget.conflicts.filter((conflict) => decisions[conflict.key] === 'allow').length ?? 0;
  const importCount = preview ? preview.expenses.valid.length + preview.budget.newRows.length + conflictsAllowed : 0;
  const errorCount = preview ? preview.expenses.errors.length + preview.budget.errors.length : 0;

  return (
    <div className="page-shell">
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-md bg-chart-4/12 text-chart-4"><FileSpreadsheet className="size-5" /></span>
            <div>
              <h1 className="text-xl font-semibold">Finance import</h1>
              <p className="text-sm text-muted-foreground">Expenses and annual budgets</p>
            </div>
          </div>
          <Button variant="outline" asChild><a href="/api/import/finance/template"><Download /> Download template</a></Button>
        </header>

        {error ? <Alert variant="destructive"><XCircle /><AlertTitle>Import could not continue</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
        {success ? <Alert><CheckCircle2 /><AlertTitle>Completed</AlertTitle><AlertDescription>{success}</AlertDescription></Alert> : null}

        {!preview ? (
          <section
            className={cn('surface flex min-h-64 flex-col items-center justify-center border-dashed px-6 py-10 text-center transition-colors', dragging && 'border-primary bg-primary/5')}
            onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              const file = event.dataTransfer.files[0];
              if (file) void previewFile(file);
            }}
          >
            <span className="mb-4 flex size-12 items-center justify-center rounded-md bg-chart-1/12 text-chart-1"><FileUp className="size-6" /></span>
            <h2 className="font-semibold">Finance workbook</h2>
            <p className="mt-1 text-sm text-muted-foreground">.xlsx · maximum 5 MB</p>
            <Button className="mt-5" onClick={() => inputRef.current?.click()} disabled={pending === 'preview'}>
              {pending === 'preview' ? <LoaderCircle className="animate-spin" /> : <Upload />}
              Choose workbook
            </Button>
            <input ref={inputRef} type="file" accept=".xlsx" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void previewFile(file); }} />
          </section>
        ) : (
          <section className="surface overflow-hidden">
            <div className="flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate font-medium">{fileName}</p>
                <p className="text-xs text-muted-foreground">Review before importing</p>
              </div>
              <Button variant="ghost" onClick={resetPreview} disabled={Boolean(pending)}>Choose another file</Button>
            </div>

            <div className="grid grid-cols-2 gap-px bg-border md:grid-cols-4">
              <div className="bg-card px-4 py-4"><ReceiptText className="mb-2 size-4 text-chart-3" /><p className="text-xl font-semibold">{preview.expenses.valid.length}</p><p className="text-xs text-muted-foreground">Expenses ready</p></div>
              <div className="bg-card px-4 py-4"><WalletCards className="mb-2 size-4 text-chart-1" /><p className="text-xl font-semibold">{preview.budget.newRows.length}</p><p className="text-xs text-muted-foreground">Budgets to add</p></div>
              <div className="bg-card px-4 py-4"><AlertTriangle className="mb-2 size-4 text-chart-2" /><p className="text-xl font-semibold">{preview.budget.conflicts.length}</p><p className="text-xs text-muted-foreground">Overwrite decisions</p></div>
              <div className="bg-card px-4 py-4"><XCircle className="mb-2 size-4 text-destructive" /><p className="text-xl font-semibold">{errorCount}</p><p className="text-xs text-muted-foreground">Rows skipped</p></div>
            </div>

            {preview.budget.conflicts.length ? (
              <div className="border-t px-4 py-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div><h3 className="font-medium">Existing budgets</h3><p className="text-xs text-muted-foreground">Keep the current figure or replace it with the workbook value.</p></div>
                  <ToggleGroup type="single" variant="outline" spacing={0} onValueChange={(value) => { if (value) updateAll(value as 'allow' | 'deny'); }}>
                    <ToggleGroupItem value="deny">Keep all</ToggleGroupItem>
                    <ToggleGroupItem value="allow">Replace all</ToggleGroupItem>
                  </ToggleGroup>
                </div>
                <div className="divide-y border-y">
                  {preview.budget.conflicts.map((conflict) => (
                    <div key={conflict.key} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1"><p className="truncate font-medium">{humanize(conflict.data.item)}</p><p className="text-xs text-muted-foreground">{conflict.data.year} · GHS {conflict.existingAmount.toLocaleString()} → GHS {conflict.data.amount.toLocaleString()}</p></div>
                      <ToggleGroup type="single" value={decisions[conflict.key] ?? 'deny'} onValueChange={(value) => { if (value) setDecisions((current) => ({ ...current, [conflict.key]: value as 'allow' | 'deny' })); }} variant="outline" spacing={0}>
                        <ToggleGroupItem value="deny">Keep</ToggleGroupItem>
                        <ToggleGroupItem value="allow">Replace</ToggleGroupItem>
                      </ToggleGroup>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {errorCount ? (
              <div className="border-t px-4 py-4">
                <h3 className="font-medium">Skipped rows</h3>
                <div className="mt-2 max-h-44 divide-y overflow-y-auto border-y">
                  {[...preview.expenses.errors.map((row) => ({ ...row, sheet: 'Expenses' })), ...preview.budget.errors.map((row) => ({ ...row, sheet: 'Budget' }))].map((row) => (
                    <div key={`${row.sheet}-${row.rowNum}`} className="py-2 text-sm"><span className="font-medium">{row.sheet} · row {row.rowNum}</span><span className="ml-2 text-muted-foreground">{row.messages.join('; ')}</span></div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-2 border-t bg-muted/25 px-4 py-4 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={resetPreview} disabled={Boolean(pending)}>Cancel</Button>
              <Button onClick={confirmImport} disabled={Boolean(pending) || importCount === 0}>
                {pending === 'import' ? <LoaderCircle className="animate-spin" /> : <Upload />}
                Import {importCount} {importCount === 1 ? 'row' : 'rows'}
              </Button>
            </div>
          </section>
        )}

        <section className="surface overflow-hidden">
          <div className="flex items-center gap-2 border-b px-4 py-3"><History className="size-4 text-chart-5" /><h2 className="font-medium">Import history</h2></div>
          {historyLoading ? (
            <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground"><LoaderCircle className="mr-2 size-4 animate-spin" /> Loading history</div>
          ) : history.length ? (
            <Table>
              <TableHeader><TableRow><TableHead className="pl-4">File</TableHead><TableHead className="hidden sm:table-cell">Imported</TableHead><TableHead className="hidden md:table-cell">Result</TableHead><TableHead>Status</TableHead><TableHead className="w-12"><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
              <TableBody>
                {history.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell className="max-w-[260px] pl-4"><span className="block truncate font-medium">{batch.filename}</span><span className="block truncate text-xs text-muted-foreground">{batch.uploadedBy || 'StateStreet'} · {new Date(batch.uploadedAt).toLocaleDateString('en-GB')}</span><span className="mt-1 block text-xs text-muted-foreground md:hidden">{batch.expensesAdded} expenses · {batch.budgetAdded + batch.budgetUpdated} budgets</span></TableCell>
                    <TableCell className="hidden sm:table-cell">{new Date(batch.uploadedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">{batch.expensesAdded} expenses · {batch.budgetAdded} added · {batch.budgetUpdated} updated</TableCell>
                    <TableCell><StatusBadge status={batch.status} /></TableCell>
                    <TableCell>{batch.canUndo ? <Button variant="ghost" size="icon-sm" onClick={() => { setUndoError(''); setUndoTarget(batch); }} aria-label={`Undo ${batch.filename}`}><RotateCcw /></Button> : null}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Empty className="min-h-48"><EmptyHeader><EmptyMedia variant="icon"><History /></EmptyMedia><EmptyTitle>No imports yet</EmptyTitle><EmptyDescription>Completed imports will appear here.</EmptyDescription></EmptyHeader></Empty>
          )}
        </section>
      </div>

      <Dialog open={Boolean(undoTarget)} onOpenChange={(open) => { if (!open && pending !== 'undo') setUndoTarget(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Undo finance import</DialogTitle><DialogDescription>Inserted expenses and budgets will be removed. Budgets replaced by this import will be restored to their previous values.</DialogDescription></DialogHeader>
          {undoError ? <Alert variant="destructive"><XCircle /><AlertDescription>{undoError}</AlertDescription></Alert> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setUndoTarget(null)} disabled={pending === 'undo'}>Cancel</Button>
            <Button variant="destructive" onClick={undoImport} disabled={pending === 'undo'}>{pending === 'undo' ? <LoaderCircle className="animate-spin" /> : <RotateCcw />} Undo import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
