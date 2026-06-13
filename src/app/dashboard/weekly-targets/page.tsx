'use client';

import { useMemo, useState } from 'react';
import { useEntries, postEntry, updateEntry, type EntryRow } from '@/lib/api';
import { STORES } from '@/lib/config';

const fmtGHS = (n: number) => `GHS ${Math.round(n).toLocaleString()}`;
const num = (s: string) => Number(String(s).replace(/[, ]/g, '')) || 0;

export default function WeeklyTargetsPage() {
  const { entries, refresh } = useEntries('commercial', 5000);
  const [weekEnd, setWeekEnd] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const targets = useMemo(
    () => entries.filter((e) => e.formType === 'weekly-target' && String(e.payload.weekEnd) === weekEnd),
    [entries, weekEnd]
  );
  const existingFor = (store: string): EntryRow | undefined => targets.find((e) => String(e.payload.store) === store);
  const valueFor = (store: string) => {
    if (drafts[store] !== undefined) return drafts[store];
    const ex = existingFor(store);
    return ex ? String(ex.payload.target ?? '') : '';
  };

  async function saveAll() {
    if (!weekEnd) {
      setMsg({ ok: false, text: 'Pick a week-ending date first.' });
      return;
    }
    setBusy(true);
    try {
      for (const s of STORES) {
        const raw = drafts[s.value];
        if (raw === undefined) continue; // unchanged
        const payload = { store: s.value, weekEnd, target: raw };
        const ex = existingFor(s.value);
        if (ex) await updateEntry(ex.id, payload);
        else await postEntry('commercial', 'weekly-target', payload);
      }
      setMsg({ ok: true, text: 'Weekly targets saved. Store managers see them as read-only.' });
      setDrafts({});
      refresh();
    } catch (e) {
      setMsg({ ok: false, text: 'Could not save: ' + (e as Error).message });
    }
    setBusy(false);
  }

  const total = STORES.reduce((s, st) => s + num(valueFor(st.value)), 0);

  return (
    <div className="bg-[var(--c-bg)] min-h-screen text-[var(--c-fg)] p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Weekly Sales Targets</h1>
        <p className="text-sm text-gray-500 mt-1">Set each store&apos;s weekly sales target. These appear read-only on the Store Manager Weekly Review.</p>
      </div>

      {msg && (
        <div className={`mb-4 text-sm p-3 rounded-lg border ${msg.ok ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>
          {msg.text}
        </div>
      )}

      <div className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-lg p-4 max-w-3xl">
        <label className="text-xs text-gray-400">Week Ending
          <input type="date" value={weekEnd} onChange={(e) => { setWeekEnd(e.target.value); setDrafts({}); }}
            className="block mt-1 bg-[var(--c-card2)] border border-[var(--c-border)] rounded px-3 py-2 text-sm text-[var(--c-fg)] focus:outline-none focus:border-[#c8a951]" />
        </label>

        {weekEnd ? (
          <>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--c-border)] text-gray-500 text-xs">
                    <th className="text-left py-2 pr-3 font-medium">Store</th>
                    <th className="text-right py-2 pl-3 font-medium">Weekly Target (GHS)</th>
                  </tr>
                </thead>
                <tbody>
                  {STORES.map((s) => (
                    <tr key={s.value} className="border-b border-[var(--c-hover)]">
                      <td className="py-2 pr-3">{s.label}</td>
                      <td className="py-2 pl-3 text-right">
                        <input type="number" value={valueFor(s.value)} onChange={(e) => setDrafts((d) => ({ ...d, [s.value]: e.target.value }))}
                          className="w-40 bg-[var(--c-card2)] border border-[var(--c-border)] rounded px-2 py-1.5 text-sm text-right text-[var(--c-fg)] focus:outline-none focus:border-[#c8a951]" placeholder="0" />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="text-xs text-gray-400">
                    <td className="py-2 pr-3 font-semibold">Group total</td>
                    <td className="py-2 pl-3 text-right font-semibold text-[#c8a951]">{fmtGHS(total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <button onClick={saveAll} disabled={busy}
              className="mt-4 bg-[#c8a951] hover:bg-[#d4bf7a] text-black font-semibold px-6 py-2.5 rounded-lg text-sm disabled:opacity-50">
              {busy ? 'Saving…' : 'Save Targets'}
            </button>
          </>
        ) : (
          <p className="text-sm text-gray-500 mt-4">Choose a week-ending date to set targets.</p>
        )}
      </div>
    </div>
  );
}
