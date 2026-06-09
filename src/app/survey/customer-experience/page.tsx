'use client';

import { useEffect, useState } from 'react';
import { STORES } from '@/lib/config';

const CATEGORIES = [
  { label: 'Store Cleanliness', value: 'cleanliness' },
  { label: 'Staff Knowledge & Service', value: 'staff-knowledge' },
  { label: 'Product Availability', value: 'availability' },
  { label: 'Fitting Room Experience', value: 'fitting-room' },
  { label: 'Checkout Speed', value: 'checkout' },
  { label: 'Overall Experience', value: 'overall' },
];

const RECOMMEND = [
  { label: 'Yes, definitely', value: 'promoter' },
  { label: 'Maybe', value: 'passive' },
  { label: 'No', value: 'detractor' },
];

const inputCls = 'w-full bg-[var(--c-card)] border border-[var(--c-border)] rounded-lg px-3 py-2.5 text-sm text-[var(--c-fg)] focus:outline-none focus:border-[#c8a951]';

export default function CustomerExperienceSurvey() {
  const [form, setForm] = useState({ store: '', category: '', nps: '', recommend: '', detail: '', name: '', contact: '', company: '' });
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  // After a successful submit, reload to a fresh blank form for the next customer.
  useEffect(() => {
    if (state !== 'done') return;
    const t = setTimeout(() => window.location.reload(), 2500);
    return () => clearTimeout(t);
  }, [state]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState('sending');
    setError('');
    try {
      const res = await fetch('/api/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, nps: form.nps === '' ? undefined : Number(form.nps) }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Could not submit.');
      }
      setState('done');
    } catch (err) {
      setError((err as Error).message);
      setState('error');
    }
  }

  return (
    <div className="min-h-screen bg-[var(--c-bg)] text-[var(--c-fg)] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="w-10 h-10 bg-[#c8a951] rounded-lg flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <div className="text-left">
              <h1 className="text-lg font-bold tracking-wider">STATESTREET</h1>
              <p className="text-[0.6rem] text-[#c8a951] tracking-widest">RETAIL GROUP</p>
            </div>
          </div>
          <h2 className="text-xl font-semibold">How was your experience?</h2>
          <p className="text-sm text-gray-500 mt-1">Your feedback takes a minute and helps us serve you better.</p>
        </div>

        {state === 'done' ? (
          <div className="bg-[var(--c-card)] border border-green-500/30 rounded-xl p-8 text-center">
            <div className="text-3xl mb-2">🙏</div>
            <div className="text-lg font-semibold text-green-400">Thank you!</div>
            <p className="text-sm text-gray-400 mt-1">Your feedback has been received.</p>
            <p className="text-xs text-gray-600 mt-3">Loading a fresh form…</p>
          </div>
        ) : (
          <form onSubmit={submit} className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-xl p-6 space-y-4">
            {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-3 rounded-lg">{error}</div>}

            <div>
              <label className="block text-sm text-gray-400 mb-1">Which store did you visit?</label>
              <select value={form.store} onChange={set('store')} className={inputCls}>
                <option value="">Select store…</option>
                {STORES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">What is your feedback about?</label>
              <select value={form.category} onChange={set('category')} className={inputCls}>
                <option value="">Select…</option>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">How likely are you to recommend us? (0–10)</label>
              <input type="number" min={0} max={10} value={form.nps} onChange={set('nps')} className={inputCls} placeholder="0 to 10" />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Would you shop with us again?</label>
              <select value={form.recommend} onChange={set('recommend')} className={inputCls}>
                <option value="">Select…</option>
                {RECOMMEND.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Tell us more</label>
              <textarea value={form.detail} onChange={set('detail')} rows={3} className={`${inputCls} resize-none`} placeholder="What did you like or what can we improve?" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input value={form.name} onChange={set('name')} className={inputCls} placeholder="Name (optional)" />
              <input value={form.contact} onChange={set('contact')} className={inputCls} placeholder="Phone/email (optional)" />
            </div>

            {/* Honeypot — hidden from humans, bots tend to fill it */}
            <input type="text" name="company" value={form.company} onChange={set('company')} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

            <button type="submit" disabled={state === 'sending'}
              className="w-full bg-[#c8a951] hover:bg-[#d4bf7a] text-black font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50">
              {state === 'sending' ? 'Submitting…' : 'Submit Feedback'}
            </button>
          </form>
        )}
        <p className="text-[0.65rem] text-gray-600 text-center mt-4">StateStreet Retail Group · Customer Experience</p>
      </div>
    </div>
  );
}
