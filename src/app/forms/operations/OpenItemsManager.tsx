'use client';

import { useState } from 'react';
import { useEntries, updateEntry, type EntryRow } from '@/lib/api';
import { STORE_LABELS, labelFor } from '@/lib/config';
import { ShowMoreRows } from '@/components/ui/ShowMore';

const INCIDENT_STATUS = [
  { label: 'Open', value: 'open' }, { label: 'Investigating', value: 'investigating' },
  { label: 'Resolved', value: 'resolved' }, { label: 'Closed', value: 'closed' },
];
const MAINT_STATUS = [
  { label: 'Open', value: 'open' }, { label: 'In Progress', value: 'in-progress' },
  { label: 'Completed', value: 'completed' }, { label: 'Overdue', value: 'overdue' },
];

// Manage the lifecycle of incidents & maintenance in place: change the status on the
// SAME record instead of logging a new one each time the stage changes.
export default function OpenItemsManager() {
  const { entries, refresh } = useEntries('operations', 5000);
  const [busyId, setBusyId] = useState<number | null>(null);

  const items = entries
    .filter((e) => e.formType === 'incident' || e.formType === 'maintenance')
    .sort((a, b) => (String(a.payload.datetime || a.payload.date || '') < String(b.payload.datetime || b.payload.date || '') ? 1 : -1))
    .slice(0, 40);

  async function setStatus(e: EntryRow, status: string) {
    setBusyId(e.id);
    try {
      await updateEntry(e.id, { ...e.payload, status });
      refresh();
    } finally {
      setBusyId(null);
    }
  }

  if (!items.length) return null;
  const done = (s: string) => /resolv|close|complete|done/i.test(s);

  return (
    <div className="mt-8 max-w-4xl">
      <h2 className="text-sm font-bold uppercase tracking-wide mb-1">Manage Incidents &amp; Maintenance</h2>
      <p className="text-xs text-gray-500 mb-3">Change an item’s status on the same record — no need to log a new one when it’s resolved or completed.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[var(--c-border)] text-gray-500">
              <th className="text-left py-2 pr-3 font-medium">Type</th>
              <th className="text-left py-2 pr-3 font-medium">Item</th>
              <th className="text-left py-2 pr-3 font-medium">Store</th>
              <th className="text-left py-2 pr-3 font-medium">Date</th>
              <th className="text-right py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            <ShowMoreRows items={items} limit={7} colSpan={5}>
              {(e) => {
              const p = e.payload;
              const opts = e.formType === 'incident' ? INCIDENT_STATUS : MAINT_STATUS;
              const status = String(p.status || 'open');
              return (
                <tr key={e.id} className="border-b border-[var(--c-hover)]">
                  <td className="py-2 pr-3 capitalize whitespace-nowrap text-[#c8a951]">{e.formType}</td>
                  <td className="py-2 pr-3 max-w-[18rem] truncate" title={String(p.description || p.type || p.category || '')}>{String(p.description || p.type || p.category || '—')}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{labelFor(STORE_LABELS, p.store)}</td>
                  <td className="py-2 pr-3 whitespace-nowrap text-gray-500">{String(p.datetime || p.date || '—').slice(0, 10)}</td>
                  <td className="py-2 text-right">
                    <select
                      value={status}
                      disabled={busyId === e.id}
                      onChange={(ev) => setStatus(e, ev.target.value)}
                      className={`bg-[var(--c-hover)] border rounded px-2 py-1 text-xs ${done(status) ? 'border-green-500/40 text-green-400' : 'border-[var(--c-border2)] text-[var(--c-fg)]'} disabled:opacity-50`}
                    >
                      {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </td>
                </tr>
              );
            }}
            </ShowMoreRows>
          </tbody>
        </table>
      </div>
    </div>
  );
}
