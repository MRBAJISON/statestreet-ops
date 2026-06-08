'use client';

import { useState } from 'react';
import { STORES } from '@/lib/config';
import { postEntry } from '@/lib/api';

// The 28 SKU categories from the Store Manager Monday Review Worksheet.
const CATEGORIES = [
  'Luxury Suits', 'Business Suits', 'Casual Blazers', 'Formal Shirts', 'Casual Shirts',
  'Premium T-Shirts', 'Polo Shirts', 'Denim Jeans', 'Chinos', 'Formal Trousers',
  'Sneakers', 'Oxford Shoes', 'Derby Shoes', 'Loafers', 'Sandals',
  'Leather Belts', 'Premium Belts', 'Ties', 'Pocket Squares', 'Sunglasses',
  'Leather Bags', 'Wallets & Purses', 'Watches', 'Fragrances', 'Safari Sets',
  'Knitwear', 'Streetwear Sets', 'Jackets & Outerwear',
];

// Only the judgement CEO questions remain — the data-derived ones (top earners,
// concerns, stock risk) are captured directly by the category grid below.
const CEO_QUESTIONS = [
  { key: 'q3', text: 'Which category should Marketing amplify this week?' },
  { key: 'q5', text: 'What will you do differently this week to increase sales?' },
  { key: 'q6', text: 'If this store belonged to you, what would be your first three actions?' },
];

const inputCls = 'w-full bg-[var(--c-card)] border border-[var(--c-border)] rounded px-1.5 py-1 text-xs text-[var(--c-fg)] focus:outline-none focus:border-[#c8a951]';
const headInputCls = 'bg-[var(--c-card)] border border-[var(--c-border)] rounded px-3 py-2 text-sm text-[var(--c-fg)] focus:outline-none focus:border-[#c8a951]';
const num = (s: string) => Number(s) || 0;

// Performance rating from sell-through of opening stock.
function ratingFor(openingStock: number, unitsSold: number): string {
  if (openingStock <= 0 || unitsSold < 0) return '';
  const pct = (unitsSold / openingStock) * 100;
  if (pct >= 80) return 'Good';
  if (pct >= 50) return 'Fair';
  return 'Poor';
}

export default function WeeklyReview() {
  const [header, setHeader] = useState({ store: '', manager: '', weekEnd: '', weeklySalesTarget: '', actualSales: '' });
  // rows[category][colKey] holds only the manually entered fields.
  const [rows, setRows] = useState<Record<string, Record<string, string>>>({});
  const [ceo, setCeo] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const headerAchievement = num(header.weeklySalesTarget)
    ? Math.round((num(header.actualSales) / num(header.weeklySalesTarget)) * 1000) / 10
    : 0;

  const setCell = (cat: string, key: string, val: string) =>
    setRows((r) => ({ ...r, [cat]: { ...(r[cat] ?? {}), [key]: val } }));
  const cell = (cat: string, key: string) => rows[cat]?.[key] ?? '';

  // Auto-calculated columns for a category row.
  const calc = (cat: string) => {
    const opening = num(cell(cat, 'openingStock'));
    const sold = num(cell(cat, 'unitsSold'));
    const price = num(cell(cat, 'unitPrice'));
    return { revenue: sold * price, currentStock: opening - sold, rating: ratingFor(opening, sold) };
  };

  async function submit() {
    if (!header.store || !header.weekEnd) {
      setMsg({ ok: false, text: 'Store and Week Ending are required.' });
      return;
    }
    setSubmitting(true);
    try {
      // Build category payload incl. computed values; skip untouched rows.
      const categories: Record<string, Record<string, string | number>> = {};
      for (const cat of CATEGORIES) {
        const r = rows[cat];
        if (!r) continue;
        const touched = ['openingStock', 'unitsSold', 'unitPrice', 'comments'].some((k) => (r[k] ?? '') !== '');
        if (!touched) continue;
        const c = calc(cat);
        categories[cat] = {
          openingStock: cell(cat, 'openingStock'),
          unitsSold: cell(cat, 'unitsSold'),
          unitPrice: cell(cat, 'unitPrice'),
          revenue: c.revenue,
          currentStock: c.currentStock,
          rating: c.rating,
          comments: cell(cat, 'comments'),
        };
      }
      const payload = { ...header, achievement: headerAchievement, categories, ceo };
      await postEntry('commercial', 'weekly-review', payload);
      setMsg({ ok: true, text: 'Weekly review saved to the live database.' });
      setRows({}); setCeo({});
      setHeader({ store: '', manager: '', weekEnd: '', weeklySalesTarget: '', actualSales: '' });
    } catch (e) {
      setMsg({ ok: false, text: 'Could not save: ' + (e as Error).message });
    }
    setSubmitting(false);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">Store Manager Weekly Review</h2>
        <p className="text-sm text-gray-500">Merchandise-to-Money commercial review — one weekly submission per store.</p>
      </div>

      {msg && (
        <div className={`text-sm p-3 rounded-lg border ${msg.ok ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>
          {msg.text}
        </div>
      )}

      {/* Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="text-xs text-gray-400">Store
          <select value={header.store} onChange={(e) => setHeader({ ...header, store: e.target.value })} className={`${headInputCls} w-full mt-1`}>
            <option value="">Select…</option>
            {STORES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
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

      {/* Category performance grid (auto revenue / current stock / rating) */}
      <div>
        <div className="text-sm font-semibold mb-1">Category Performance Review</div>
        <div className="text-xs text-gray-500 mb-2">Enter opening stock, units sold and unit price. Revenue, current stock and the performance rating are calculated automatically.</div>
        <div className="overflow-x-auto border border-[var(--c-border)] rounded-lg">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[var(--c-card2)] text-gray-500">
                <th className="text-left p-2 sticky left-0 bg-[var(--c-card2)] min-w-[9rem]">SKU Category</th>
                <th className="text-left p-2 font-medium min-w-[5.5rem]">Opening Stock</th>
                <th className="text-left p-2 font-medium min-w-[5.5rem]">Units Sold</th>
                <th className="text-left p-2 font-medium min-w-[6rem]">Unit Price (GHC)</th>
                <th className="text-left p-2 font-medium min-w-[7rem]">Revenue (auto)</th>
                <th className="text-left p-2 font-medium min-w-[6rem]">Current Stock (auto)</th>
                <th className="text-left p-2 font-medium min-w-[5.5rem]">Rating (auto)</th>
                <th className="text-left p-2 font-medium min-w-[9rem]">Comments</th>
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((cat) => {
                const c = calc(cat);
                const ratingColor = c.rating === 'Good' ? 'text-green-400' : c.rating === 'Fair' ? 'text-yellow-400' : c.rating === 'Poor' ? 'text-red-400' : 'text-gray-600';
                return (
                  <tr key={cat} className="border-t border-[var(--c-hover)]">
                    <td className="p-1.5 sticky left-0 bg-[var(--c-bg)] text-gray-300 whitespace-nowrap">{cat}</td>
                    <td className="p-1"><input type="number" value={cell(cat, 'openingStock')} onChange={(e) => setCell(cat, 'openingStock', e.target.value)} className={inputCls} /></td>
                    <td className="p-1"><input type="number" value={cell(cat, 'unitsSold')} onChange={(e) => setCell(cat, 'unitsSold', e.target.value)} className={inputCls} /></td>
                    <td className="p-1"><input type="number" value={cell(cat, 'unitPrice')} onChange={(e) => setCell(cat, 'unitPrice', e.target.value)} className={inputCls} /></td>
                    <td className="p-1.5 text-[#c8a951] whitespace-nowrap">{c.revenue ? `GHS ${c.revenue.toLocaleString()}` : '—'}</td>
                    <td className="p-1.5">{cell(cat, 'openingStock') !== '' ? c.currentStock : '—'}</td>
                    <td className={`p-1.5 font-medium ${ratingColor}`}>{c.rating || '—'}</td>
                    <td className="p-1"><input type="text" value={cell(cat, 'comments')} onChange={(e) => setCell(cat, 'comments', e.target.value)} className={inputCls} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* CEO questions (judgement only) */}
      <div>
        <div className="text-sm font-semibold mb-2">CEO Questions</div>
        <div className="space-y-3">
          {CEO_QUESTIONS.map((q, i) => (
            <div key={q.key}>
              <label className="block text-xs text-gray-400 mb-1">{i + 1}. {q.text}</label>
              <textarea value={ceo[q.key] ?? ''} onChange={(e) => setCeo({ ...ceo, [q.key]: e.target.value })} rows={2} className="w-full bg-[var(--c-card)] border border-[var(--c-border)] rounded-lg px-3 py-2 text-sm text-[var(--c-fg)] resize-none focus:outline-none focus:border-[#c8a951]" />
            </div>
          ))}
        </div>
      </div>

      <button type="button" onClick={submit} disabled={submitting}
        className="bg-[#c8a951] hover:bg-[#d4bf7a] text-black font-semibold px-6 py-2.5 rounded-lg text-sm disabled:opacity-50">
        {submitting ? 'Saving…' : 'Submit Weekly Review'}
      </button>
    </div>
  );
}
