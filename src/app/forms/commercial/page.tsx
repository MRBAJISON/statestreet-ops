'use client';

import { useMemo, useState } from 'react';
import FormField from '@/components/forms/FormField';
import FormSection from '@/components/forms/FormSection';
import RecentEntries from '@/components/ui/RecentEntries';
import WeeklyReview, { type DailySale, type WeekTarget } from '@/app/forms/store-manager/WeeklyReview';
import { submitEntry, useEntries } from '@/lib/api';
import { Spinner } from '@/components/ui/BrandedLoader';
import { useOrg } from '@/components/providers/OrgProvider';
import { categoriesForBrand, categoriesForStore } from '@/lib/org';
import { PAYMENT_MODES, payKey } from '@/lib/config';

const numOf = (s: string) => Number(s) || 0;
const fmt2 = (x: number) => (x ? x.toFixed(2) : '');
const fmt1 = (x: number) => (x ? x.toFixed(1) : '');

export default function CommercialFormsPage() {
  const { org } = useOrg();
  const [activeForm, setActiveForm] = useState('store-sales');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  // Auto-calc drivers (store sales + category performance)
  const [ssTotalSales, setSsTotalSales] = useState('');
  const [ssTxns, setSsTxns] = useState('');
  const [ssFootfall, setSsFootfall] = useState('');
  const [cpSales, setCpSales] = useState('');
  const [cpUnits, setCpUnits] = useState('');

  // Category filtering: SKU & New Arrivals filter by the product's Brand; Category
  // Performance filters by the selected Store's brand. `category` is shared.
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [cpStore, setCpStore] = useState('');

  // Daily Closing — opens on demand under Daily Store Sales (saved as finance/closing).
  const [showClosing, setShowClosing] = useState(false);
  const [closingBusy, setClosingBusy] = useState(false);
  const [closingMsg, setClosingMsg] = useState('');
  const [closingSubmitted, setClosingSubmitted] = useState(false);
  const [payments, setPayments] = useState<Record<string, string>>({});
  const paymentsTotal = Math.round(PAYMENT_MODES.reduce((s, m) => s + numOf(payments[m.value] ?? ''), 0) * 100) / 100;

  const ssAtv = numOf(ssTxns) ? numOf(ssTotalSales) / numOf(ssTxns) : 0;
  const ssConv = numOf(ssFootfall) ? (numOf(ssTxns) / numOf(ssFootfall)) * 100 : 0;
  const cpAsp = numOf(cpUnits) ? numOf(cpSales) / numOf(cpUnits) : 0;

  // Weekly Review (reuses the store worksheet) needs every store's daily sales
  // and weekly targets so it can scope to the store the user picks.
  const { entries: finEntries } = useEntries('finance', 5000);
  const { entries: comEntries } = useEntries('commercial', 5000);
  const dailySalesAll: DailySale[] = useMemo(
    () => finEntries.filter((e) => e.formType === 'revenue').map((e) => ({
      date: String(e.payload.date || ''), category: String(e.payload.category || ''),
      grossRevenue: Number(e.payload.grossRevenue) || 0, itemsSold: Number(e.payload.itemsSold) || 0,
      store: String(e.payload.store || ''),
    })),
    [finEntries]
  );
  const targetsAll: WeekTarget[] = useMemo(
    () => comEntries.filter((e) => e.formType === 'weekly-target').map((e) => ({
      weekEnd: String(e.payload.weekEnd || ''), target: Number(e.payload.target) || 0, store: String(e.payload.store || ''),
    })),
    [comEntries]
  );

  function resetAutoCalc() {
    setSsTotalSales('');
    setSsTxns('');
    setSsFootfall('');
    setCpSales('');
    setCpUnits('');
    setBrand('');
    setCategory('');
    setCpStore('');
  }

  function switchForm(id: string) {
    setActiveForm(id);
    resetAutoCalc();
  }

  const forms = [
    { id: 'store-sales', label: 'Daily Store Sales' },
    { id: 'category-perf', label: 'Category Performance' },
    { id: 'sku-entry', label: 'SKU Performance' },
    { id: 'new-arrivals', label: 'New Arrivals' },
    { id: 'accountability', label: 'Accountability Update' },
    { id: 'weekly-review', label: 'Weekly Review' },
  ];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    try {
      await submitEntry('commercial', activeForm, form);
      setMessage('Saved to the live database. The dashboard reflects it now.');
      form.reset();
      resetAutoCalc();
    } catch (err) {
      setMessage('Could not save: ' + (err as Error).message);
    } finally {
      setBusy(false);
    }
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 4000);
  }

  async function handleClosing(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setClosingBusy(true);
    try {
      await submitEntry('finance', 'closing', form);
      setClosingMsg('Daily closing saved. The Finance dashboard sums each payment mode across all stores.');
      form.reset();
      setPayments({});
    } catch (err) {
      setClosingMsg('Could not save: ' + (err as Error).message);
    } finally {
      setClosingBusy(false);
    }
    setClosingSubmitted(true);
    setTimeout(() => setClosingSubmitted(false), 4000);
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Commercial Data Entry</h1>
        <p className="text-sm text-gray-500 mt-1">Enter commercial data to update the Commercial Command Center dashboard</p>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {forms.map(f => (
          <button key={f.id} onClick={() => switchForm(f.id)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${activeForm === f.id ? 'bg-[#c8a951] text-black font-semibold' : 'bg-[var(--c-card)] border border-[var(--c-border)] text-gray-400 hover:text-[var(--c-fg)]'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {submitted && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-400 p-3 rounded-lg mb-4 text-sm">
          {message}
        </div>
      )}

      {activeForm === 'weekly-review' && (
        <div className="max-w-4xl">
          <p className="text-xs text-gray-500 mb-4">Pick a store, set the Week Ending, then complete the four sections. Units &amp; Revenue auto-fill from that store&apos;s daily sales; only the store&apos;s brand categories are shown.</p>
          <WeeklyReview dailySales={dailySalesAll} targets={targetsAll} />
        </div>
      )}

      {activeForm !== 'weekly-review' && (
      <form onSubmit={handleSubmit} className="space-y-4 max-w-4xl">
        {activeForm === 'store-sales' && (
          <FormSection title="Daily Store Sales" description="Record daily sales metrics per store">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
              <FormField label="Date" name="date" type="date" required />
              <FormField label="Store" name="store" type="select" required options={org.stores} />
              <FormField label="Opening Stock" name="openingStock" type="number" />
              <FormField label="Total Sales" name="totalSales" type="number" prefix="GHS" required step={0.01} value={ssTotalSales} onChange={(e) => setSsTotalSales(e.target.value)} />
              <FormField label="Number of Transactions" name="transactions" type="number" required value={ssTxns} onChange={(e) => setSsTxns(e.target.value)} />
              <FormField label="Footfall" name="footfall" type="number" required value={ssFootfall} onChange={(e) => setSsFootfall(e.target.value)} />
              <FormField label="Items Sold (Units)" name="unitsSold" type="number" required />
              <FormField label="Returns Value" name="returns" type="number" prefix="GHS" step={0.01} />
              <FormField label="Conversion Rate % (auto)" name="convRate" type="number" suffix="%" value={fmt1(ssConv)} readOnly />
              <FormField label="Avg Transaction Value (auto)" name="atv" type="number" prefix="GHS" value={fmt2(ssAtv)} readOnly />
            </div>
            <p className="text-xs text-gray-500 mt-3">Customers and payment-mode takings are captured once a day on the store’s <span className="text-gray-400">Daily Closing Report</span> (Store Manager form) or on the Finance form.</p>
          </FormSection>
        )}

        {activeForm === 'category-perf' && (
          <FormSection title="Category Performance" description="Weekly category sales breakdown">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
              <FormField label="Week Ending" name="weekEnd" type="date" required />
              <FormField label="Store" name="store" type="select" required value={cpStore} onChange={(e) => { setCpStore(e.target.value); setCategory(''); }} options={org.stores} />
              <FormField label="Category" name="category" type="select" required value={category} onChange={(e) => setCategory(e.target.value)} options={categoriesForStore(org, cpStore)} />
              <FormField label="Sales Value" name="sales" type="number" prefix="GHS" required step={0.01} value={cpSales} onChange={(e) => setCpSales(e.target.value)} />
              <FormField label="Units Sold" name="units" type="number" required value={cpUnits} onChange={(e) => setCpUnits(e.target.value)} />
              <FormField label="Gross Margin %" name="gm" type="number" suffix="%" step={0.1} />
              <FormField label="Sell Through %" name="sellThrough" type="number" suffix="%" step={0.1} />
              <FormField label="Avg Selling Price (auto)" name="asp" type="number" prefix="GHS" value={fmt2(cpAsp)} readOnly />
              <FormField label="Markdown %" name="markdown" type="number" suffix="%" step={0.1} />
            </div>
          </FormSection>
        )}

        {activeForm === 'sku-entry' && (
          <FormSection title="SKU Performance Entry" description="Record individual SKU performance">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
              <FormField label="SKU Code" name="sku" required placeholder="e.g. ARB-101-BLK-42" />
              <FormField label="Product Name" name="name" required />
              <FormField label="Brand" name="brand" type="select" value={brand} onChange={(e) => { setBrand(e.target.value); setCategory(''); }} options={org.brands} />
              <FormField label="Category" name="category" type="select" required value={category} onChange={(e) => setCategory(e.target.value)} options={categoriesForBrand(org, brand)} />
              <FormField label="Units Sold (MTD)" name="unitsSold" type="number" />
              <FormField label="Sales Value (MTD)" name="salesValue" type="number" prefix="GHS" step={0.01} />
              <FormField label="Current Stock" name="stock" type="number" />
              <FormField label="Days in Stock" name="daysInStock" type="number" />
              <FormField label="Status" name="status" type="select" options={[
                { label: 'Active', value: 'active' }, { label: 'Slow Moving', value: 'slow' },
                { label: 'Dead Stock', value: 'dead' }, { label: 'Out of Stock', value: 'oos' },
              ]} />
            </div>
          </FormSection>
        )}

        {activeForm === 'new-arrivals' && (
          <FormSection title="New Arrivals Registration" description="Register new stock arrivals">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
              <FormField label="Arrival Date" name="date" type="date" required />
              <FormField label="Brand" name="brand" type="select" required value={brand} onChange={(e) => { setBrand(e.target.value); setCategory(''); }} options={org.brands} />
              <FormField label="Category" name="category" type="select" required value={category} onChange={(e) => setCategory(e.target.value)} options={categoriesForBrand(org, brand)} />
              <FormField label="Total Quantity" name="qty" type="number" required />
              <FormField label="Stock Value" name="stockValue" type="number" prefix="GHS" required step={0.01} />
              <FormField label="Store Deployed To" name="store" type="select" options={org.stores} />
              <FormField label="Supplier" name="supplier" />
              <FormField label="PO Number" name="poNumber" placeholder="PO-XXXX" />
              <FormField label="Notes" name="notes" type="textarea" placeholder="Style notes, size breakdown, etc." />
            </div>
          </FormSection>
        )}

        {activeForm === 'accountability' && (
          <FormSection title="Accountability Update" description="Update KPI progress for team members">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
              <FormField label="Team Member" name="member" required />
              <FormField label="Role" name="role" type="select" options={[
                { label: 'Head of Commercial', value: 'hoc' },
                { label: 'Merchandise Manager', value: 'merch-mgr' },
                { label: 'Category Buyer', value: 'buyer' },
                { label: 'Store Operations Lead', value: 'store-ops' },
                { label: 'Pricing & Promotions Lead', value: 'pricing' },
              ]} />
              <FormField label="KPI" name="kpi" required placeholder="e.g. Sales Target Achievement" />
              <FormField label="Target" name="target" required placeholder="e.g. 100% or GHS 1,000,000" />
              <FormField label="Actual" name="actual" required placeholder="e.g. 65% or GHS 650,482" />
              <FormField label="Status" name="status" type="select" options={[
                { label: 'On Track', value: 'on-track' },
                { label: 'At Risk', value: 'at-risk' },
                { label: 'Off Track', value: 'off-track' },
              ]} />
            </div>
          </FormSection>
        )}

        <div className="flex gap-3 pt-2 flex-wrap">
          <button type="submit" disabled={busy} className="bg-[#c8a951] hover:bg-[#d4bf7a] text-black font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm disabled:opacity-50">{busy ? <><Spinner /> Saving…</> : 'Submit Entry'}</button>
          <button type="reset" className="bg-[var(--c-hover)] border border-[var(--c-border2)] text-gray-400 hover:text-[var(--c-fg)] px-6 py-2.5 rounded-lg transition-colors text-sm">Clear Form</button>
          {activeForm === 'store-sales' && (
            <button type="button" onClick={() => setShowClosing((s) => !s)}
              className={`px-6 py-2.5 rounded-lg text-sm border transition-colors ${showClosing ? 'bg-[var(--c-hover)] border-[#c8a951] text-[var(--c-fg)]' : 'border-[var(--c-border2)] text-gray-400 hover:text-[var(--c-fg)]'}`}>
              {showClosing ? '✕ Close Daily Closing' : '+ Daily Closing'}
            </button>
          )}
        </div>
      </form>
      )}

      {activeForm === 'store-sales' && showClosing && (
        <form onSubmit={handleClosing} className="space-y-4 max-w-4xl mt-6">
          {closingSubmitted && (
            <div className="bg-green-500/10 border border-green-500/30 text-green-400 p-3 rounded-lg text-sm">{closingMsg}</div>
          )}
          <FormSection title="Daily Closing" description="A store's end-of-day takings by payment mode + customer counts. One per store per day; the Finance dashboard sums each mode across all stores.">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
              <FormField label="Date" name="date" type="date" required />
              <FormField label="Store" name="store" type="select" required options={org.stores} />
              <FormField label="Total Customers" name="customers" type="number" />
              <FormField label="New Customers" name="newCustomers" type="number" />
              <FormField label="Returning Customers" name="returningCustomers" type="number" />
            </div>
            <div className="mt-4">
              <h4 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Payments by Mode</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {PAYMENT_MODES.map((mode) => (
                  <FormField key={mode.value} label={mode.label} name={payKey(mode.value)} type="number" prefix={org.currency} step={0.01}
                    value={payments[mode.value] ?? ''} onChange={(e) => setPayments((p) => ({ ...p, [mode.value]: e.target.value }))} />
                ))}
                <FormField label="Payments Total (auto)" name="paymentsTotal" type="number" prefix={org.currency} value={paymentsTotal ? String(paymentsTotal) : ''} readOnly />
              </div>
            </div>
            <div className="flex pt-3">
              <button type="submit" disabled={closingBusy} className="bg-[#c8a951] hover:bg-[#d4bf7a] text-black font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm disabled:opacity-50">
                {closingBusy ? <><Spinner /> Saving…</> : 'Save Closing Report'}
              </button>
            </div>
          </FormSection>
        </form>
      )}

      <div className="mt-8 max-w-4xl">
        <h2 className="text-sm font-bold uppercase tracking-wide mb-3">Your Submissions</h2>
        <RecentEntries department="commercial" />
      </div>
    </div>
  );
}
