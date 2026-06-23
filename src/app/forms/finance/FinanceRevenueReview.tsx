'use client';

import { useMemo, useState } from 'react';
import { useEntries, updateEntry, postEntry } from '@/lib/api';
import { useOrg } from '@/components/providers/OrgProvider';
import { categoriesForStore } from '@/lib/org';
import { Spinner } from '@/components/ui/BrandedLoader';

const fmtGHS = (n: number) => `GHS ${Math.round(n).toLocaleString()}`;
const num = (v: unknown) => Number(String(v ?? '').replace(/[,\s]/g, '')) || 0;

// Finance reviews/reconciles what the stores submitted (finance/revenue) instead of
// re-keying it: pick a store, see every entry that store made with almost all the
// fields the manager filled, edit a figure to correct a gap (updates the store's own
// entry, with a flag), or add a category the store missed.
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
    () => entries
      .filter((e) => e.formType === 'revenue' && String(e.payload.store || '') === store && (!date || String(e.payload.date || '') === date))
      .sort((a, b) => (String(a.payload.date) < String(b.payload.date) ? 1 : -1)),
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
  const th = 'text-right py-2 px-2 font-medium whitespace-nowrap';
  const td = 'py-2 px-2 text-right whitespace-nowrap';

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="bg-[var(--c-card2)] border border-[var(--c-border)] rounded-lg p-4">
        <div className="text-sm font-semibold mb-1">Daily Revenue — Review &amp; Reconcile</div>
        <div className="text-xs text-gray-500 mb-3">Pick a store to see everything it submitted. Edit a figure only to correct a gap — it updates the store’s own entry. Use the date filter to focus on one day.</div>
        <div className="flex gap-3 flex-wrap">
          <label className="text-xs text-gray-400">Store
            <select value={store} onChange={(e) => { setStore(e.target.value); setReviewed(false); }} className={`${sel} w-full mt-1`}>
              <option value="">Select…</option>
              {org.stores.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-400">Date <span className="text-gray-600">(optional)</span>
            <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setReviewed(false); }} className={`${sel} w-full mt-1`} />
          </label>
        </div>
        {msg && <div className={`mt-3 text-xs p-2 rounded-lg border ${msg.ok ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>{msg.text}</div>}
      </div>

      {store && (
        <div className="bg-[var(--c-card2)] border border-[var(--c-border)] rounded-lg p-4">
          {rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-[var(--c-border)]">
                    <th className="text-left py-2 pr-2 font-medium">Date</th>
                    <th className="text-left py-2 px-2 font-medium">Category</th>
                    <th className={th}>Gross Rev (edit)</th>
                    <th className={th}>COGS</th>
                    <th className={th}>Discounts</th>
                    <th className={th}>Net</th>
                    <th className={th}>Units</th>
                    <th className={th}>Unit Price</th>
                    <th className={th}>Txns</th>
                    <th className={th}>Footfall</th>
                    <th className={th}>Opening Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => {
                    const p = e.payload;
                    const orig = num(p.grossRevenue);
                    const v = valOf(e.id, orig);
                    const changed = Math.round(num(v)) !== Math.round(orig);
                    const units = num(p.itemsSold);
                    const net = p.netRevenue != null && p.netRevenue !== '' ? num(p.netRevenue) : orig - num(p.discounts);
                    return (
                      <tr key={e.id} className="border-b border-[var(--c-hover)]">
                        <td className="py-2 pr-2 whitespace-nowrap">{String(p.date || '—')}</td>
                        <td className="py-2 px-2">{catLabel(String(p.category || ''))}</td>
                        <td className={td}>
                          <input type="number" value={v} onChange={(ev) => setEdits((d) => ({ ...d, [e.id]: ev.target.value }))}
                            className="w-24 bg-[var(--c-hover)] border border-[var(--c-border)] rounded px-2 py-1 text-xs text-right text-[var(--c-fg)]" />
                          {changed && (
                            <div className="mt-0.5 whitespace-nowrap">
                              <span className="text-[0.6rem] text-yellow-400">⚠ was {fmtGHS(orig)}</span>{' '}
                              <button type="button" onClick={() => saveRow(e.id, p)} disabled={busy} className="text-[0.6rem] text-[#c8a951] hover:underline disabled:opacity-50">Save</button>
                            </div>
                          )}
                        </td>
                        <td className={`${td} text-gray-400`}>{num(p.cogs) ? fmtGHS(num(p.cogs)) : '—'}</td>
                        <td className={`${td} text-gray-400`}>{num(p.discounts) ? fmtGHS(num(p.discounts)) : '—'}</td>
                        <td className={`${td} text-gray-400`}>{fmtGHS(net)}</td>
                        <td className={`${td} text-gray-400`}>{units || '—'}</td>
                        <td className={`${td} text-gray-400`}>{units ? fmtGHS(orig / units) : '—'}</td>
                        <td className={`${td} text-gray-400`}>{num(p.transactions) || '—'}</td>
                        <td className={`${td} text-gray-400`}>{num(p.footfall) || '—'}</td>
                        <td className={`${td} text-gray-400`}>{num(p.openingStock) || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[var(--c-border)]">
                    <td className="py-2 pr-2 font-semibold" colSpan={2}>TOTAL ({rows.length} {rows.length === 1 ? 'entry' : 'entries'})</td>
                    <td className="py-2 px-2 text-right font-semibold text-[#c8a951]">{fmtGHS(total)}</td>
                    <td colSpan={8}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="text-xs text-gray-500 py-2">Nothing submitted by this store{date ? ' for this day' : ''}. {date && missingCats.length ? 'Add a category below if Finance is entering on the store’s behalf.' : ''}</div>
          )}

          {date && missingCats.length > 0 && (
            <div className="mt-4 flex gap-2 flex-wrap items-end border-t border-[var(--c-border)] pt-3">
              <label className="text-xs text-gray-400">Add missing category (for {date})
                <select value={addCat} onChange={(e) => setAddCat(e.target.value)} className={`${sel} w-full mt-1`}>
                  <option value="">Select…</option>
                  {missingCats.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </label>
              <label className="text-xs text-gray-400">Gross Revenue
                <input type="number" value={addAmt} onChange={(e) => setAddAmt(e.target.value)} className={`${sel} w-32 mt-1`} placeholder="GHS" />
              </label>
              <button type="button" onClick={addFallback} disabled={busy || !addCat || !num(addAmt)} className="bg-[#c8a951] hover:bg-[#d4bf7a] text-black font-semibold px-4 py-2 rounded-lg text-sm disabled:opacity-50">
                {busy ? <><Spinner /> …</> : 'Add'}
              </button>
            </div>
          )}

          {rows.length > 0 && (
            <div className="mt-4 flex items-center gap-3">
              <button type="button" onClick={() => setReviewed(true)}
                className="border border-[var(--c-border2)] hover:border-[#c8a951] text-[var(--c-fg)] px-5 py-2 rounded-lg text-sm">Confirm reviewed</button>
              {reviewed && <span className="text-xs text-green-400">✓ Reviewed — figures confirmed.</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
