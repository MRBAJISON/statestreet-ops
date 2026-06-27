'use client';

import { useState } from 'react';
import FormField from '@/components/forms/FormField';
import FormSection from '@/components/forms/FormSection';
import MultiSelectDropdown from '@/components/forms/MultiSelectDropdown';
import RecentEntries from '@/components/ui/RecentEntries';
import { submitEntry } from '@/lib/api';
import { Spinner } from '@/components/ui/BrandedLoader';
import { useOrg } from '@/components/providers/OrgProvider';
import { subCategoriesForCategory } from '@/lib/org';

export default function InventoryForms({ managerName = '' }: { managerName?: string }) {
  const { org } = useOrg();
  const CATEGORIES = org.categories;
  const [activeForm, setActiveForm] = useState('stock-count');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  // Stock-transfer can span multiple categories + their sub-categories.
  const [transferCats, setTransferCats] = useState<string[]>([]);
  const [transferSubCats, setTransferSubCats] = useState<string[]>([]);
  // Goods Received: multi-select categories, then multi-select their sub-categories.
  const [grCategories, setGrCategories] = useState<string[]>([]);
  const [grSubCats, setGrSubCats] = useState<string[]>([]);

  // Sub-categories available = the pooled sub-categories of every selected category.
  const pooledSubs = (cats: string[]) => {
    const seen = new Set<string>();
    const out: { label: string; value: string }[] = [];
    for (const c of cats) for (const s of subCategoriesForCategory(org, c)) {
      if (!seen.has(s.value)) { seen.add(s.value); out.push(s); }
    }
    return out;
  };
  const grSubOptions = pooledSubs(grCategories);
  const transferSubOptions = pooledSubs(transferCats);

  // A person field that pre-fills (read-only) with the logged-in manager's name.
  const personField = (label: string, name: string, required = false) =>
    managerName
      ? <FormField label={label} name={name} value={managerName} readOnly required={required} />
      : <FormField label={label} name={name} required={required} />;

  const forms = [
    { id: 'stock-count', label: 'Stock Count' },
    { id: 'goods-receipt', label: 'Goods Received' },
    { id: 'stock-transfer', label: 'Stock Transfer' },
    { id: 'dead-stock', label: 'Dead Stock Review' },
    { id: 'replenishment', label: 'Replenishment Request' },
  ];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    try {
      await submitEntry('inventory', activeForm, form);
      setMessage('Saved to the live database. The dashboard reflects it now.');
      form.reset();
      setTransferCats([]); setTransferSubCats([]);
      setGrCategories([]); setGrSubCats([]);
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
        <h1 className="text-xl font-bold">Inventory Data Entry</h1>
        <p className="text-sm text-gray-500 mt-1">Enter inventory data to update the Inventory Command Center dashboard</p>
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
        {activeForm === 'stock-count' && (
          <FormSection title="Physical Stock Count" description="Record the store's stock count — total system vs physical and the value counted.">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
              <FormField label="Count Date" name="date" type="date" required />
              <FormField label="Store" name="store" type="select" required options={org.stores} />
              <FormField label="System Quantity" name="systemQty" type="number" required />
              <FormField label="Physical Count" name="physicalQty" type="number" required />
              <FormField label="Stock Value" name="stockValue" type="number" prefix="GHS" step={0.01} />
              {personField('Counted By', 'countedBy', true)}
              <FormField label="Notes" name="notes" type="textarea" placeholder="Variance explanation" />
            </div>
          </FormSection>
        )}

        {activeForm === 'goods-receipt' && (
          <FormSection title="Goods Received Note" description="Record incoming inventory">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
              <FormField label="Receipt Date" name="date" type="date" required />
              <FormField label="PO Number" name="poNumber" placeholder="PO-XXXX" />
              <FormField label="Supplier" name="supplier" />
              <FormField label="Brand" name="brand" placeholder="Type the brand" />
              <MultiSelectDropdown label="Categories" options={CATEGORIES} value={grCategories} onChange={(v) => { setGrCategories(v); }} />
              <input type="hidden" name="category" value={grCategories.join(', ')} />
              <MultiSelectDropdown label="Sub-categories" options={grSubOptions} value={grSubCats} onChange={setGrSubCats} placeholder={grCategories.length ? 'Select…' : 'Pick categories first'} />
              <input type="hidden" name="subCategories" value={grSubCats.join(', ')} />
              <FormField label="Total Units Received" name="units" type="number" required />
              <FormField label="Total Value" name="totalValue" type="number" prefix="GHS" required step={0.01} />
              <FormField label="Receiving Store" name="store" type="select" required options={[
                { label: 'Main Warehouse', value: 'warehouse' },
              ]} />
              <FormField label="Condition" name="condition" type="select" options={[
                { label: 'Good - All items OK', value: 'good' },
                { label: 'Partial - Some damaged', value: 'partial' },
                { label: 'Short - Missing items', value: 'short' },
              ]} />
              <FormField label="Discrepancy Notes" name="discrepancy" type="textarea" placeholder="Any issues with the delivery" />
            </div>
          </FormSection>
        )}

        {activeForm === 'stock-transfer' && (
          <FormSection title="Stock Transfer" description="Transfer inventory between stores">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
              <FormField label="Transfer Date" name="date" type="date" required />
              <FormField label="From Store" name="fromStore" type="select" required options={[{ label: 'Main Warehouse', value: 'warehouse' }, ...org.stores]} />
              <FormField label="To Store" name="toStore" type="select" required options={org.stores} />
              <FormField label="SKU Code" name="sku" placeholder="e.g. ARB-101-BLK-42" />
              <MultiSelectDropdown label="Categories" options={CATEGORIES} value={transferCats} onChange={setTransferCats} />
              <MultiSelectDropdown label="Sub-categories" options={transferSubOptions} value={transferSubCats} onChange={setTransferSubCats} placeholder={transferCats.length ? 'Select…' : 'Pick categories first'} />
              <FormField label="Product Description" name="description" required />
              <FormField label="Quantity" name="qty" type="number" required />
              <FormField label="Total Value" name="totalValue" type="number" prefix="GHS" step={0.01} />
              <FormField label="Reason" name="reason" type="select" options={[
                { label: 'Rebalancing', value: 'rebalance' }, { label: 'Customer Request', value: 'customer' },
                { label: 'Low Stock at Destination', value: 'low-stock' }, { label: 'Consolidation', value: 'consolidation' },
              ]} />
              <FormField label="Authorized By" name="authorizedBy" required />
            </div>
            <input type="hidden" name="categories" value={transferCats.join(', ')} />
            <input type="hidden" name="subCategories" value={transferSubCats.join(', ')} />
          </FormSection>
        )}

        {activeForm === 'dead-stock' && (
          <FormSection title="Dead Stock Review" description="Flag and review dead stock items">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
              <FormField label="Review Date" name="date" type="date" required />
              <FormField label="SKU Code" name="sku" required />
              <FormField label="Product Description" name="description" required />
              <FormField label="Category" name="category" type="select" required options={CATEGORIES} />
              <FormField label="Current Stock" name="currentStock" type="number" required />
              <FormField label="Stock Value" name="stockValue" type="number" prefix="GHS" required step={0.01} />
              <FormField label="Days in Stock" name="daysInStock" type="number" required />
              <FormField label="Store Location" name="store" type="select" options={org.stores} />
              <FormField label="Recommended Action" name="action" type="select" required options={[
                { label: 'Markdown 20%', value: 'markdown-20' }, { label: 'Markdown 40%', value: 'markdown-40' },
                { label: 'Markdown 60%', value: 'markdown-60' }, { label: 'Transfer to Outlet', value: 'outlet' },
                { label: 'Donate', value: 'donate' }, { label: 'Write Off', value: 'write-off' },
              ]} />
              <FormField label="Justification" name="justification" type="textarea" placeholder="Why this action?" />
            </div>
          </FormSection>
        )}

        {activeForm === 'replenishment' && (
          <FormSection title="Replenishment Request" description="Request stock replenishment">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
              <FormField label="Request Date" name="date" type="date" required />
              <FormField label="Store" name="store" type="select" required options={org.stores} />
              <FormField label="SKU Code" name="sku" />
              <FormField label="Product Description" name="description" required />
              <FormField label="Category" name="category" type="select" required options={CATEGORIES} />
              <FormField label="Current Stock" name="currentStock" type="number" required />
              <FormField label="Reorder Quantity" name="reorderQty" type="number" required />
              <FormField label="Urgency" name="urgency" type="select" required options={[
                { label: 'Critical - Out of Stock', value: 'critical' }, { label: 'High - Below Min', value: 'high' },
                { label: 'Medium - Low Stock', value: 'medium' }, { label: 'Low - Planned Reorder', value: 'low' },
              ]} />
              <FormField label="Preferred Supplier" name="supplier" />
              <FormField label="Notes" name="notes" type="textarea" placeholder="Size/color breakdown, special requirements" />
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
        <RecentEntries department="inventory" />
      </div>
    </div>
  );
}
