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

type Col = { key: string; label: string; type?: 'number' | 'text'; options?: string[] };

const SECTIONS: { id: string; title: string; note?: string; cols: Col[] }[] = [
  {
    id: 's1', title: 'Section 1 · Category Performance Review', note: 'Complete for ALL categories.',
    cols: [
      { key: 'openingStock', label: 'Opening Stock', type: 'number' },
      { key: 'unitsSold', label: 'Units Sold Last Week', type: 'number' },
      { key: 'revenue', label: 'Revenue Generated (GHC)', type: 'number' },
      { key: 'currentStock', label: 'Current Stock', type: 'number' },
      { key: 'rating', label: 'Performance Rating', options: ['', 'Good', 'Fair', 'Poor'] },
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
      { key: 'achievement', label: 'Achievement %', type: 'number' }, // auto
      { key: 'mgrComments', label: 'Manager Comments', type: 'text' },
    ],
  },
];

const CEO_QUESTIONS = [
  'Which 3 categories generated the most money last week and why?',
  'Which 3 categories concern you the most and why?',
  'Which category should Marketing amplify this week?',
  'What stock currently represents the greatest commercial risk?',
  'What will you do differently this week to increase sales?',
  'If this store belonged to you, what would be your first three actions?',
];

const DECLARATIONS = [
  'My category performance', 'My inventory position', 'My stock risks',
  'My revenue targets', 'My execution priorities for the week',
];

const inputCls = 'w-full bg-[#111] border border-[#2a2a2a] rounded px-1.5 py-1 text-xs text-white focus:outline-none focus:border-[#c8a951]';
const headInputCls = 'bg-[#111] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#c8a951]';
const num = (s: string) => Number(s) || 0;

export default function WeeklyReview() {
  const [header, setHeader] = useState({ store: '', manager: '', weekEnd: '', weeklySalesTarget: '', actualSales: '' });
  // rows[category][colKey] = value
  const [rows, setRows] = useState<Record<string, Record<string, string>>>({});
  const [ceo, setCeo] = useState<string[]>(Array(6).fill(''));
  const [decl, setDecl] = useState<boolean[]>(Array(5).fill(false));
  const [signoff, setSignoff] = useState({ manager: '', signature: '', date: '' });
  const [activeSection, setActiveSection] = useState('s1');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const headerAchievement = num(header.weeklySalesTarget)
    ? Math.round((num(header.actualSales) / num(header.weeklySalesTarget)) * 1000) / 10
    : 0;

  const setCell = (cat: string, key: string, val: string) =>
    setRows((r) => ({ ...r, [cat]: { ...(r[cat] ?? {}), [key]: val } }));

  const cell = (cat: string, key: string) => rows[cat]?.[key] ?? '';
  const rowAchievement = (cat: string) => {
    const t = num(cell(cat, 'weeklyUnitTarget'));
    return t ? Math.round((num(cell(cat, 'actualUnits')) / t) * 1000) / 10 : 0;
  };

  async function submit() {
    if (!header.store || !header.weekEnd) {
      setMsg({ ok: false, text: 'Store and Week Ending are required.' });
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...header,
        achievement: headerAchievement,
        categories: rows,
        ceo: Object.fromEntries(ceo.map((a, i) => [`q${i + 1}`, a])),
        declaration: { confirmed: DECLARATIONS.filter((_, i) => decl[i]), ...signoff },
      };
      await postEntry('commercial', 'weekly-review', payload);
      setMsg({ ok: true, text: 'Weekly review saved to the live database.' });
      setRows({}); setCeo(Array(6).fill('')); setDecl(Array(5).fill(false));
      setHeader({ store: '', manager: '', weekEnd: '', weeklySalesTarget: '', actualSales: '' });
      setSignoff({ manager: '', signature: '', date: '' });
    } catch (e) {
      setMsg({ ok: false, text: 'Could not save: ' + (e as Error).message });
    }
    setSubmitting(false);
  }

  const section = SECTIONS.find((s) => s.id === activeSection)!;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">Store Manager Monday Review Worksheet</h2>
        <p className="text-sm text-gray-500">Merchandise-to-Money Commercial Review — one weekly submission per store.</p>
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
          <div className="mt-1 bg-[#0d0d0d] border border-[#c8a951]/30 rounded px-3 py-2 text-sm font-bold text-[#c8a951]">
            {headerAchievement ? `${headerAchievement}%` : '—'}
          </div>
        </div>
      </div>

      {/* Section switcher */}
      <div className="flex gap-2 flex-wrap border-b border-[#2a2a2a] pb-2">
        {SECTIONS.map((s) => (
          <button key={s.id} type="button" onClick={() => setActiveSection(s.id)}
            className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${activeSection === s.id ? 'bg-[#c8a951] text-black font-semibold' : 'bg-[#111] border border-[#2a2a2a] text-gray-400 hover:text-white'}`}>
            {s.title.split('·')[0].trim()}
          </button>
        ))}
      </div>

      {/* Active section grid */}
      <div>
        <div className="text-sm font-semibold mb-1">{section.title}</div>
        {section.note && <div className="text-xs text-gray-500 mb-2">{section.note}</div>}
        <div className="overflow-x-auto border border-[#2a2a2a] rounded-lg">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#0d0d0d] text-gray-500">
                <th className="text-left p-2 sticky left-0 bg-[#0d0d0d] min-w-[9rem]">SKU Category</th>
                {section.cols.map((c) => <th key={c.key} className="text-left p-2 font-medium min-w-[7rem]">{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((cat) => (
                <tr key={cat} className="border-t border-[#1a1a1a]">
                  <td className="p-1.5 sticky left-0 bg-[#0a0a0a] text-gray-300 whitespace-nowrap">{cat}</td>
                  {section.cols.map((c) => (
                    <td key={c.key} className="p-1">
                      {c.key === 'achievement' ? (
                        <div className="px-1.5 py-1 text-[#c8a951]">{rowAchievement(cat) ? `${rowAchievement(cat)}%` : '—'}</div>
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
      </div>

      {/* CEO questions */}
      <div>
        <div className="text-sm font-semibold mb-2">CEO Questions <span className="text-red-400 text-xs">(mandatory)</span></div>
        <div className="space-y-3">
          {CEO_QUESTIONS.map((q, i) => (
            <div key={i}>
              <label className="block text-xs text-gray-400 mb-1">{i + 1}. {q}</label>
              <textarea value={ceo[i]} onChange={(e) => setCeo(ceo.map((v, j) => (j === i ? e.target.value : v)))} rows={2} className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-[#c8a951]" />
            </div>
          ))}
        </div>
      </div>

      {/* Declaration */}
      <div>
        <div className="text-sm font-semibold mb-2">Store Manager Declaration</div>
        <p className="text-xs text-gray-500 mb-2">I confirm that I understand:</p>
        <div className="space-y-1.5 mb-3">
          {DECLARATIONS.map((d, i) => (
            <label key={i} className="flex items-center gap-2 text-xs text-gray-300">
              <input type="checkbox" checked={decl[i]} onChange={(e) => setDecl(decl.map((v, j) => (j === i ? e.target.checked : v)))} />
              {d}
            </label>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input placeholder="Store Manager" value={signoff.manager} onChange={(e) => setSignoff({ ...signoff, manager: e.target.value })} className={headInputCls} />
          <input placeholder="Signature" value={signoff.signature} onChange={(e) => setSignoff({ ...signoff, signature: e.target.value })} className={headInputCls} />
          <input type="date" value={signoff.date} onChange={(e) => setSignoff({ ...signoff, date: e.target.value })} className={headInputCls} />
        </div>
      </div>

      <button type="button" onClick={submit} disabled={submitting}
        className="bg-[#c8a951] hover:bg-[#d4bf7a] text-black font-semibold px-6 py-2.5 rounded-lg text-sm disabled:opacity-50">
        {submitting ? 'Saving…' : 'Submit Weekly Review'}
      </button>
    </div>
  );
}
