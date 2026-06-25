'use client';

import { useMemo, useState } from 'react';
import { useEntries, updateEntry, postEntry, type EntryRow } from '@/lib/api';
import { useOrg } from '@/components/providers/OrgProvider';
import { categoriesForStore } from '@/lib/org';
import { Spinner } from '@/components/ui/BrandedLoader';

const fmtGHS = (n: number) => `GHS ${Math.round(n).toLocaleString()}`;
const num = (v: unknown) => Number(String(v ?? '').replace(/[,\s]/g, '')) || 0;

// Editable numeric fields the store manager captured.
const FIELDS = ['grossRevenue', 'cogs', 'discounts', 'itemsSold', 'transactions', 'footfall', 'openingStock'] as const;

// Finance reviews/reconciles what the stores submitted (finance/revenue) instead of
// re-keying it: pick a store, see every entry that store made, and edit ANY figure to
// correct a gap — it updates the store's own entry, so every dashboard (incl. the
// Executive) reflects the corrected number.
export default function FinanceRevenueReview() {
  const { org } = useOrg();
  const { entries, refresh } = useEntries('finance', 5000);
  const [store, setStore] = useState('');
  const [date, setDate] = useState('');
  const [edits, setEdits] = useState<Record<number, Record<string, string>>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [addCat, setAddCat] = useState('');
  const [addAmt, setAddAmt] = useState('');

  const rows = useMemo(
    () => entries
      .filter((e) => e.formType === 'revenue' && String(e.payload.store || '') === store && (!date || String(e.payload.date || '') === date))
      .sort((a, b) => (String(a.payload.date) < String(b.payload.date) ? 1 : -1)),
    [entries, store, date]
  );
  const catLabel = (v: string) => org.categories.find((c) => c.value === v)?.label ?? v;
  const presentCats = new Set(rows.map((e) => String(e.payload.category || '')));
  const missingCats = categoriesForStore(org, store).filter((c) => !presentCats.has(c.value));

  // Current value of a field = the in-progress edit if any, else what the store entered.
  const cur = (e: EntryRow, f: string) => { const ov = edits[e.id]?.[f]; return ov !== undefined ? num(ov) : num(e.payload[f]); };
  const setEdit = (id: number, f: string, val: string) => setEdits((d) => ({ ...d, [id]: { ...(d[id] ?? {}), [f]: val } }));
  const rowChanged = (e: EntryRow) => FIELDS.some((f) => edits[e.id]?.[f] !== undefined && Math.round(num(edits[e.id][f])) !== Math.round(num(e.payload[f])));
  const total = rows.reduce((s, e) => s + cur(e, 'grossRevenue'), 0);

  async function saveRow(e: EntryRow) {
    setBusy(true); setMsg(null);
    try {
      const patch: Record<string, unknown> = { ...e.payload };
      for (const f of FIELDS) { const ov = edits[e.id]?.[f]; if (ov !== undefined) patch[f] = num(ov); }
      await updateEntry(e.id, patch);
      setEdits((d) => { const n = { ...d }; delete n[e.id]; return n; });
      refresh();
      setMsg({ ok: true, text: 'Updated the store’s entry — dashboards now reflect it.' });
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
  const inp = 'w-20 bg-[var(--c-hover)] border border-[var(--c-border)] rounded px-1.5 py-1 text-xs text-right text-[var(--c-fg)]';

  // An editable numeric cell.
  const cell = (e: EntryRow, f: string) => {
    const raw = edits[e.id]?.[f];
    const v = raw !== undefined ? raw : (num(e.payload[f]) ? String(num(e.payload[f])) : '');
    return <input type="number" value={v} onChange={(ev) => setEdit(e.id, f, ev.target.value)} className={inp} />;
  };

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="bg-[var(--c-card2)] border border-[var(--c-border)] rounded-lg p-4">
        <div className="text-sm font-semibold mb-1">Daily Revenue — Review &amp; Reconcile</div>
        <div className="text-xs text-gray-500 mb-3">Pick a store to see everything it submitted. You can edit any figure to correct it — saving updates the store’s own entry, and every dashboard (including the Executive) reflects the change. Use the date filter to focus on one day.</div>
        <div className="flex gap-3 flex-wrap">
          <label className="text-xs text-gray-400">Store
            <select value={store} onChange={(e) => setStore(e.target.value)} className={`${sel} w-full mt-1`}>
              <option value="">Select…</option>
              {org.stores.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-400">Date <span className="text-gray-600">(optional)</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${sel} w-full mt-1`} />
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
                    <th className={th}>Gross Rev</th>
                    <th className={th}>COGS</th>
                    <th className={th}>Discounts</th>
                    <th className={th}>Net</th>
                    <th className={th}>Units</th>
                    <th className={th}>Unit Price</th>
                    <th className={th}>Txns</th>
                    <th className={th}>Footfall</th>
                    <th className={th}>Opening Stock</th>
                    <th className={th}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => {
                    const net = cur(e, 'grossRevenue') - cur(e, 'discounts');
                    const up = cur(e, 'itemsSold') ? cur(e, 'grossRevenue') / cur(e, 'itemsSold') : 0;
                    return (
                      <tr key={e.id} className="border-b border-[var(--c-hover)]">
                        <td className="py-2 pr-2 whitespace-nowrap">{String(e.payload.date || '—')}</td>
                        <td className="py-2 px-2 whitespace-nowrap">{catLabel(String(e.payload.category || ''))}</td>
                        <td className="py-1 px-2 text-right">{cell(e, 'grossRevenue')}</td>
                        <td className="py-1 px-2 text-right">{cell(e, 'cogs')}</td>
                        <td className="py-1 px-2 text-right">{cell(e, 'discounts')}</td>
                        <td className="py-2 px-2 text-right text-gray-400 whitespace-nowrap">{fmtGHS(net)}</td>
                        <td className="py-1 px-2 text-right">{cell(e, 'itemsSold')}</td>
                        <td className="py-2 px-2 text-right text-gray-400 whitespace-nowrap">{up ? fmtGHS(up) : '—'}</td>
                        <td className="py-1 px-2 text-right">{cell(e, 'transactions')}</td>
                        <td className="py-1 px-2 text-right">{cell(e, 'footfall')}</td>
                        <td className="py-1 px-2 text-right">{cell(e, 'openingStock')}</td>
                        <td className="py-1 px-2 text-right">
                          {rowChanged(e) && <button type="button" onClick={() => saveRow(e)} disabled={busy} className="text-[0.7rem] text-[#c8a951] hover:underline disabled:opacity-50">Save</button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[var(--c-border)]">
                    <td className="py-2 pr-2 font-semibold" colSpan={2}>TOTAL ({rows.length} {rows.length === 1 ? 'entry' : 'entries'})</td>
                    <td className="py-2 px-2 text-right font-semibold text-[#c8a951] whitespace-nowrap">{fmtGHS(total)}</td>
                    <td colSpan={9}></td>
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
        </div>
      )}
    </div>
  );
}
