'use client';

import { useState } from 'react';
import FormField from '@/components/forms/FormField';
import FormSection from '@/components/forms/FormSection';
import RecentEntries from '@/components/ui/RecentEntries';
import { submitEntry } from '@/lib/api';

const STORES = [
  { label: 'Dzorwulu Men', value: 'dzorwulu-men' }, { label: 'East Legon Men', value: 'east-legon-men' },
  { label: 'Labone Men', value: 'labone-men' }, { label: 'Boulevard Women Labone', value: 'bw-labone' },
  { label: 'Boulevard Women Dzorwulu', value: 'bw-dzorwulu' }, { label: "D'Angelo Palace", value: 'dangelo' },
  { label: 'Woodpeckers', value: 'woodpeckers' },
];

const CATEGORIES = [
  { label: 'Suits', value: 'suits' }, { label: 'Shoes', value: 'shoes' },
  { label: 'Shirts', value: 'shirts' }, { label: 'Blazers', value: 'blazers' },
  { label: 'Bags', value: 'bags' }, { label: 'Denim & Casual', value: 'denim' },
  { label: 'Accessories', value: 'accessories' }, { label: 'Others', value: 'others' },
];

export default function InventoryFormsPage() {
  const [activeForm, setActiveForm] = useState('stock-count');
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState('');

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
    try {
      await submitEntry('inventory', activeForm, form);
      setMessage('Saved to the live database. The dashboard reflects it now.');
      form.reset();
    } catch (err) {
      setMessage('Could not save: ' + (err as Error).message);
    }
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 4000);
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Inventory Data Entry</h1>
        <p className="text-sm text-gray-500 mt-1">Enter inventory data to update the Inventory Command Center dashboard</p>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {forms.map(f => (
          <button key={f.id} onClick={() => setActiveForm(f.id)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${activeForm === f.id ? 'bg-[#c8a951] text-black font-semibold' : 'bg-[#111] border border-[#2a2a2a] text-gray-400 hover:text-white'}`}>
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
          <FormSection title="Physical Stock Count" description="Record stock count results per store">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
              <FormField label="Count Date" name="date" type="date" required />
              <FormField label="Store" name="store" type="select" required options={STORES} />
              <FormField label="Category" name="category" type="select" required options={CATEGORIES} />
              <FormField label="SKU Code" name="sku" required placeholder="e.g. ARB-101-BLK-42" />
              <FormField label="System Quantity" name="systemQty" type="number" required />
              <FormField label="Physical Count" name="physicalQty" type="number" required />
              <FormField label="Variance" name="variance" type="number" />
              <FormField label="Unit Value" name="unitValue" type="number" prefix="GHS" step={0.01} />
              <FormField label="Counted By" name="countedBy" required />
              <FormField label="Notes" name="notes" type="textarea" placeholder="Variance explanation" />
            </div>
          </FormSection>
        )}

        {activeForm === 'goods-receipt' && (
          <FormSection title="Goods Received Note" description="Record incoming inventory">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
              <FormField label="Receipt Date" name="date" type="date" required />
              <FormField label="PO Number" name="poNumber" required placeholder="PO-XXXX" />
              <FormField label="Supplier" name="supplier" required />
              <FormField label="Brand" name="brand" type="select" options={[
                { label: 'Arbiter', value: 'arbiter' }, { label: 'Gianfranco Butteri', value: 'butteri' },
                { label: 'Oliver Scotts', value: 'oliver-scotts' }, { label: 'Gianni Gallucci', value: 'gallucci' },
                { label: 'Cucinera Fiorentina', value: 'cucinera' }, { label: 'Zecca Milano', value: 'zecca' },
              ]} />
              <FormField label="Category" name="category" type="select" required options={CATEGORIES} />
              <FormField label="Total Units Received" name="units" type="number" required />
              <FormField label="Total Value" name="totalValue" type="number" prefix="GHS" required step={0.01} />
              <FormField label="Receiving Store" name="store" type="select" required options={[
                { label: 'Main Warehouse', value: 'warehouse' },
                ...STORES,
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
              <FormField label="From Store" name="fromStore" type="select" required options={[{ label: 'Main Warehouse', value: 'warehouse' }, ...STORES]} />
              <FormField label="To Store" name="toStore" type="select" required options={STORES} />
              <FormField label="SKU Code" name="sku" required placeholder="e.g. ARB-101-BLK-42" />
              <FormField label="Product Description" name="description" required />
              <FormField label="Quantity" name="qty" type="number" required />
              <FormField label="Unit Value" name="unitValue" type="number" prefix="GHS" step={0.01} />
              <FormField label="Reason" name="reason" type="select" options={[
                { label: 'Rebalancing', value: 'rebalance' }, { label: 'Customer Request', value: 'customer' },
                { label: 'Low Stock at Destination', value: 'low-stock' }, { label: 'Consolidation', value: 'consolidation' },
              ]} />
              <FormField label="Authorized By" name="authorizedBy" required />
            </div>
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
              <FormField label="Store Location" name="store" type="select" options={STORES} />
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
              <FormField label="Store" name="store" type="select" required options={STORES} />
              <FormField label="SKU Code" name="sku" required />
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
          <button type="submit" className="bg-[#c8a951] hover:bg-[#d4bf7a] text-black font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm">Submit Entry</button>
          <button type="reset" className="bg-[#1a1a1a] border border-[#333] text-gray-400 hover:text-white px-6 py-2.5 rounded-lg transition-colors text-sm">Clear Form</button>
        </div>
      </form>

      <div className="mt-8 max-w-4xl">
        <h2 className="text-sm font-bold uppercase tracking-wide mb-3">Your Submissions</h2>
        <RecentEntries department="inventory" />
      </div>
    </div>
  );
}
