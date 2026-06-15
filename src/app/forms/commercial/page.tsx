'use client';

import { useState } from 'react';
import FormField from '@/components/forms/FormField';
import FormSection from '@/components/forms/FormSection';
import RecentEntries from '@/components/ui/RecentEntries';
import { submitEntry } from '@/lib/api';
import { Spinner } from '@/components/ui/BrandedLoader';
import { useOrg } from '@/components/providers/OrgProvider';

const numOf = (s: string) => Number(s) || 0;
const fmt2 = (x: number) => (x ? x.toFixed(2) : '');
const fmt1 = (x: number) => (x ? x.toFixed(1) : '');

export default function CommercialFormsPage() {
  const { org } = useOrg();
  const CATEGORIES = org.categories;
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

  const ssAtv = numOf(ssTxns) ? numOf(ssTotalSales) / numOf(ssTxns) : 0;
  const ssConv = numOf(ssFootfall) ? (numOf(ssTxns) / numOf(ssFootfall)) * 100 : 0;
  const cpAsp = numOf(cpUnits) ? numOf(cpSales) / numOf(cpUnits) : 0;

  function resetAutoCalc() {
    setSsTotalSales('');
    setSsTxns('');
    setSsFootfall('');
    setCpSales('');
    setCpUnits('');
  }

  const forms = [
    { id: 'store-sales', label: 'Daily Store Sales' },
    { id: 'category-perf', label: 'Category Performance' },
    { id: 'sku-entry', label: 'SKU Performance' },
    { id: 'new-arrivals', label: 'New Arrivals' },
    { id: 'accountability', label: 'Accountability Update' },
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

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Commercial Data Entry</h1>
        <p className="text-sm text-gray-500 mt-1">Enter commercial data to update the Commercial Command Center dashboard</p>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {forms.map(f => (
          <button key={f.id} onClick={() => setActiveForm(f.id)}
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

      <form onSubmit={handleSubmit} className="space-y-4 max-w-4xl">
        {activeForm === 'store-sales' && (
          <FormSection title="Daily Store Sales" description="Record daily sales metrics per store">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
              <FormField label="Date" name="date" type="date" required />
              <FormField label="Store" name="store" type="select" required options={org.stores} />
              <FormField label="Total Sales" name="totalSales" type="number" prefix="GHS" required step={0.01} value={ssTotalSales} onChange={(e) => setSsTotalSales(e.target.value)} />
              <FormField label="Number of Transactions" name="transactions" type="number" required value={ssTxns} onChange={(e) => setSsTxns(e.target.value)} />
              <FormField label="Footfall" name="footfall" type="number" required value={ssFootfall} onChange={(e) => setSsFootfall(e.target.value)} />
              <FormField label="Items Sold (Units)" name="unitsSold" type="number" required />
              <FormField label="Returns Value" name="returns" type="number" prefix="GHS" step={0.01} />
              <FormField label="Conversion Rate % (auto)" name="convRate" type="number" suffix="%" value={fmt1(ssConv)} readOnly />
              <FormField label="Avg Transaction Value (auto)" name="atv" type="number" prefix="GHS" value={fmt2(ssAtv)} readOnly />
            </div>
          </FormSection>
        )}

        {activeForm === 'category-perf' && (
          <FormSection title="Category Performance" description="Weekly category sales breakdown">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
              <FormField label="Week Ending" name="weekEnd" type="date" required />
              <FormField label="Store" name="store" type="select" required options={org.stores} />
              <FormField label="Category" name="category" type="select" required options={CATEGORIES} />
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
              <FormField label="Category" name="category" type="select" required options={CATEGORIES} />
              <FormField label="Brand" name="brand" type="select" options={org.brands} />
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
              <FormField label="Brand" name="brand" required />
              <FormField label="Category" name="category" type="select" required options={CATEGORIES} />
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

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={busy} className="bg-[#c8a951] hover:bg-[#d4bf7a] text-black font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm disabled:opacity-50">{busy ? <><Spinner /> Saving…</> : 'Submit Entry'}</button>
          <button type="reset" className="bg-[var(--c-hover)] border border-[var(--c-border2)] text-gray-400 hover:text-[var(--c-fg)] px-6 py-2.5 rounded-lg transition-colors text-sm">Clear Form</button>
        </div>
      </form>

      <div className="mt-8 max-w-4xl">
        <h2 className="text-sm font-bold uppercase tracking-wide mb-3">Your Submissions</h2>
        <RecentEntries department="commercial" />
      </div>
    </div>
  );
}
