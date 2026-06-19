'use client';

import { useMemo, useState } from 'react';
import { useEntries } from '@/lib/api';
import RecentEntries from '@/components/ui/RecentEntries';
import DailySales from './DailySales';
import StockTransfer from './StockTransfer';
import CustomerCapture from './CustomerCapture';
import WeeklyReview, { type DailySale, type WeekTarget } from './WeeklyReview';

const FORMS = [
  { id: 'daily-sales', label: 'Daily Sales' },
  { id: 'stock-transfer', label: 'Stock Transfer' },
  { id: 'customer-capture', label: 'Customer Capture' },
  { id: 'weekly-review', label: 'Weekly Review' },
];

export default function StoreManagerForms({ managerName, assignedStore }: { managerName: string; assignedStore: string }) {
  const { entries: finEntries, refresh } = useEntries('finance', 5000);
  const { entries: comEntries, refresh: refreshCom } = useEntries('commercial', 5000);
  const { entries: invEntries, refresh: refreshInv } = useEntries('inventory', 5000);
  const myCaptures = useMemo(
    () => comEntries.filter((e) => e.formType === 'customer-capture' && String(e.payload.store) === assignedStore),
    [comEntries, assignedStore]
  );
  const myTransfers = useMemo(
    () => invEntries.filter((e) => e.formType === 'store-transfer' && String(e.payload.fromStore) === assignedStore),
    [invEntries, assignedStore]
  );

  // This store's daily sales (finance/revenue) and weekly targets (commercial/weekly-target).
  const myDaily = useMemo(
    () => finEntries.filter((e) => e.formType === 'revenue' && String(e.payload.store) === assignedStore),
    [finEntries, assignedStore]
  );
  const dailySales: DailySale[] = useMemo(
    () => myDaily.map((e) => ({
      date: String(e.payload.date || ''),
      category: String(e.payload.category || ''),
      grossRevenue: Number(e.payload.grossRevenue) || 0,
      itemsSold: Number(e.payload.itemsSold) || 0,
      store: String(e.payload.store || ''),
    })),
    [myDaily]
  );
  const targets: WeekTarget[] = useMemo(
    () => comEntries
      .filter((e) => e.formType === 'weekly-target' && String(e.payload.store) === assignedStore)
      .map((e) => ({ weekEnd: String(e.payload.weekEnd || ''), target: Number(e.payload.target) || 0, store: assignedStore })),
    [comEntries, assignedStore]
  );

  const [activeForm, setActiveForm] = useState('daily-sales');

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Stores Data Entry</h1>
        <p className="text-sm text-gray-500 mt-1">Log daily sales and transfers, then complete the weekly review. Results feed the Commercial and Executive dashboards.</p>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {FORMS.map((f) => (
          <button key={f.id} onClick={() => setActiveForm(f.id)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${activeForm === f.id ? 'bg-[#c8a951] text-black font-semibold' : 'bg-[var(--c-card)] border border-[var(--c-border)] text-gray-400 hover:text-[var(--c-fg)]'}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="max-w-4xl space-y-8">
        {activeForm === 'daily-sales' && (
          <DailySales assignedStore={assignedStore} recent={myDaily} onSaved={refresh} />
        )}

        {activeForm === 'stock-transfer' && (
          <StockTransfer assignedStore={assignedStore} managerName={managerName} recent={myTransfers} onSaved={refreshInv} />
        )}

        {activeForm === 'customer-capture' && (
          <CustomerCapture assignedStore={assignedStore} managerName={managerName} recent={myCaptures} onSaved={refreshCom} />
        )}

        {activeForm === 'weekly-review' && (
          <WeeklyReview assignedStore={assignedStore} managerName={managerName} dailySales={dailySales} targets={targets} />
        )}

        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide mb-3">Your Submissions</h2>
          <RecentEntries department="commercial" />
        </div>
      </div>
    </div>
  );
}
