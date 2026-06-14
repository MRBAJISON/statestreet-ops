'use client';

import { useMemo, useState } from 'react';
import { useEntries, postEntry, updateEntry, type EntryRow } from '@/lib/api';
import { STORES } from '@/lib/config';

const fmtGHS = (n: number) => `GHS ${Math.round(n).toLocaleString()}`;
const num = (s: string) => Number(String(s).replace(/[, ]/g, '')) || 0;

const inputCls =
  'bg-[var(--c-card2)] border border-[var(--c-border)] rounded px-3 py-2 text-sm text-[var(--c-fg)] focus:outline-none focus:border-[#c8a951]';

const TABS = [
  { id: 'weekly', label: 'Store Weekly Targets' },
  { id: 'executive', label: 'Executive Targets' },
] as const;

// The 4 monthly executive KPI targets + 1 annual (sell-through, YTD card).
const MONTHLY_FIELDS: { key: string; label: string; unit: 'ghs' | 'pct' }[] = [
  { key: 'revenueMtd', label: 'Group Revenue', unit: 'ghs' },
  { key: 'grossProfit', label: 'Gross Profit', unit: 'ghs' },
  { key: 'operatingProfit', label: 'Operating Profit', unit: 'ghs' },
  { key: 'grossMargin', label: 'Group GM %', unit: 'pct' },
];

export default function TargetsPage() {
  const { entries, refresh } = useEntries('commercial', 5000);
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('weekly');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  /* ---------------------- Tab 1: Store Weekly Targets ---------------------- */
  const [weekEnd, setWeekEnd] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});

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

  async function saveWeekly() {
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

  /* ---------------------- Tab 2: Executive Targets ------------------------- */
  const [execMonth, setExecMonth] = useState('');
  const execYear = execMonth ? execMonth.slice(0, 4) : '';
  const [eDrafts, setEDrafts] = useState<Record<string, string>>({});

  const monthlyRec = useMemo(
    () => entries.find((e) => e.formType === 'exec-target' && String(e.payload.month) === execMonth),
    [entries, execMonth]
  );
  const annualRec = useMemo(
    () => entries.find((e) => e.formType === 'exec-target-annual' && String(e.payload.year) === execYear),
    [entries, execYear]
  );
  const execValue = (key: string) => {
    if (eDrafts[key] !== undefined) return eDrafts[key];
    if (key === 'sellThrough') return annualRec ? String(annualRec.payload.sellThrough ?? '') : '';
    return monthlyRec ? String(monthlyRec.payload[key] ?? '') : '';
  };

  async function saveExecutive() {
    if (!execMonth) {
      setMsg({ ok: false, text: 'Pick a month first.' });
      return;
    }
    setBusy(true);
    try {
      const monthlyPayload: Record<string, unknown> = { month: execMonth };
      for (const f of MONTHLY_FIELDS) monthlyPayload[f.key] = execValue(f.key);
      if (monthlyRec) await updateEntry(monthlyRec.id, monthlyPayload);
      else await postEntry('commercial', 'exec-target', monthlyPayload);

      const annualPayload = { year: execYear, sellThrough: execValue('sellThrough') };
      if (annualRec) await updateEntry(annualRec.id, annualPayload);
      else await postEntry('commercial', 'exec-target-annual', annualPayload);

      setMsg({ ok: true, text: `Executive targets saved for ${execMonth} (annual sell-through for ${execYear}).` });
      setEDrafts({});
      refresh();
    } catch (e) {
      setMsg({ ok: false, text: 'Could not save: ' + (e as Error).message });
    }
    setBusy(false);
  }

  return (
    <div className="bg-[var(--c-bg)] min-h-screen text-[var(--c-fg)] p-6">
      <div className="max-w-3xl mx-auto">
      <div className="mb-6 text-center">
        <h1 className="text-xl font-bold">Targets</h1>
        <p className="text-sm text-gray-500 mt-1">Set store weekly sales targets and the executive KPI targets that drive the Executive Command Center.</p>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap justify-center">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => { setTab(t.id); setMsg(null); }}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${tab === t.id ? 'bg-[#c8a951] text-black font-semibold' : 'bg-[var(--c-card)] border border-[var(--c-border)] text-gray-400 hover:text-[var(--c-fg)]'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {msg && (
        <div className={`mb-4 text-sm p-3 rounded-lg border ${msg.ok ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>
          {msg.text}
        </div>
      )}

      {tab === 'weekly' && (
        <div className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-lg p-4 max-w-3xl mx-auto">
          <p className="text-xs text-gray-500 mb-3">Set each store&apos;s weekly sales target. These appear read-only on the Store Manager Weekly Review.</p>
          <label className="text-xs text-gray-400">Week Ending
            <input type="date" value={weekEnd} onChange={(e) => { setWeekEnd(e.target.value); setDrafts({}); }} className={`block mt-1 ${inputCls}`} />
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
                            className={`w-40 text-right ${inputCls}`} placeholder="0" />
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
              <button onClick={saveWeekly} disabled={busy}
                className="mt-4 bg-[#c8a951] hover:bg-[#d4bf7a] text-black font-semibold px-6 py-2.5 rounded-lg text-sm disabled:opacity-50">
                {busy ? 'Saving…' : 'Save Targets'}
              </button>
            </>
          ) : (
            <p className="text-sm text-gray-500 mt-4">Choose a week-ending date to set targets.</p>
          )}
        </div>
      )}

      {tab === 'executive' && (
        <div className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-lg p-4 max-w-2xl mx-auto">
          <p className="text-xs text-gray-500 mb-3">Monthly KPI targets feed the Executive Command Center cards (and their progress bars). History is kept per month.</p>
          <label className="text-xs text-gray-400">Target Month
            <input type="month" value={execMonth} onChange={(e) => { setExecMonth(e.target.value); setEDrafts({}); }} className={`block mt-1 ${inputCls}`} />
          </label>

          {execMonth ? (
            <>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {MONTHLY_FIELDS.map((f) => (
                  <label key={f.key} className="text-xs text-gray-400">
                    {f.label} {f.unit === 'ghs' ? '(GHS)' : '(%)'}
                    <input type="number" value={execValue(f.key)} onChange={(e) => setEDrafts((d) => ({ ...d, [f.key]: e.target.value }))}
                      className={`block mt-1 w-full ${inputCls}`} placeholder="0" />
                  </label>
                ))}
              </div>

              <div className="mt-5 pt-4 border-t border-[var(--c-border)]">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Annual Target (YTD metrics)</div>
                <label className="text-xs text-gray-400">
                  Group Sell-Through % — for {execYear}
                  <input type="number" value={execValue('sellThrough')} onChange={(e) => setEDrafts((d) => ({ ...d, sellThrough: e.target.value }))}
                    className={`block mt-1 w-full sm:w-1/2 ${inputCls}`} placeholder="0" />
                </label>
              </div>

              <button onClick={saveExecutive} disabled={busy}
                className="mt-5 bg-[#c8a951] hover:bg-[#d4bf7a] text-black font-semibold px-6 py-2.5 rounded-lg text-sm disabled:opacity-50">
                {busy ? 'Saving…' : 'Save Executive Targets'}
              </button>
            </>
          ) : (
            <p className="text-sm text-gray-500 mt-4">Choose a month to set its executive KPI targets.</p>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
