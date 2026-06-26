'use client';

import { useState } from 'react';
import { useOrg } from '@/components/providers/OrgProvider';
import { Spinner } from '@/components/ui/BrandedLoader';

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

interface Sample { id: number; department: string; formType: string; store: string; date: string; grossRevenue: number }
interface Preview { count: number; orgHas: boolean; orgLabel: string; sample: Sample[] }

const fmtGHS = (n: number) => `GHS ${Math.round(n).toLocaleString()}`;

// Owner tool to fix a bad category code (e.g. "d" -> "dresses") across all data.
export default function CategoryRecoder() {
  const { org, refresh } = useOrg();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const inp = 'bg-[var(--c-card2)] border border-[var(--c-border)] rounded px-3 py-2 text-sm text-[var(--c-fg)] focus:outline-none focus:border-[#c8a951]';

  function pickFrom(value: string) {
    setFrom(value);
    setPreview(null); setMsg(null);
    const label = org.categories.find((c) => c.value === value)?.label ?? '';
    setTo(slugify(label));
  }

  async function call(apply: boolean) {
    if (!from || !to) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/admin/recode-category', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, apply }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      if (apply) {
        setPreview(null);
        setMsg({ ok: true, text: `Done — retagged ${data.updated} ${data.updated === 1 ? 'entry' : 'entries'} from "${from}" to "${to}"${data.orgUpdated ? ' and updated the category list' : ''}.` });
        setFrom(''); setTo('');
        refresh();
      } else {
        setPreview(data as Preview);
      }
    } catch (err) { setMsg({ ok: false, text: (err as Error).message }); }
    setBusy(false);
  }

  // Flag categories whose code looks wrong (very short) to help find them.
  const oddCodes = org.categories.filter((c) => (c.value || '').length <= 2);

  return (
    <section className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-lg p-5">
      <h2 className="text-sm font-bold uppercase tracking-wide mb-1 text-center">Fix Category Code</h2>
      <p className="text-xs text-gray-500 mb-4 text-center max-w-md mx-auto">Rename a category&rsquo;s internal code across all data — amounts are never changed. Preview first, then apply.</p>

      {oddCodes.length > 0 && (
        <div className="text-[0.7rem] text-yellow-400 mb-3 text-center">⚠ Categories with a suspicious short code: {oddCodes.map((c) => `${c.label} (${c.value})`).join(', ')}</div>
      )}

      <div className="max-w-md mx-auto space-y-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Category to fix</label>
          <select value={from} onChange={(e) => pickFrom(e.target.value)} className={`${inp} w-full`}>
            <option value="">Select…</option>
            {org.categories.map((c) => <option key={c.value} value={c.value}>{c.label} (code: {c.value})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">New code</label>
          <input value={to} onChange={(e) => setTo(slugify(e.target.value))} className={`${inp} w-full`} placeholder="e.g. dresses" />
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
              <span className="font-semibold">{preview.count}</span> {preview.count === 1 ? 'entry uses' : 'entries use'} code &ldquo;{from}&rdquo;
              {preview.orgHas && <> · category list: <span className="font-semibold">{preview.orgLabel}</span></>}
            </div>
            {preview.sample.length > 0 && (
              <div className="overflow-x-auto max-h-48">
                <table className="w-full text-[0.7rem]">
                  <thead><tr className="text-gray-500 border-b border-[var(--c-border)]">
                    <th className="text-left py-1 pr-2">Type</th><th className="text-left py-1 pr-2">Store</th>
                    <th className="text-left py-1 pr-2">Date</th><th className="text-right py-1">Amount</th>
                  </tr></thead>
                  <tbody>
                    {preview.sample.map((s) => (
                      <tr key={s.id} className="border-b border-[var(--c-hover)]">
                        <td className="py-1 pr-2">{s.formType}</td>
                        <td className="py-1 pr-2">{s.store || '—'}</td>
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
                {busy ? <><Spinner /> Applying…</> : `Apply: "${from}" → "${to}"`}
              </button>
              <button type="button" onClick={() => setPreview(null)} className="text-gray-400 hover:text-[var(--c-fg)] px-3 py-2 text-sm">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
