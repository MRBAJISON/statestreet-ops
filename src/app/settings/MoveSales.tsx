'use client';

import { useState } from 'react';
import { useOrg } from '@/components/providers/OrgProvider';
import { Spinner } from '@/components/ui/BrandedLoader';

interface Cat { code: string; label: string; count: number; revenue: number }
interface Sample { id: number; date: string; category: string; grossRevenue: number }
interface Preview { count: number; toLabel: string; sample: Sample[] }

const fmtGHS = (n: number) => `GHS ${Math.round(n).toLocaleString()}`;

// Owner tool: move a store's daily sales for selected categories to another store —
// the practical way to split women's products back out of a men's store after a bad move.
export default function MoveSales() {
  const { org, refresh } = useOrg();
  const [fromStore, setFromStore] = useState('');
  const [toStore, setToStore] = useState('');
  const [cats, setCats] = useState<Cat[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const inp = 'bg-[var(--c-card2)] border border-[var(--c-border)] rounded px-3 py-2 text-sm text-[var(--c-fg)] focus:outline-none focus:border-[#c8a951]';
  const realStores = org.stores.filter((s) => s.value !== 'head-office');

  async function loadCats(store: string) {
    setFromStore(store); setCats(null); setPicked(new Set()); setPreview(null); setMsg(null);
    if (!store) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/move-sales?store=${encodeURIComponent(store)}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setCats(data.categories ?? []);
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    setLoading(false);
  }

  function toggle(code: string) {
    setPicked((s) => { const n = new Set(s); if (n.has(code)) n.delete(code); else n.add(code); return n; });
    setPreview(null);
  }

  async function call(apply: boolean) {
    if (!fromStore || !toStore || picked.size === 0) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/admin/move-sales', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromStore, toStore, categories: [...picked], apply }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      if (apply) {
        setPreview(null);
        setMsg({ ok: true, text: `Done — moved ${data.updated} ${data.updated === 1 ? 'record' : 'records'} to ${data.toLabel}.` });
        setPicked(new Set());
        await loadCats(fromStore);
        refresh();
      } else { setPreview(data as Preview); }
    } catch (err) { setMsg({ ok: false, text: (err as Error).message }); }
    setBusy(false);
  }

  return (
    <section className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-lg p-5">
      <h2 className="text-sm font-bold uppercase tracking-wide mb-1 text-center">Move Sales by Category</h2>
      <p className="text-xs text-gray-500 mb-4 text-center max-w-md mx-auto">Pick a store, tick the categories that actually belong to a different store, and move just those sales. Amounts are never changed — preview first.</p>

      <div className="max-w-lg mx-auto space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Move sales out of</label>
            <select value={fromStore} onChange={(e) => loadCats(e.target.value)} className={`${inp} w-full`}>
              <option value="">Select store…</option>
              {realStores.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Into store</label>
            <select value={toStore} onChange={(e) => { setToStore(e.target.value); setPreview(null); }} className={`${inp} w-full`}>
              <option value="">Select store…</option>
              {realStores.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        {loading && <div className="text-xs text-gray-500 text-center"><Spinner /> Loading categories…</div>}

        {cats && cats.length === 0 && <div className="text-xs text-gray-500 text-center">No daily sales found for this store.</div>}

        {cats && cats.length > 0 && (
          <div className="border border-[var(--c-border)] rounded-lg p-2 max-h-64 overflow-y-auto">
            <div className="text-[0.7rem] text-gray-500 mb-1 px-1">Tick the categories to move:</div>
            {cats.map((c) => (
              <label key={c.code} className="flex items-center gap-2 px-1 py-1.5 hover:bg-[var(--c-hover)] rounded cursor-pointer text-sm">
                <input type="checkbox" checked={picked.has(c.code)} onChange={() => toggle(c.code)} />
                <span className="flex-1 text-[var(--c-fg)]">{c.label}</span>
                <span className="text-gray-500 text-xs">{c.count} {c.count === 1 ? 'record' : 'records'} · {fmtGHS(c.revenue)}</span>
              </label>
            ))}
          </div>
        )}

        {msg && <div className={`text-xs p-2 rounded-lg border ${msg.ok ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>{msg.text}</div>}

        {!preview ? (
          <div className="flex justify-center">
            <button type="button" onClick={() => call(false)} disabled={busy || !fromStore || !toStore || picked.size === 0}
              className="border border-[var(--c-border2)] hover:border-[#c8a951] text-[var(--c-fg)] px-5 py-2 rounded-lg text-sm disabled:opacity-50">
              {busy ? <><Spinner /> Checking…</> : `Preview move (${picked.size} ${picked.size === 1 ? 'category' : 'categories'})`}
            </button>
          </div>
        ) : (
          <div className="border border-[var(--c-border)] rounded-lg p-3 space-y-2">
            <div className="text-xs text-[var(--c-fg)]"><span className="font-semibold">{preview.count}</span> {preview.count === 1 ? 'record' : 'records'} → <span className="font-semibold">{preview.toLabel}</span></div>
            {preview.sample.length > 0 && (
              <div className="overflow-x-auto max-h-48">
                <table className="w-full text-[0.7rem]">
                  <thead><tr className="text-gray-500 border-b border-[var(--c-border)]">
                    <th className="text-left py-1 pr-2">Date</th><th className="text-left py-1 pr-2">Category</th><th className="text-right py-1">Amount</th>
                  </tr></thead>
                  <tbody>
                    {preview.sample.map((s) => (
                      <tr key={s.id} className="border-b border-[var(--c-hover)]">
                        <td className="py-1 pr-2 text-gray-500">{s.date || '—'}</td>
                        <td className="py-1 pr-2">{s.category || '—'}</td>
                        <td className="py-1 text-right">{s.grossRevenue ? fmtGHS(s.grossRevenue) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex justify-center items-center gap-3 pt-1">
              <button type="button" onClick={() => call(true)} disabled={busy || preview.count === 0}
                className="bg-[#c8a951] hover:bg-[#d4bf7a] text-black font-semibold px-5 py-2 rounded-lg text-sm disabled:opacity-50">
                {busy ? <><Spinner /> Moving…</> : `Move to ${preview.toLabel}`}
              </button>
              <button type="button" onClick={() => setPreview(null)} className="text-gray-400 hover:text-[var(--c-fg)] px-3 py-2 text-sm">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
