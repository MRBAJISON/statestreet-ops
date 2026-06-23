'use client';

import { useMemo, useState } from 'react';
import { useEntries, updateEntry, postEntry } from '@/lib/api';
import { useOrg } from '@/components/providers/OrgProvider';
import { categoriesForStore } from '@/lib/org';
import { Spinner } from '@/components/ui/BrandedLoader';

const fmtGHS = (n: number) => `GHS ${Math.round(n).toLocaleString()}`;
const num = (v: unknown) => Number(String(v ?? '').replace(/[,\s]/g, '')) || 0;

// Finance reviews/reconciles what the stores submitted (finance/revenue) rather than
// re-keying it: pick a store + day, see the category breakdown + total, edit a line
// (updates the store's own entry, with a mismatch flag), or add a missing category.
export default function FinanceRevenueReview() {
  const { org } = useOrg();
  const { entries, refresh } = useEntries('finance', 5000);
  const [store, setStore] = useState('');
  const [date, setDate] = useState('');
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [addCat, setAddCat] = useState('');
  const [addAmt, setAddAmt] = useState('');

  const rows = useMemo(
    () => entries.filter((e) => e.formType === 'revenue' && String(e.payload.store || '') === store && String(e.payload.date || '') === date),
    [entries, store, date]
  );
  const total = rows.reduce((s, e) => s + num(e.payload.grossRevenue), 0);
  const catLabel = (v: string) => org.categories.find((c) => c.value === v)?.label ?? v;
  const valOf = (id: number, orig: number) => edits[id] ?? String(orig);
  const presentCats = new Set(rows.map((e) => String(e.payload.category || '')));
  const missingCats = categoriesForStore(org, store).filter((c) => !presentCats.has(c.value));

  async function saveRow(id: number, payload: Record<string, unknown>) {
    setBusy(true); setMsg(null);
    try {
      await updateEntry(id, { ...payload, grossRevenue: num(edits[id]) });
      setEdits((d) => { const n = { ...d }; delete n[id]; return n; });
      refresh();
      setMsg({ ok: true, text: 'Updated the store’s figure.' });
    } catch (err) { setMsg({ ok: false, text: 'Could not update: ' + (err as Error).message }); }
    setBusy(false);
  }

  async function addFallback() {
    if (!store || !date || !addCat || !num(addAmt)) return;
    setBusy(true); setMsg(null);
    try {
      await postEntry('finance', 'revenue', { date, store, category: addCat, grossRevenue: num(addAmt), source: 'finance-reconcile' });
      setAddCat(''); setAddAmt(''); refresh();
      setMsg({ ok: true, text: 'Added the missing category.' });
    } catch (err) { setMsg({ ok: false, text: 'Could not add: ' + (err as Error).message }); }
    setBusy(false);
  }

  const sel = 'bg-[var(--c-card2)] border border-[var(--c-border)] rounded px-3 py-2 text-sm text-[var(--c-fg)] focus:outline-none focus:border-[#c8a951]';

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="bg-[var(--c-card2)] border border-[var(--c-border)] rounded-lg p-4">
        <div className="text-sm font-semibold mb-1">Daily Revenue — Review &amp; Reconcile</div>
        <div className="text-xs text-gray-500 mb-3">Pick a store and day to see what the store submitted. Edit a line only to correct a gap — it updates the store’s own entry.</div>
        <div className="flex gap-3 flex-wrap">
          <label className="text-xs text-gray-400">Store
            <select value={store} onChange={(e) => { setStore(e.target.value); setReviewed(false); }} className={`${sel} w-full mt-1`}>
              <option value="">Select…</option>
              {org.stores.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-400">Date
            <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setReviewed(false); }} className={`${sel} w-full mt-1`} />
          </label>
        </div>
        {msg && <div className={`mt-3 text-xs p-2 rounded-lg border ${msg.ok ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>{msg.text}</div>}
      </div>

      {store && date && (
        <div className="bg-[var(--c-card2)] border border-[var(--c-border)] rounded-lg p-4">
          {rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-[var(--c-border)]">
                    <th className="text-left py-2 pr-3 font-medium">Category</th>
                    <th className="text-right py-2 px-3 font-medium">Store entered</th>
                    <th className="text-right py-2 pl-3 font-medium">Confirm / Edit</th>
                    <th className="text-right py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => {
                    const orig = num(e.payload.grossRevenue);
                    const v = valOf(e.id, orig);
                    const changed = Math.round(num(v)) !== Math.round(orig);
                    return (
                      <tr key={e.id} className="border-b border-[var(--c-hover)]">
                        <td className="py-2 pr-3">{catLabel(String(e.payload.category || ''))}</td>
                        <td className="py-2 px-3 text-right text-gray-400">{fmtGHS(orig)}</td>
                        <td className="py-2 pl-3 text-right">
                          <input type="number" value={v} onChange={(ev) => setEdits((d) => ({ ...d, [e.id]: ev.target.value }))}
                            className="w-28 bg-[var(--c-hover)] border border-[var(--c-border)] rounded px-2 py-1 text-xs text-right text-[var(--c-fg)]" />
                          {changed && <div className="text-[0.65rem] text-yellow-400 mt-0.5">⚠ changed from {fmtGHS(orig)}</div>}
                        </td>
                        <td className="py-2 text-right">
                          {changed && <button type="button" onClick={() => saveRow(e.id, e.payload)} disabled={busy} className="text-[0.7rem] text-[#c8a951] hover:underline disabled:opacity-50">Save</button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[var(--c-border)]">
                    <td className="py-2 pr-3 font-semibold">STORE TOTAL</td>
                    <td className="py-2 px-3 text-right font-semibold text-[#c8a951]">{fmtGHS(total)}</td>
                    <td></td><td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="text-xs text-gray-500 py-2">No sales submitted by this store for this day. Add a category below if Finance is entering on the store’s behalf.</div>
          )}

          {/* Fallback: add a category the store didn't submit */}
          {missingCats.length > 0 && (
            <div className="mt-4 flex gap-2 flex-wrap items-end border-t border-[var(--c-border)] pt-3">
              <label className="text-xs text-gray-400">Add missing category
                <select value={addCat} onChange={(e) => setAddCat(e.target.value)} className={`${sel} w-full mt-1`}>
                  <option value="">Select…</option>
                  {missingCats.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </label>
              <label className="text-xs text-gray-400">Amount
                <input type="number" value={addAmt} onChange={(e) => setAddAmt(e.target.value)} className={`${sel} w-32 mt-1`} placeholder="GHS" />
              </label>
              <button type="button" onClick={addFallback} disabled={busy || !addCat || !num(addAmt)} className="bg-[#c8a951] hover:bg-[#d4bf7a] text-black font-semibold px-4 py-2 rounded-lg text-sm disabled:opacity-50">
                {busy ? <><Spinner /> …</> : 'Add'}
              </button>
            </div>
          )}

          <div className="mt-4 flex items-center gap-3">
            <button type="button" onClick={() => setReviewed(true)} disabled={!rows.length}
              className="border border-[var(--c-border2)] hover:border-[#c8a951] text-[var(--c-fg)] px-5 py-2 rounded-lg text-sm disabled:opacity-50">Confirm day</button>
            {reviewed && <span className="text-xs text-green-400">✓ Reviewed — figures confirmed (no new totals created).</span>}
          </div>
        </div>
      )}
    </div>
  );
}
