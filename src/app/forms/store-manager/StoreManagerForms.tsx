'use client';

import { useMemo } from 'react';
import { useEntries } from '@/lib/api';
import RecentEntries from '@/components/ui/RecentEntries';
import DailySales from './DailySales';
import StockTransfer from './StockTransfer';
import WeeklyReview, { type DailySale, type WeekTarget } from './WeeklyReview';

export default function StoreManagerForms({ managerName, assignedStore }: { managerName: string; assignedStore: string }) {
  const { entries: finEntries, refresh } = useEntries('finance', 5000);
  const { entries: comEntries } = useEntries('commercial', 5000);
  const { entries: invEntries, refresh: refreshInv } = useEntries('inventory', 5000);
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
    })),
    [myDaily]
  );
  const targets: WeekTarget[] = useMemo(
    () => comEntries
      .filter((e) => e.formType === 'weekly-target' && String(e.payload.store) === assignedStore)
      .map((e) => ({ weekEnd: String(e.payload.weekEnd || ''), target: Number(e.payload.target) || 0 })),
    [comEntries, assignedStore]
  );

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-xl font-bold">Store Manager Weekly Review</h1>
        <p className="text-sm text-gray-500 mt-1">Log daily sales, then complete the weekly review. Results feed the Commercial and Executive dashboards.</p>
      </div>

      <DailySales assignedStore={assignedStore} recent={myDaily} onSaved={refresh} />

      <StockTransfer assignedStore={assignedStore} managerName={managerName} recent={myTransfers} onSaved={refreshInv} />

      <WeeklyReview assignedStore={assignedStore} managerName={managerName} dailySales={dailySales} targets={targets} />

      <div className="max-w-4xl">
        <h2 className="text-sm font-bold uppercase tracking-wide mb-3">Your Submissions</h2>
        <RecentEntries department="commercial" />
      </div>
    </div>
  );
}
