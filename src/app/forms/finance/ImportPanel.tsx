'use client';

import { useCallback, useEffect, useState } from 'react';
import { Spinner } from '@/components/ui/BrandedLoader';
import { ShowMoreRows } from '@/components/ui/ShowMore';

const fmt = (n: number) => `GHS ${Math.round(n).toLocaleString()}`;

interface RowError { rowNum: number; messages: string[]; values: Record<string, string> }
interface ExpenseRow { rowNum: number; data: { date: string; category: string; amount: number } }
interface BudgetRow { rowNum: number; data: { year: string; item: string; amount: number } }
interface Conflict { rowNum: number; key: string; existingAmount: number; data: { year: string; item: string; amount: number } }
interface Preview {
  expenses: { valid: ExpenseRow[]; errors: RowError[] };
  budget: { newRows: BudgetRow[]; conflicts: Conflict[]; errors: RowError[] };
}
interface LogEntry {
  id: number;
  payload: { batchId?: string; filename?: string; uploadedBy?: string; uploadedAt?: string;
    expensesAdded?: number; budgetAdded?: number; budgetUpdated?: number; budgetSkipped?: number };
}

export default function ImportPanel() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fileB64, setFileB64] = useState('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [decisions, setDecisions] = useState<Record<string, 'allow' | 'deny'>>({});
  const [result, setResult] = useState<string>('');
  const [history, setHistory] = useState<LogEntry[]>([]);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/entries?department=finance&formType=import-log', { cache: 'no-store' });
      const data = await res.json();
      setHistory((data.entries ?? []) as LogEntry[]);
    } catch { /* non-fatal */ }
  }, []);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  function reset() { setPreview(null); setResult(''); setDecisions({}); setError(''); }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    reset();
    if (file.size > 5_000_000) { setError('File too large (max 5 MB).'); return; }
    const b64 = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    setFileB64(b64); setFileName(file.name);
    setBusy(true);
    try {
      const res = await fetch('/api/import/finance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileBase64: b64, filename: file.name, confirm: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not read file');
      setPreview(data as Preview);
      const d: Record<string, 'allow' | 'deny'> = {};
      for (const c of data.budget.conflicts as Conflict[]) d[c.key] = 'deny';
      setDecisions(d);
    } catch (err) { setError((err as Error).message); }
    setBusy(false);
  }

  const setAll = (v: 'allow' | 'deny') => {
    if (!preview) return;
    const d: Record<string, 'allow' | 'deny'> = {};
    for (const c of preview.budget.conflicts) d[c.key] = v;
    setDecisions(d);
  };

  const allowedConflicts = preview ? preview.budget.conflicts.filter((c) => decisions[c.key] === 'allow').length : 0;
  const willImport = preview ? preview.expenses.valid.length + preview.budget.newRows.length + allowedConflicts : 0;

  async function confirmImport() {
    if (!preview) return;
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/import/finance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileBase64: fileB64, filename: fileName, confirm: true, decisions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      const r = data.result;
      setResult(`Imported: ${r.expensesAdded} expenses, ${r.budgetAdded} new budgets, ${r.budgetUpdated} updated, ${r.budgetSkipped} skipped.`);
      setPreview(null); setFileB64('');
      loadHistory();
    } catch (err) { setError((err as Error).message); }
    setBusy(false);
  }

  async function undo(batchId?: string) {
    if (!batchId) return;
    if (!window.confirm('Undo this import? It removes the rows it added (overwritten budgets are not restored).')) return;
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/import/finance?batchId=${encodeURIComponent(batchId)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Undo failed');
      setResult(`Undone — ${data.deleted} rows removed.`);
      loadHistory();
    } catch (err) { setError((err as Error).message); }
    setBusy(false);
  }

  const card = 'bg-[var(--c-card2)] border border-[var(--c-border)] rounded-lg p-4';

  return (
    <div className="space-y-4 max-w-4xl">
      <div className={card}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-sm font-semibold">Import Expenses & Budget from Excel</div>
            <div className="text-xs text-gray-500 mt-0.5">Download the template, fill the Expenses and Budget sheets, then upload. You will see a preview before anything is saved.</div>
          </div>
          <div className="flex items-center gap-2">
            <a href="/api/import/finance/template" className="text-xs text-[#c8a951] hover:underline whitespace-nowrap">Download template</a>
            <label className="bg-[#c8a951] hover:bg-[#d4bf7a] text-black font-semibold px-4 py-2 rounded-lg text-sm cursor-pointer whitespace-nowrap">
              {busy ? <><Spinner /> Working…</> : 'Upload Excel'}
              <input type="file" accept=".xlsx" onChange={onFile} className="hidden" disabled={busy} />
            </label>
          </div>
        </div>
        {error && <div className="mt-3 text-xs p-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400">{error}</div>}
        {result && <div className="mt-3 text-xs p-2 rounded-lg border border-green-500/30 bg-green-500/10 text-green-400">{result}</div>}
      </div>

      {preview && (
        <div className={card}>
          <div className="text-sm font-semibold mb-3">Preview — {fileName}</div>

          {/* Expenses */}
          <div className="mb-4">
            <div className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">Expenses</div>
            <div className="text-xs text-green-400">✓ {preview.expenses.valid.length} ready to import</div>
            {preview.expenses.errors.length > 0 && (
              <div className="mt-1">
                <div className="text-xs text-red-400">✕ {preview.expenses.errors.length} rows will be skipped:</div>
                <ul className="mt-1 space-y-0.5 max-h-32 overflow-y-auto">
                  {preview.expenses.errors.map((e) => (
                    <li key={e.rowNum} className="text-[0.7rem] text-gray-400">Row {e.rowNum}: {e.messages.join('; ')}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Budget */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">Budget</div>
            <div className="text-xs text-green-400">✓ {preview.budget.newRows.length} new items to add</div>

            {preview.budget.conflicts.length > 0 && (
              <div className="mt-2 border border-[var(--c-border)] rounded-lg p-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-yellow-400">⚠ {preview.budget.conflicts.length} already exist — choose per item:</span>
                  <span className="flex gap-2">
                    <button type="button" onClick={() => setAll('allow')} className="text-[0.7rem] text-[#c8a951] hover:underline">Allow all</button>
                    <button type="button" onClick={() => setAll('deny')} className="text-[0.7rem] text-gray-400 hover:underline">Deny all</button>
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-500 border-b border-[var(--c-border)]">
                        <th className="text-left py-1 pr-2 font-medium">Item</th>
                        <th className="text-left py-1 pr-2 font-medium">Year</th>
                        <th className="text-right py-1 px-2 font-medium">Existing → New</th>
                        <th className="text-right py-1 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.budget.conflicts.map((c) => (
                        <tr key={c.key} className="border-b border-[var(--c-hover)]">
                          <td className="py-1 pr-2">{c.data.item}</td>
                          <td className="py-1 pr-2">{c.data.year}</td>
                          <td className="py-1 px-2 text-right whitespace-nowrap">{fmt(c.existingAmount)} → {fmt(c.data.amount)}</td>
                          <td className="py-1 text-right">
                            <span className="inline-flex rounded border border-[var(--c-border2)] overflow-hidden">
                              <button type="button" onClick={() => setDecisions((d) => ({ ...d, [c.key]: 'allow' }))}
                                className={`px-2 py-0.5 ${decisions[c.key] === 'allow' ? 'bg-[#c8a951] text-black font-semibold' : 'text-gray-400'}`}>Allow</button>
                              <button type="button" onClick={() => setDecisions((d) => ({ ...d, [c.key]: 'deny' }))}
                                className={`px-2 py-0.5 ${decisions[c.key] !== 'allow' ? 'bg-[var(--c-hover)] text-[var(--c-fg)] font-semibold' : 'text-gray-400'}`}>Deny</button>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="text-[0.65rem] text-gray-500 mt-1">Allow overwrites the existing figure; Deny keeps it. Default is Deny.</div>
              </div>
            )}

            {preview.budget.errors.length > 0 && (
              <div className="mt-2">
                <div className="text-xs text-red-400">✕ {preview.budget.errors.length} rows will be skipped:</div>
                <ul className="mt-1 space-y-0.5 max-h-32 overflow-y-auto">
                  {preview.budget.errors.map((e) => (
                    <li key={e.rowNum} className="text-[0.7rem] text-gray-400">Row {e.rowNum}: {e.messages.join('; ')}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 mt-4">
            <button type="button" onClick={confirmImport} disabled={busy || willImport === 0}
              className="bg-[#c8a951] hover:bg-[#d4bf7a] text-black font-semibold px-5 py-2 rounded-lg text-sm disabled:opacity-50">
              {busy ? <><Spinner /> Importing…</> : `Confirm import (${willImport})`}
            </button>
            <button type="button" onClick={reset} className="text-gray-400 hover:text-[var(--c-fg)] px-3 py-2 rounded-lg text-sm">Cancel</button>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className={card}>
          <div className="text-sm font-semibold mb-2">Import History</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-[var(--c-border)]">
                  <th className="text-left py-1 pr-2 font-medium">When</th>
                  <th className="text-left py-1 pr-2 font-medium">File</th>
                  <th className="text-left py-1 pr-2 font-medium">By</th>
                  <th className="text-left py-1 pr-2 font-medium">Result</th>
                  <th className="text-right py-1 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                <ShowMoreRows items={history} limit={7} colSpan={5}>
                {(h) => (
                  <tr key={h.id} className="border-b border-[var(--c-hover)]">
                    <td className="py-1 pr-2 whitespace-nowrap">{String(h.payload.uploadedAt ?? '').slice(0, 10) || '—'}</td>
                    <td className="py-1 pr-2 truncate max-w-[12rem]">{h.payload.filename || '—'}</td>
                    <td className="py-1 pr-2">{h.payload.uploadedBy || '—'}</td>
                    <td className="py-1 pr-2 text-gray-400">{h.payload.expensesAdded ?? 0} exp · {(h.payload.budgetAdded ?? 0) + (h.payload.budgetUpdated ?? 0)} bud</td>
                    <td className="py-1 text-right">
                      <button type="button" onClick={() => undo(h.payload.batchId)} disabled={busy}
                        className="text-[0.7rem] text-gray-400 hover:text-red-400 disabled:opacity-50">Undo</button>
                    </td>
                  </tr>
                )}
                </ShowMoreRows>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
