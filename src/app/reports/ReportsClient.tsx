'use client';

import { useState } from 'react';

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthStart = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`; };
const today = () => iso(new Date());
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };

const inputCls = 'w-full bg-[var(--c-card2)] border border-[var(--c-border)] rounded px-3 py-2 text-sm text-[var(--c-fg)] focus:outline-none focus:border-[#c8a951]';

export default function ReportsClient({ scope, label }: { scope: string; label: string }) {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [downloading, setDownloading] = useState(false);

  function download() {
    const params = new URLSearchParams({ scope });
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    setDownloading(true);
    // Content-Disposition: attachment makes the browser download the .xlsx.
    window.location.href = `/api/export?${params.toString()}`;
    setTimeout(() => setDownloading(false), 2500);
  }

  return (
    <div className="min-h-screen bg-[var(--c-bg)] text-[var(--c-fg)] p-6">
      <div className="max-w-lg mx-auto space-y-5">
        <div className="text-center">
          <h1 className="text-xl font-bold">Entry Report</h1>
          <p className="text-sm text-gray-500 mt-1">{label} · choose a date range, then download the Excel report.</p>
        </div>

        <div className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-lg p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">From</label>
              <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">To</label>
              <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { setFrom(monthStart()); setTo(today()); }} className="text-xs px-3 py-1.5 rounded border border-[var(--c-border2)] text-gray-400 hover:text-[var(--c-fg)]">This month</button>
            <button type="button" onClick={() => { setFrom(daysAgo(7)); setTo(today()); }} className="text-xs px-3 py-1.5 rounded border border-[var(--c-border2)] text-gray-400 hover:text-[var(--c-fg)]">Last 7 days</button>
            <button type="button" onClick={() => { setFrom(daysAgo(30)); setTo(today()); }} className="text-xs px-3 py-1.5 rounded border border-[var(--c-border2)] text-gray-400 hover:text-[var(--c-fg)]">Last 30 days</button>
            <button type="button" onClick={() => { setFrom(''); setTo(''); }} className="text-xs px-3 py-1.5 rounded border border-[var(--c-border2)] text-gray-400 hover:text-[var(--c-fg)]">All time</button>
          </div>

          <div className="pt-1">
            <button type="button" onClick={download} disabled={downloading}
              className="w-full bg-[#c8a951] hover:bg-[#d4bf7a] text-black font-semibold px-5 py-2.5 rounded-lg text-sm disabled:opacity-50">
              {downloading ? 'Preparing…' : `⬇ Download ${from || to ? 'selected range' : 'all-time'} report`}
            </button>
          </div>
          <p className="text-[0.7rem] text-gray-500">{from || to ? `Includes entries dated ${from || 'the beginning'} → ${to || 'today'}.` : 'No date filter — includes every entry.'}</p>
        </div>
      </div>
    </div>
  );
}
