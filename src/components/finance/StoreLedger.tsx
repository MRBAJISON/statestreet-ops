'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { STORE_LABELS, CATEGORY_LABELS, labelFor } from '@/lib/config';

interface EntryRow { id: number; payload: Record<string, unknown>; createdAt: string }
interface AuditRow { id: number; entryId: number; action: string; userName: string | null; changes: Record<string, unknown> | null; createdAt: string }

const fmtGHS = (n: number) => `GHS ${Math.round(n).toLocaleString()}`;
const when = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? '' : d.toLocaleString(); };

// Finance oversight: all stores' daily sales with a per-entry activity trail.
export default function StoreLedger() {
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [eRes, aRes] = await Promise.all([
        fetch('/api/entries?department=finance', { cache: 'no-store' }),
        fetch('/api/audit', { cache: 'no-store' }),
      ]);
      const eJson = await eRes.json();
      const aJson = await aRes.json().catch(() => ({ audit: [] }));
      const daily = (Array.isArray(eJson.entries) ? eJson.entries : []).filter((e: { formType: string }) => e.formType === 'revenue');
      setEntries(daily);
      setAudit(Array.isArray(aJson.audit) ? aJson.audit : []);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const trailFor = (entryId: number) => audit.filter((a) => a.entryId === entryId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const enteredBy = (entryId: number) => trailFor(entryId).find((a) => a.action === 'create')?.userName ?? '—';

  if (loading) return <div className="text-xs text-gray-600 py-4">Loading ledger…</div>;
  if (!entries.length) return <div className="text-sm text-gray-500 py-6">No daily sales recorded yet.</div>;

  const sorted = [...entries].sort((a, b) => (String(a.payload.date) < String(b.payload.date) ? 1 : -1)).slice(0, 50);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[var(--c-border)] text-gray-500">
            <th className="text-left py-2 pr-3 font-medium">Date</th>
            <th className="text-left py-2 pr-3 font-medium">Store</th>
            <th className="text-left py-2 pr-3 font-medium">Category</th>
            <th className="text-right py-2 px-3 font-medium">Gross</th>
            <th className="text-left py-2 px-3 font-medium">Entered by</th>
            <th className="text-right py-2 font-medium">Trail</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((e) => {
            const trail = trailFor(e.id);
            return (
              <Fragment key={e.id}>
                <tr className="border-b border-[var(--c-hover)]">
                  <td className="py-2 pr-3 whitespace-nowrap">{String(e.payload.date || '—')}</td>
                  <td className="py-2 pr-3">{labelFor(STORE_LABELS, e.payload.store)}</td>
                  <td className="py-2 pr-3">{labelFor(CATEGORY_LABELS, e.payload.category)}</td>
                  <td className="py-2 px-3 text-right">{fmtGHS(Number(e.payload.grossRevenue) || 0)}</td>
                  <td className="py-2 px-3">{enteredBy(e.id)}</td>
                  <td className="py-2 text-right">
                    <button onClick={() => setOpen(open === e.id ? null : e.id)} className="text-gray-400 hover:text-[#c8a951]">
                      {open === e.id ? 'Hide' : `${trail.length} event${trail.length === 1 ? '' : 's'}`}
                    </button>
                  </td>
                </tr>
                {open === e.id && (
                  <tr className="bg-[var(--c-card2)]">
                    <td colSpan={6} className="py-2 px-3">
                      {trail.length ? (
                        <div className="space-y-1">
                          {trail.map((a) => (
                            <div key={a.id} className="text-[0.7rem] text-gray-400">
                              <span className="text-[#c8a951] uppercase">{a.action}</span>
                              {a.userName ? ` by ${a.userName}` : ''} · {when(a.createdAt)}
                              {a.changes && (a.changes as Record<string, unknown>).fields ? (
                                <span className="text-gray-500"> · {Object.entries((a.changes as { fields: Record<string, { from: unknown; to: unknown }> }).fields).map(([k, v]) => `${k}: ${String(v.from ?? '—')}→${String(v.to ?? '—')}`).join(', ')}</span>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[0.7rem] text-gray-600">No activity recorded (entry predates the audit trail).</div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
