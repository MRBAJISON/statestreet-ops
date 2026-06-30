'use client';

import { useCallback, useEffect, useState } from 'react';
import { useOrg } from '@/components/providers/OrgProvider';
import { Spinner } from '@/components/ui/BrandedLoader';

interface Now { store: string; label: string; count: number }
interface Group { code: string; label: string; total: number; misplaced: number; now: Now[] }
interface Diag { auditCreates: number; withStore: number; entriesScanned: number; mapped: number }
interface Sample { id: number; date: string; currentStore: string; grossRevenue: number }
interface Preview { count: number; toLabel: string; sample: Sample[] }

const fmtGHS = (n: number) => `GHS ${Math.round(n).toLocaleString()}`;

// Owner tool: move daily-sales records back to the store they were ORIGINALLY
// created under (read from the audit snapshot), undoing a wrong store move precisely.
export default function StoreRestore() {
  const { org, refresh } = useOrg();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [diag, setDiag] = useState<Diag | null>(null);
  const [error, setError] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const inp = 'bg-[var(--c-card2)] border border-[var(--c-border)] rounded px-3 py-2 text-sm text-[var(--c-fg)] focus:outline-none focus:border-[#c8a951]';

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await fetch('/api/admin/restore-store', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) { setError(`${res.status}: ${data.error || 'request failed'}`); return; }
      setGroups(data.groups ?? []);
      setDiag(data.diag ?? null);
    } catch (e) { setError((e as Error).message); }
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
        setMsg({ ok: true, text: `Done — moved ${data.updated} ${data.updated === 1 ? 'record' : 'records'} to ${data.toLabel}.` });
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
  const sorted = (groups ?? []).slice().sort((a, b) => b.misplaced - a.misplaced || b.total - a.total);

  return (
    <section className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-lg p-5">
      <h2 className="text-sm font-bold uppercase tracking-wide mb-1 text-center">Restore Misplaced Sales</h2>
      <p className="text-xs text-gray-500 mb-4 text-center max-w-md mx-auto">Move daily-sales records back to the store they were originally entered under (from the audit trail). A store&rsquo;s own sales are never touched.</p>

      {error && <div className="text-xs p-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 mb-3">Could not load: {error}</div>}
      {groups === null && !error && <div className="text-xs text-gray-500 text-center"><Spinner /> Scanning the audit trail…</div>}

      {diag && (
        <div className="text-[0.7rem] text-gray-500 text-center mb-3">
          Scanned {diag.auditCreates} audited sales · {diag.mapped} mapped to a store · {diag.entriesScanned} total records.
          {diag.auditCreates === 0 && <span className="text-yellow-400"> No audit history found — tell me and I&rsquo;ll switch to recovering by product category.</span>}
        </div>
      )}

      {groups && groups.length > 0 && (
        <div className="max-w-lg mx-auto space-y-3">
          {/* Full map: where each original store's sales currently sit */}
          <div className="overflow-x-auto">
            <table className="w-full text-[0.7rem]">
              <thead><tr className="text-gray-500 border-b border-[var(--c-border)]">
                <th className="text-left py-1 pr-2">Originally entered under</th><th className="text-right py-1 pr-2">Records</th><th className="text-left py-1 pl-2">Now under</th>
              </tr></thead>
              <tbody>
                {sorted.map((g) => (
                  <tr key={g.code} className="border-b border-[var(--c-hover)]">
                    <td className="py-1 pr-2">{g.label} <span className="text-gray-600">({g.code})</span></td>
                    <td className="py-1 pr-2 text-right">{g.total}</td>
                    <td className={`py-1 pl-2 ${g.misplaced > 0 ? 'text-yellow-400' : 'text-gray-500'}`}>
                      {g.now.map((n) => `${n.label}${n.store !== g.code ? ' ⚠' : ''} (${n.count})`).join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Records originally entered under</label>
            <select value={from} onChange={(e) => { setFrom(e.target.value); setPreview(null); setMsg(null); }} className={`${inp} w-full`}>
              <option value="">Select…</option>
              {sorted.map((g) => <option key={g.code} value={g.code}>{g.label} ({g.code}) — {g.total} records{g.misplaced > 0 ? `, ${g.misplaced} misplaced` : ''}</option>)}
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
              <div className="text-xs text-[var(--c-fg)]"><span className="font-semibold">{preview.count}</span> {preview.count === 1 ? 'record' : 'records'} → <span className="font-semibold">{preview.toLabel}</span></div>
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

      {groups && groups.length === 0 && diag && diag.auditCreates > 0 && (
        <div className="text-xs text-green-400 text-center">✓ Every audited sale sits under the store it was created in.</div>
      )}
    </section>
  );
}
