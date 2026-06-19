'use client';

import { useState } from 'react';
import FormField from '@/components/forms/FormField';
import FormSection from '@/components/forms/FormSection';
import { postEntry, type EntryRow } from '@/lib/api';
import { Spinner } from '@/components/ui/BrandedLoader';
import { STORE_LABELS, labelFor } from '@/lib/config';
import MultiSelectDropdown from '@/components/forms/MultiSelectDropdown';
import { useOrg } from '@/components/providers/OrgProvider';
import { transferTargets, categoriesForStore } from '@/lib/org';

// Store-to-store stock transfer. Saved as inventory/store-transfer (kept separate
// from the Inventory team's stock-transfer stream). Transfers are restricted to
// stores of the same brand; Head Office reaches all stores; single-store brands
// get no transfer option.
export default function StockTransfer({ assignedStore, managerName, recent, onSaved }: { assignedStore: string; managerName: string; recent: EntryRow[]; onSaved: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const { org } = useOrg();
  const toStores = transferTargets(org, assignedStore);
  const canTransfer = toStores.length > 0;
  const catOptions = categoriesForStore(org, assignedStore);
  const [cats, setCats] = useState<string[]>([]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const payload: Record<string, unknown> = {};
    fd.forEach((v, k) => { payload[k] = typeof v === 'string' ? v : ''; });
    payload.fromStore = assignedStore;
    payload.authorizedBy = managerName;
    payload.categories = cats.join(', ');
    setSubmitting(true);
    try {
      await postEntry('inventory', 'store-transfer', payload);
      setMsg({ ok: true, text: 'Stock transfer recorded.' });
      form.reset();
      setCats([]);
      onSaved();
    } catch (err) {
      setMsg({ ok: false, text: 'Could not save: ' + (err as Error).message });
    }
    setSubmitting(false);
    setTimeout(() => setMsg(null), 4000);
  }

  const recentSorted = [...recent].sort((a, b) => (String(a.payload.date) < String(b.payload.date) ? 1 : -1)).slice(0, 8);

  return (
    <FormSection title="Stock Transfer" description="Move stock from your store to another store.">
      {msg && (
        <div className={`mb-3 text-sm p-3 rounded-lg border ${msg.ok ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>{msg.text}</div>
      )}
      {canTransfer ? (
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-1">
          <FormField label="Date" name="date" type="date" required />
          <div>
            <label className="block text-xs text-gray-400 mb-1">From Store</label>
            <div className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-lg px-3 py-2 text-sm text-[var(--c-fg)] opacity-70 cursor-not-allowed">
              {labelFor(STORE_LABELS, assignedStore)}
            </div>
          </div>
          <FormField label="To Store" name="toStore" type="select" required options={toStores} />
          <FormField label="SKU / Item" name="sku" required placeholder="e.g. ARB-101-BLK-42" />
          <MultiSelectDropdown label="Categories" options={catOptions} value={cats} onChange={setCats} />
          <FormField label="Description" name="description" placeholder="Product description" />
          <FormField label="Units" name="units" type="number" required min={1} />
          <FormField label="Reason" name="reason" type="select" options={[
            { label: 'Rebalancing', value: 'rebalance' }, { label: 'Customer Request', value: 'customer' },
            { label: 'Low Stock at Destination', value: 'low-stock' }, { label: 'Consolidation', value: 'consolidation' },
          ]} />
        </div>
        <button type="submit" disabled={submitting}
          className="mt-3 bg-[#c8a951] hover:bg-[#d4bf7a] text-black font-semibold px-6 py-2.5 rounded-lg text-sm disabled:opacity-50">
          {submitting ? <><Spinner /> Saving…</> : 'Record Transfer'}
        </button>
      </form>
      ) : (
        <div className="mt-1 text-sm p-4 rounded-lg border border-[var(--c-border)] bg-[var(--c-card2)] text-gray-400">
          Stock transfer isn’t available for your store — it’s the only store in its brand. Inter-store transfers run between shops of the same brand; please contact Head Office to move stock.
        </div>
      )}

      {recentSorted.length > 0 && (
        <div className="mt-4">
          <div className="text-xs text-gray-400 mb-2">Recent transfers from your store</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--c-border)] text-gray-500">
                  <th className="text-left py-2 pr-3 font-medium">Date</th>
                  <th className="text-left py-2 pr-3 font-medium">To</th>
                  <th className="text-left py-2 pr-3 font-medium">Item</th>
                  <th className="text-right py-2 font-medium">Units</th>
                </tr>
              </thead>
              <tbody>
                {recentSorted.map((e) => (
                  <tr key={e.id} className="border-b border-[var(--c-hover)]">
                    <td className="py-2 pr-3 whitespace-nowrap">{String(e.payload.date || '—')}</td>
                    <td className="py-2 pr-3">{labelFor(STORE_LABELS, e.payload.toStore)}</td>
                    <td className="py-2 pr-3">{String(e.payload.sku || e.payload.description || '—')}</td>
                    <td className="py-2 text-right">{String(e.payload.units || '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </FormSection>
  );
}
