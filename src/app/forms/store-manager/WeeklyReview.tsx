'use client';

import { useState } from 'react';
import { STORES } from '@/lib/config';
import { postEntry, updateEntry } from '@/lib/api';

// The 28 SKU categories from the Store Manager Monday Review Worksheet.
const CATEGORIES = [
  'Luxury Suits', 'Business Suits', 'Casual Blazers', 'Formal Shirts', 'Casual Shirts',
  'Premium T-Shirts', 'Polo Shirts', 'Denim Jeans', 'Chinos', 'Formal Trousers',
  'Sneakers', 'Oxford Shoes', 'Derby Shoes', 'Loafers', 'Sandals',
  'Leather Belts', 'Premium Belts', 'Ties', 'Pocket Squares', 'Sunglasses',
  'Leather Bags', 'Wallets & Purses', 'Watches', 'Fragrances', 'Safari Sets',
  'Knitwear', 'Streetwear Sets', 'Jackets & Outerwear',
];

type Col = { key: string; label: string; type?: 'number' | 'text'; options?: string[]; auto?: boolean };

const SECTIONS: { id: string; title: string; note?: string; cols: Col[] }[] = [
  {
    id: 's1', title: 'Section 1 · Category Performance Review', note: 'Enter opening stock, units sold and unit price — revenue, current stock and rating fill in automatically.',
    cols: [
      { key: 'openingStock', label: 'Opening Stock', type: 'number' },
      { key: 'unitsSold', label: 'Units Sold Last Week', type: 'number' },
      { key: 'unitPrice', label: 'Unit Price (GHC)', type: 'number' },
      { key: 'revenue', label: 'Revenue Generated (auto)', auto: true },
      { key: 'currentStock', label: 'Current Stock (auto)', auto: true },
      { key: 'rating', label: 'Performance Rating (auto)', auto: true },
      { key: 'comments', label: 'Comments', type: 'text' },
    ],
  },
  {
    id: 's2', title: 'Section 2 · Inventory Risk Assessment', note: 'Review every category.',
    cols: [
      { key: 'overstocked', label: 'Overstocked?', options: ['', 'Y', 'N'] },
      { key: 'slowMoving', label: 'Slow Moving?', options: ['', 'Y', 'N'] },
      { key: 'weeksNoMove', label: 'Weeks w/o Movement', type: 'number' },
      { key: 'valueAtRisk', label: 'Stock Value at Risk (GHC)', type: 'number' },
      { key: 'corrective', label: 'Corrective Action', type: 'text' },
    ],
  },
  {
    id: 's3', title: "Section 3 · This Week's Commercial Plan", note: 'Every category must have a plan.',
    cols: [
      { key: 'salesTargetUnits', label: 'Sales Target Units', type: 'number' },
      { key: 'revenueTarget', label: 'Revenue Target (GHC)', type: 'number' },
      { key: 'keyActivity', label: 'Key Selling Activity', type: 'text' },
      { key: 'planAdvisor', label: 'Responsible Advisor', type: 'text' },
    ],
  },
  {
    id: 's4', title: 'Section 4 · Category Ownership',
    cols: [
      { key: 'assignedAdvisor', label: 'Assigned Advisor', type: 'text' },
      { key: 'weeklyUnitTarget', label: 'Weekly Unit Target', type: 'number' },
      { key: 'actualUnits', label: 'Actual Units Sold', type: 'number' },
      { key: 'achievement', label: 'Achievement % (auto)', auto: true },
      { key: 'mgrComments', label: 'Manager Comments', type: 'text' },
    ],
  },
];

// Manager judgement questions, shown under Section 1.
const CEO_QUESTIONS = [
  { key: 'q3', text: 'Which category should Marketing amplify this week?' },
  { key: 'q5', text: 'What will you do differently this week to increase sales?' },
  { key: 'q6', text: 'If this store belonged to you, what would be your first three actions?' },
];

const inputCls ='w-full bg-[var(--c-card)] border border-[var(--c-border)] rounded px-1.5 py-1 text-xs text-[var(--c-fg)] focus:outline-none focus:border-[#c8a951]';
const headInputCls = 'bg-[var(--c-card)] border border-[var(--c-border)] rounded px-3 py-2 text-sm text-[var(--c-fg)] focus:outline-none focus:border-[#c8a951]';
const num = (s: string) => Number(s) || 0;

export default function WeeklyReview({ assignedStore = '' }: { assignedStore?: string }) {
  const [header, setHeader] = useState({ store: assignedStore, manager: '', weekEnd: '', weeklySalesTarget: '', actualSales: '' });
  // rows[category][colKey] = manually entered value
  const [rows, setRows] = useState<Record<string, Record<string, string>>>({});
  const [ceo, setCeo] = useState<Record<string, string>>({});
  const [activeSection, setActiveSection] = useState('s1');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // The in-progress review is saved into a single entry; the header/data stay on
  // screen across section saves and only clear when the final section is submitted.
  const [entryId, setEntryId] = useState<number | null>(null);

  const headerAchievement = num(header.weeklySalesTarget)
    ? Math.round((num(header.actualSales) / num(header.weeklySalesTarget)) * 1000) / 10
    : 0;

  const setCell = (cat: string, key: string, val: string) =>
    setRows((r) => ({ ...r, [cat]: { ...(r[cat] ?? {}), [key]: val } }));
  const cell = (cat: string, key: string) => rows[cat]?.[key] ?? '';

  // Section 1 auto-calculations.
  const revenueOf = (cat: string) => num(cell(cat, 'unitsSold')) * num(cell(cat, 'unitPrice'));
  const currentStockOf = (cat: string) => num(cell(cat, 'openingStock')) - num(cell(cat, 'unitsSold'));
  const ratingOf = (cat: string) => {
    const opening = num(cell(cat, 'openingStock'));
    if (opening <= 0) return '';
    const pct = (num(cell(cat, 'unitsSold')) / opening) * 100; // sell-through of opening stock
    if (pct >= 80) return 'Good';
    if (pct >= 50) return 'Fair';
    return 'Poor';
  };
  // Section 4 auto-calculation.
  const rowAchievement = (cat: string) => {
    const t = num(cell(cat, 'weeklyUnitTarget'));
    return t ? Math.round((num(cell(cat, 'actualUnits')) / t) * 1000) / 10 : 0;
  };

  const isFinalSection = activeSection === 's4';

  async function submit() {
    if (!header.store || !header.weekEnd) {
      setMsg({ ok: false, text: 'Store and Week Ending are required.' });
      return;
    }
    setSubmitting(true);
    try {
      // Merge manual fields with the computed ones so the dashboards get revenue/rating/etc.
      const categories: Record<string, Record<string, string | number>> = {};
      for (const cat of CATEGORIES) {
        const r = rows[cat];
        if (!r) continue;
        categories[cat] = {
          ...r,
          revenue: revenueOf(cat),
          currentStock: currentStockOf(cat),
          rating: ratingOf(cat),
          achievement: rowAchievement(cat),
        };
      }
      const payload = { ...header, achievement: headerAchievement, categories, ceo };

      // First save creates the entry; later sections update the same record.
      if (entryId == null) {
        const res = await postEntry('commercial', 'weekly-review', payload);
        setEntryId(res?.entry?.id ?? null);
      } else {
        await updateEntry(entryId, payload);
      }

      if (isFinalSection) {
        // Final submission — clear the whole form for the next review.
        setMsg({ ok: true, text: 'Weekly review submitted to the live database.' });
        setRows({});
        setCeo({});
        setHeader({ store: assignedStore, manager: '', weekEnd: '', weeklySalesTarget: '', actualSales: '' });
        setEntryId(null);
        setActiveSection('s1');
      } else {
        // Keep the header and everything entered; just confirm the save.
        setMsg({ ok: true, text: 'Saved. Your header and entries are kept — continue to the next section.' });
      }
    } catch (e) {
      setMsg({ ok: false, text: 'Could not save: ' + (e as Error).message });
    }
    setSubmitting(false);
  }

  const section = SECTIONS.find((s) => s.id === activeSection)!;

  // Render an auto-calculated cell for the active section.
  const autoCell = (cat: string, key: string) => {
    if (key === 'revenue') {
      const v = revenueOf(cat);
      return <div className="px-1.5 py-1 text-[#c8a951] whitespace-nowrap">{v ? `GHS ${v.toLocaleString()}` : '—'}</div>;
    }
    if (key === 'currentStock') {
      return <div className="px-1.5 py-1">{cell(cat, 'openingStock') !== '' ? currentStockOf(cat) : '—'}</div>;
    }
    if (key === 'rating') {
      const r = ratingOf(cat);
      const color = r === 'Good' ? 'text-green-400' : r === 'Fair' ? 'text-yellow-400' : r === 'Poor' ? 'text-red-400' : 'text-gray-600';
      return <div className={`px-1.5 py-1 font-medium ${color}`}>{r || '—'}</div>;
    }
    if (key === 'achievement') {
      const a = rowAchievement(cat);
      return <div className="px-1.5 py-1 text-[#c8a951]">{a ? `${a}%` : '—'}</div>;
    }
    return null;
  };

  return (
    <div className="space-y-5">
      {msg && (
        <div className={`text-sm p-3 rounded-lg border ${msg.ok ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>
          {msg.text}
        </div>
      )}

      {/* Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="text-xs text-gray-400">Store
          {assignedStore ? (
            <div className={`${headInputCls} w-full mt-1 opacity-70 cursor-not-allowed`}>
              {STORES.find((s) => s.value === assignedStore)?.label ?? assignedStore}
            </div>
          ) : (
            <select value={header.store} onChange={(e) => setHeader({ ...header, store: e.target.value })} className={`${headInputCls} w-full mt-1`}>
              <option value="">Select…</option>
              {STORES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          )}
        </label>
        <label className="text-xs text-gray-400">Manager
          <input value={header.manager} onChange={(e) => setHeader({ ...header, manager: e.target.value })} className={`${headInputCls} w-full mt-1`} />
        </label>
        <label className="text-xs text-gray-400">Week Ending
          <input type="date" value={header.weekEnd} onChange={(e) => setHeader({ ...header, weekEnd: e.target.value })} className={`${headInputCls} w-full mt-1`} />
        </label>
        <label className="text-xs text-gray-400">Weekly Sales Target (GHC)
          <input type="number" value={header.weeklySalesTarget} onChange={(e) => setHeader({ ...header, weeklySalesTarget: e.target.value })} className={`${headInputCls} w-full mt-1`} />
        </label>
        <label className="text-xs text-gray-400">Actual Sales (GHC)
          <input type="number" value={header.actualSales} onChange={(e) => setHeader({ ...header, actualSales: e.target.value })} className={`${headInputCls} w-full mt-1`} />
        </label>
        <div className="text-xs text-gray-400">Achievement %
          <div className="mt-1 bg-[var(--c-card2)] border border-[#c8a951]/30 rounded px-3 py-2 text-sm font-bold text-[#c8a951]">
            {headerAchievement ? `${headerAchievement}%` : '—'}
          </div>
        </div>
      </div>

      {/* Section switcher */}
      <div className="flex gap-2 flex-wrap border-b border-[var(--c-border)] pb-2">
        {SECTIONS.map((s) => (
          <button key={s.id} type="button" onClick={() => setActiveSection(s.id)}
            className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${activeSection === s.id ? 'bg-[#c8a951] text-black font-semibold' : 'bg-[var(--c-card)] border border-[var(--c-border)] text-gray-400 hover:text-[var(--c-fg)]'}`}>
            {s.title.split('·')[0].trim()}
          </button>
        ))}
      </div>

      {/* Active section grid */}
      <div>
        <div className="text-sm font-semibold mb-1">{section.title}</div>
        {section.note && <div className="text-xs text-gray-500 mb-2">{section.note}</div>}
        <div className="overflow-x-auto border border-[var(--c-border)] rounded-lg">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[var(--c-card2)] text-gray-500">
                <th className="text-left p-2 sticky left-0 bg-[var(--c-card2)] min-w-[9rem]">SKU Category</th>
                {section.cols.map((c) => <th key={c.key} className="text-left p-2 font-medium min-w-[7rem]">{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((cat) => (
                <tr key={cat} className="border-t border-[var(--c-hover)]">
                  <td className="p-1.5 sticky left-0 bg-[var(--c-bg)] text-gray-300 whitespace-nowrap">{cat}</td>
                  {section.cols.map((c) => (
                    <td key={c.key} className="p-1">
                      {c.auto ? (
                        autoCell(cat, c.key)
                      ) : c.options ? (
                        <select value={cell(cat, c.key)} onChange={(e) => setCell(cat, c.key, e.target.value)} className={inputCls}>
                          {c.options.map((o) => <option key={o} value={o}>{o || '—'}</option>)}
                        </select>
                      ) : (
                        <input type={c.type === 'number' ? 'number' : 'text'} value={cell(cat, c.key)} onChange={(e) => setCell(cat, c.key, e.target.value)} className={inputCls} />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Section 1 also captures the manager's judgement questions. */}
        {activeSection === 's1' && (
          <div className="mt-4 space-y-3">
            <div className="text-sm font-semibold">Manager Questions</div>
            {CEO_QUESTIONS.map((q, i) => (
              <div key={q.key}>
                <label className="block text-xs text-gray-400 mb-1">{i + 1}. {q.text}</label>
                <textarea value={ceo[q.key] ?? ''} onChange={(e) => setCeo({ ...ceo, [q.key]: e.target.value })} rows={2} className="w-full bg-[var(--c-card)] border border-[var(--c-border)] rounded-lg px-3 py-2 text-sm text-[var(--c-fg)] resize-none focus:outline-none focus:border-[#c8a951]" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submit is available on every section. Each save keeps the header and all
          entered data on screen; only the final section clears the form. */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={submit} disabled={submitting}
          className="bg-[#c8a951] hover:bg-[#d4bf7a] text-black font-semibold px-6 py-2.5 rounded-lg text-sm disabled:opacity-50">
          {submitting ? 'Saving…' : isFinalSection ? 'Submit Weekly Review' : 'Save Section'}
        </button>
        {!isFinalSection && <span className="text-xs text-gray-500">Your header and entries stay until you submit Section 4.</span>}
      </div>
    </div>
  );
}
