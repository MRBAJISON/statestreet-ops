'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { Spinner } from '@/components/ui/BrandedLoader';

interface Row { code: string; label: string; inCatalog: boolean; sales: number; salesRevenue: number; targets: number; ops: number }
interface Rec { id: number; date: string; category: string; gross: number; items: number }

const fmtGHS = (n: number) => `GHS ${Math.round(n).toLocaleString()}`;

// READ-ONLY diagnostic: shows where every store's data lives (sales / targets / ops /
// catalog) and lets the owner view the sales history for any store code. No writes.
export default function StoreMap() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [recs, setRecs] = useState<Rec[] | null>(null);
  const [recBusy, setRecBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await fetch('/api/admin/store-map', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) { setError(`${res.status}: ${data.error || 'request failed'}`); return; }
      setRows(data.stores ?? []);
    } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function viewRecords(code: string) {
    if (open === code) { setOpen(null); setRecs(null); return; }
    setOpen(code); setRecs(null); setRecBusy(true);
    try {
      const res = await fetch(`/api/admin/store-map?records=${encodeURIComponent(code)}`, { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) setRecs(data.records ?? []);
    } catch { /* ignore */ }
    setRecBusy(false);
  }

  return (
    <section className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-lg p-5">
      <h2 className="text-sm font-bold uppercase tracking-wide mb-1 text-center">Store Data Map</h2>
      <p className="text-xs text-gray-500 mb-4 text-center max-w-lg mx-auto">Read-only. Shows which store code each part of your data uses — sales, weekly targets, operations audits, and the catalog — so a drifted or merged store is easy to spot. Click a row to see its sales history.</p>

      {error && <div className="text-xs p-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 mb-3">Could not load: {error}</div>}
      {rows === null && !error && <div className="text-xs text-gray-500 text-center"><Spinner /> Reading your data…</div>}

      {rows && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-[var(--c-border)]">
                <th className="text-left py-2 pr-2">Store (label)</th>
                <th className="text-left py-2 pr-2">Code</th>
                <th className="text-center py-2 px-2">In catalog</th>
                <th className="text-right py-2 px-2">Sales</th>
                <th className="text-right py-2 px-2">Revenue</th>
                <th className="text-right py-2 px-2">Targets</th>
                <th className="text-right py-2 pl-2">Ops audits</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isOrphan = !r.inCatalog && (r.sales > 0 || r.targets > 0 || r.ops > 0);
                return (
                  <Fragment key={r.code}>
                    <tr className={`border-b border-[var(--c-hover)] cursor-pointer hover:bg-[var(--c-hover)] ${isOrphan ? 'text-yellow-400' : ''}`} onClick={() => viewRecords(r.code)}>
                      <td className="py-2 pr-2">{r.label}{isOrphan ? ' ⚠' : ''}</td>
                      <td className="py-2 pr-2 font-mono text-[0.7rem] text-gray-500">{r.code || '(blank)'}</td>
                      <td className="py-2 px-2 text-center">{r.inCatalog ? '✓' : '—'}</td>
                      <td className="py-2 px-2 text-right">{r.sales || '—'}</td>
                      <td className="py-2 px-2 text-right">{r.salesRevenue ? fmtGHS(r.salesRevenue) : '—'}</td>
                      <td className="py-2 px-2 text-right">{r.targets || '—'}</td>
                      <td className="py-2 pl-2 text-right">{r.ops || '—'}</td>
                    </tr>
                    {open === r.code && (
                      <tr className="bg-[var(--c-card2)]">
                        <td colSpan={7} className="py-2 px-3">
                          {recBusy ? <div className="text-xs text-gray-500"><Spinner /> Loading sales…</div> : recs && recs.length > 0 ? (
                            <div className="overflow-x-auto max-h-72">
                              <div className="text-[0.7rem] text-gray-500 mb-1">{recs.length} sales records under code “{r.code}”</div>
                              <table className="w-full text-[0.7rem]">
                                <thead><tr className="text-gray-500 border-b border-[var(--c-border)]">
                                  <th className="text-left py-1 pr-2">Date</th><th className="text-left py-1 pr-2">Category</th><th className="text-right py-1 pr-2">Gross</th><th className="text-right py-1">Items</th>
                                </tr></thead>
                                <tbody>
                                  {recs.map((rec) => (
                                    <tr key={rec.id} className="border-b border-[var(--c-hover)]">
                                      <td className="py-1 pr-2 text-gray-400">{rec.date || '—'}</td>
                                      <td className="py-1 pr-2">{rec.category || '—'}</td>
                                      <td className="py-1 pr-2 text-right">{rec.gross ? fmtGHS(rec.gross) : '—'}</td>
                                      <td className="py-1 text-right">{rec.items || '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : <div className="text-xs text-gray-500">No sales records under this code.</div>}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
