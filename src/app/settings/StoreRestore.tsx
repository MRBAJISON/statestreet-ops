'use client';

import { useCallback, useEffect, useState } from 'react';
import { useOrg } from '@/components/providers/OrgProvider';
import { Spinner } from '@/components/ui/BrandedLoader';

interface Now { store: string; label: string; count: number }
interface Group { code: string; label: string; total: number; misplaced: number; now: Now[] }
interface Sample { id: number; date: string; currentStore: string; grossRevenue: number }
interface Preview { count: number; toLabel: string; sample: Sample[] }

const fmtGHS = (n: number) => `GHS ${Math.round(n).toLocaleString()}`;

// Owner tool: move daily-sales records back to the store they were ORIGINALLY
// created under (read from the audit snapshot), undoing a wrong store move precisely.
export default function StoreRestore() {
  const { org, refresh } = useOrg();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const inp = 'bg-[var(--c-card2)] border border-[var(--c-border)] rounded px-3 py-2 text-sm text-[var(--c-fg)] focus:outline-none focus:border-[#c8a951]';

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/restore-store', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) setGroups(data.groups ?? []);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function call(apply: boolean) {
    if (!from || !to) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/admin/restore-store', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, apply }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      if (apply) {
        setPreview(null);
        setMsg({ ok: true, text: `Done — moved ${data.updated} ${data.updated === 1 ? 'record' : 'records'} back to ${data.toLabel}.` });
        setFrom(''); setTo('');
        await load();
        refresh();
      } else {
        setPreview(data as Preview);
      }
    } catch (err) { setMsg({ ok: false, text: (err as Error).message }); }
    setBusy(false);
  }

  const realStores = org.stores.filter((s) => s.value !== 'head-office');
  const misplaced = (groups ?? []).filter((g) => g.misplaced > 0);

  return (
    <section className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-lg p-5">
      <h2 className="text-sm font-bold uppercase tracking-wide mb-1 text-center">Restore Misplaced Sales</h2>
      <p className="text-xs text-gray-500 mb-4 text-center max-w-md mx-auto">Move daily-sales records back to the store they were originally entered under (from the audit trail). Undoes a wrong store move precisely — a store&rsquo;s own sales are never touched.</p>

      {groups !== null && misplaced.length === 0 && (
        <div className="text-xs text-green-400 text-center">✓ Every sales record sits under the store it was created in.</div>
      )}

      {misplaced.length > 0 && (
        <div className="max-w-lg mx-auto space-y-3">
          <div className="text-[0.7rem] text-yellow-400 text-center">
            {misplaced.map((g) => `${g.label} (${g.code}): ${g.misplaced} record${g.misplaced === 1 ? '' : 's'} now under ${g.now.filter((n) => n.store !== g.code).map((n) => n.label).join(', ')}`).join(' · ')}
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Records originally entered under</label>
            <select value={from} onChange={(e) => { setFrom(e.target.value); setPreview(null); setMsg(null); }} className={`${inp} w-full`}>
              <option value="">Select…</option>
              {misplaced.map((g) => (
                <option key={g.code} value={g.code}>{g.label} ({g.code}) — {g.misplaced} misplaced of {g.total}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Move them to</label>
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
                <span className="font-semibold">{preview.count}</span> {preview.count === 1 ? 'record' : 'records'} → <span className="font-semibold">{preview.toLabel}</span>
              </div>
              {preview.sample.length > 0 && (
                <div className="overflow-x-auto max-h-48">
                  <table className="w-full text-[0.7rem]">
                    <thead><tr className="text-gray-500 border-b border-[var(--c-border)]">
                      <th className="text-left py-1 pr-2">Date</th><th className="text-left py-1 pr-2">Now under</th><th className="text-right py-1">Amount</th>
                    </tr></thead>
                    <tbody>
                      {preview.sample.map((s) => (
                        <tr key={s.id} className="border-b border-[var(--c-hover)]">
                          <td className="py-1 pr-2 text-gray-500">{s.date || '—'}</td>
                          <td className="py-1 pr-2">{s.currentStore || '—'}</td>
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
      )}
    </section>
  );
}
