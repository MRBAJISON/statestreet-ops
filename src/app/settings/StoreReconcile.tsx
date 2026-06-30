'use client';

import { useCallback, useEffect, useState } from 'react';
import { useOrg } from '@/components/providers/OrgProvider';
import { Spinner } from '@/components/ui/BrandedLoader';

interface Orphan { code: string; count: number; wasLabel: string }
interface Sample { id: number; department: string; formType: string; date: string; grossRevenue: number }
interface Preview { count: number; toLabel: string; sample: Sample[] }

const fmtGHS = (n: number) => `GHS ${Math.round(n).toLocaleString()}`;

// Owner tool: reattach sales data recorded under an old store code (orphaned by a
// past rename) to a current store — without touching any amounts.
export default function StoreReconcile() {
  const { org, refresh } = useOrg();
  const [orphans, setOrphans] = useState<Orphan[] | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const inp = 'bg-[var(--c-card2)] border border-[var(--c-border)] rounded px-3 py-2 text-sm text-[var(--c-fg)] focus:outline-none focus:border-[#c8a951]';

  const loadOrphans = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/recode-store', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) setOrphans(data.orphans ?? []);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { loadOrphans(); }, [loadOrphans]);

  // Suggest a target store for an orphan: a current store whose name resembles the
  // orphan's original (built-in) name, else the first non-head-office store.
  function pickFrom(code: string) {
    setFrom(code);
    setPreview(null); setMsg(null);
    const was = (orphans?.find((o) => o.code === code)?.wasLabel ?? '').toLowerCase();
    const key = was.replace(/boulevard women|bw/g, '').replace(/[^a-z]/g, '');
    const guess = org.stores.find((s) => key && s.label.toLowerCase().replace(/[^a-z]/g, '').includes(key));
    setTo(guess?.value ?? '');
  }

  async function call(apply: boolean) {
    if (!from || !to) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/admin/recode-store', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, apply }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      if (apply) {
        setPreview(null);
        setMsg({ ok: true, text: `Done — reattached ${data.updated} ${data.updated === 1 ? 'record' : 'records'} from "${from}" to ${data.toLabel}.` });
        setFrom(''); setTo('');
        await loadOrphans();
        refresh();
      } else {
        setPreview(data as Preview);
      }
    } catch (err) { setMsg({ ok: false, text: (err as Error).message }); }
    setBusy(false);
  }

  const realStores = org.stores.filter((s) => s.value !== 'head-office');

  return (
    <section className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-lg p-5">
      <h2 className="text-sm font-bold uppercase tracking-wide mb-1 text-center">Reconcile Store Data</h2>
      <p className="text-xs text-gray-500 mb-4 text-center max-w-md mx-auto">Reattach sales recorded under an old store code (left over from a past rename) to a current store. Amounts are never changed — preview first, then apply.</p>

      {orphans !== null && orphans.length === 0 && (
        <div className="text-xs text-green-400 text-center">✓ No orphaned store data — every record maps to a current store.</div>
      )}

      {orphans && orphans.length > 0 && (
        <div className="max-w-md mx-auto space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Orphaned store code (in your data, not in the store list)</label>
            <select value={from} onChange={(e) => pickFrom(e.target.value)} className={`${inp} w-full`}>
              <option value="">Select…</option>
              {orphans.map((o) => (
                <option key={o.code} value={o.code}>{o.code}{o.wasLabel ? ` — was “${o.wasLabel}”` : ''} · {o.count} {o.count === 1 ? 'record' : 'records'}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Reattach to store</label>
            <select value={to} onChange={(e) => { setTo(e.target.value); setPreview(null); }} className={`${inp} w-full`}>
              <option value="">Select…</option>
              {realStores.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          {msg && <div className={`text-xs p-2 rounded-lg border ${msg.ok ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>{msg.text}</div>}

          {!preview ? (
            <div className="flex justify-center">
              <button type="button" onClick={() => call(false)} disabled={busy || !from || !to}
                className="border border-[var(--c-border2)] hover:border-[#c8a951] text-[var(--c-fg)] px-5 py-2 rounded-lg text-sm disabled:opacity-50">
                {busy ? <><Spinner /> Checking…</> : 'Preview'}
              </button>
            </div>
          ) : (
            <div className="border border-[var(--c-border)] rounded-lg p-3 space-y-2">
              <div className="text-xs text-[var(--c-fg)]">
                <span className="font-semibold">{preview.count}</span> {preview.count === 1 ? 'record' : 'records'} under &ldquo;{from}&rdquo; → <span className="font-semibold">{preview.toLabel}</span>
              </div>
              {preview.sample.length > 0 && (
                <div className="overflow-x-auto max-h-48">
                  <table className="w-full text-[0.7rem]">
                    <thead><tr className="text-gray-500 border-b border-[var(--c-border)]">
                      <th className="text-left py-1 pr-2">Type</th><th className="text-left py-1 pr-2">Date</th><th className="text-right py-1">Amount</th>
                    </tr></thead>
                    <tbody>
                      {preview.sample.map((s) => (
                        <tr key={s.id} className="border-b border-[var(--c-hover)]">
                          <td className="py-1 pr-2">{s.formType}</td>
                          <td className="py-1 pr-2 text-gray-500">{s.date || '—'}</td>
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
                  {busy ? <><Spinner /> Applying…</> : `Reattach to ${preview.toLabel}`}
                </button>
                <button type="button" onClick={() => setPreview(null)} className="text-gray-400 hover:text-[var(--c-fg)] px-3 py-2 text-sm">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
