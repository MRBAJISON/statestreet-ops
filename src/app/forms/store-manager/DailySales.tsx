'use client';

import { useState } from 'react';
import FormField from '@/components/forms/FormField';
import FormSection from '@/components/forms/FormSection';
import { postEntry, type EntryRow } from '@/lib/api';
import { Spinner } from '@/components/ui/BrandedLoader';
import { labelFor, PAYMENT_MODES, payKey } from '@/lib/config';
import { useOrg } from '@/components/providers/OrgProvider';
import { toLabelMap, categoriesForStore } from '@/lib/org';

const fmtGHS = (n: number) => `GHS ${Math.round(n).toLocaleString()}`;

// Daily sales capture (saved as finance/revenue). Store is fixed to the manager's store.
export default function DailySales({ assignedStore, recent, onSaved }: { assignedStore: string; recent: EntryRow[]; onSaved: () => void }) {
  const { org } = useOrg();
  const categoryLabels = toLabelMap(org.categories);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Net Revenue auto-calculates as Gross Revenue − Discounts Given.
  // (COGS is captured for gross-profit metrics, not deducted from net revenue.)
  const [gross, setGross] = useState('');
  const [discounts, setDiscounts] = useState('');
  // The store's brand drives the available categories (Brand → Stores + Brand →
  // Categories mappings in Settings). Store is fixed, so it filters automatically.
  const [category, setCategory] = useState('');
  const num = (s: string) => Number(s) || 0;
  const netRevenue = num(gross) ? Math.round((num(gross) - num(discounts)) * 100) / 100 : 0;

  // Daily closing report (submitted once a day, not per category): customers +
  // the day's takings by payment mode. Saved as finance/closing.
  const [closing, setClosing] = useState(false);
  const [showClosing, setShowClosing] = useState(false);
  const [closingMsg, setClosingMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [payments, setPayments] = useState<Record<string, string>>({});
  const paymentsTotal = Math.round(PAYMENT_MODES.reduce((s, m) => s + num(payments[m.value] ?? ''), 0) * 100) / 100;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const payload: Record<string, unknown> = {};
    fd.forEach((v, k) => { payload[k] = typeof v === 'string' ? v : ''; });
    payload.store = assignedStore;
    setSubmitting(true);
    try {
      await postEntry('finance', 'revenue', payload);
      setMsg({ ok: true, text: 'Daily sales saved — it adds to this week’s Actual Sales below.' });
      form.reset();
      setGross('');
      setDiscounts('');
      setCategory('');
      onSaved();
    } catch (err) {
      setMsg({ ok: false, text: 'Could not save: ' + (err as Error).message });
    }
    setSubmitting(false);
    setTimeout(() => setMsg(null), 4000);
  }

  async function handleClosing(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const payload: Record<string, unknown> = {};
    fd.forEach((v, k) => { payload[k] = typeof v === 'string' ? v : ''; });
    payload.store = assignedStore;
    setClosing(true);
    try {
      await postEntry('finance', 'closing', payload);
      setClosingMsg({ ok: true, text: 'Closing report saved for the day.' });
      form.reset();
      setPayments({});
      onSaved();
    } catch (err) {
      setClosingMsg({ ok: false, text: 'Could not save: ' + (err as Error).message });
    }
    setClosing(false);
    setTimeout(() => setClosingMsg(null), 4000);
  }

  const recentSorted = [...recent].sort((a, b) => (String(a.payload.date) < String(b.payload.date) ? 1 : -1)).slice(0, 8);

  return (
   <>
    <FormSection title="Daily Sales" description="Log each day’s sales by category. These build up into this week’s Actual Sales and Section 1 of the review below.">
      {msg && (
        <div className={`mb-3 text-sm p-3 rounded-lg border ${msg.ok ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>{msg.text}</div>
      )}
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-1">
          <FormField label="Date" name="date" type="date" required />
          <FormField label="Category" name="category" type="select" required value={category} onChange={(e) => setCategory(e.target.value)} options={categoriesForStore(org, assignedStore)} />
          <FormField label="Opening Stock" name="openingStock" type="number" />
          <FormField label="Gross Revenue" name="grossRevenue" type="number" prefix="GHS" required step={0.01} value={gross} onChange={(e) => setGross(e.target.value)} />
          <FormField label="Cost of Goods (COGS)" name="cogs" type="number" prefix="GHS" step={0.01} />
          <FormField label="Discounts Given" name="discounts" type="number" prefix="GHS" step={0.01} value={discounts} onChange={(e) => setDiscounts(e.target.value)} />
          <FormField label="Net Revenue (auto)" name="netRevenue" type="number" prefix="GHS" value={netRevenue ? String(netRevenue) : ''} readOnly />
          <FormField label="Transactions" name="transactions" type="number" />
          <FormField label="Footfall" name="footfall" type="number" />
          <FormField label="Items Sold" name="itemsSold" type="number" />
        </div>

        <div className="flex gap-3 mt-3 flex-wrap">
          <button type="submit" disabled={submitting}
            className="bg-[#c8a951] hover:bg-[#d4bf7a] text-black font-semibold px-6 py-2.5 rounded-lg text-sm disabled:opacity-50">
            {submitting ? <><Spinner /> Saving…</> : 'Save Daily Sales'}
          </button>
          <button type="button" onClick={() => setShowClosing((s) => !s)}
            className={`px-6 py-2.5 rounded-lg text-sm border transition-colors ${showClosing ? 'bg-[var(--c-hover)] border-[#c8a951] text-[var(--c-fg)]' : 'border-[var(--c-border2)] text-gray-400 hover:text-[var(--c-fg)]'}`}>
            {showClosing ? '✕ Close Daily Closing' : '+ Daily Closing Report'}
          </button>
        </div>
      </form>

      {recentSorted.length > 0 && (
        <div className="mt-4">
          <div className="text-xs text-gray-400 mb-2">Recent daily sales (this store)</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--c-border)] text-gray-500">
                  <th className="text-left py-2 pr-3 font-medium">Date</th>
                  <th className="text-left py-2 pr-3 font-medium">Category</th>
                  <th className="text-right py-2 px-3 font-medium">Gross</th>
                  <th className="text-right py-2 font-medium">Items</th>
                </tr>
              </thead>
              <tbody>
                {recentSorted.map((e) => (
                  <tr key={e.id} className="border-b border-[var(--c-hover)]">
                    <td className="py-2 pr-3 whitespace-nowrap">{String(e.payload.date || '—')}</td>
                    <td className="py-2 pr-3">{labelFor(categoryLabels, e.payload.category)}</td>
                    <td className="py-2 px-3 text-right">{fmtGHS(Number(e.payload.grossRevenue) || 0)}</td>
                    <td className="py-2 text-right">{String(e.payload.itemsSold || '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </FormSection>

    {showClosing && (
    <FormSection title="Daily Closing Report" description="Submit once at the end of the day — total customers and the day's takings by payment mode. Not per category.">
      {closingMsg && (
        <div className={`mb-3 text-sm p-3 rounded-lg border ${closingMsg.ok ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>{closingMsg.text}</div>
      )}
      <form onSubmit={handleClosing}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-1">
          <FormField label="Date" name="date" type="date" required />
          <FormField label="Total Customers" name="customers" type="number" />
          <FormField label="New Customers" name="newCustomers" type="number" />
          <FormField label="Returning Customers" name="returningCustomers" type="number" />
        </div>

        <div className="mt-5">
          <h4 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Payments by Mode</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {PAYMENT_MODES.map((m) => (
              <FormField key={m.value} label={m.label} name={payKey(m.value)} type="number" prefix={org.currency} step={0.01}
                value={payments[m.value] ?? ''} onChange={(e) => setPayments((p) => ({ ...p, [m.value]: e.target.value }))} />
            ))}
            <FormField label="Payments Total (auto)" name="paymentsTotal" type="number" prefix={org.currency} value={paymentsTotal ? String(paymentsTotal) : ''} readOnly />
          </div>
        </div>

        <button type="submit" disabled={closing}
          className="mt-3 bg-[#c8a951] hover:bg-[#d4bf7a] text-black font-semibold px-6 py-2.5 rounded-lg text-sm disabled:opacity-50">
          {closing ? <><Spinner /> Saving…</> : 'Save Closing Report'}
        </button>
      </form>
    </FormSection>
    )}
   </>
  );
}
