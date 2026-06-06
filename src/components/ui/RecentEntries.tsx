'use client';

import { useState } from 'react';
import { useEntries, deleteEntry, updateEntry, type EntryRow } from '@/lib/api';
import EmptyState from './EmptyState';

const labelize = (k: string) =>
  k.replace(/([A-Z])/g, ' $1').replace(/[-_]/g, ' ').replace(/^./, (c) => c.toUpperCase()).trim();

function summarize(payload: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(payload)) {
    if (v === '' || v === null || v === undefined) continue;
    parts.push(`${labelize(k)}: ${v}`);
    if (parts.length >= 4) break;
  }
  return parts.join('  ·  ') || '—';
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return '';
  const diff = Math.max(0, Date.now() - then);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function EditRow({ entry, onDone }: { entry: EntryRow; onDone: () => void }) {
  const [draft, setDraft] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(entry.payload).map(([k, v]) => [k, String(v ?? '')]))
  );
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await updateEntry(entry.id, draft);
      onDone();
    } catch {
      setBusy(false);
    }
  };

  return (
    <tr className="border-b border-[#1a1a1a] bg-[#0d0d0d]">
      <td colSpan={4} className="py-3 px-3">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-2">
          {Object.keys(draft).map((k) => (
            <label key={k} className="text-[0.65rem] text-gray-400">
              {labelize(k)}
              <input
                value={draft[k]}
                onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
                className="w-full mt-0.5 bg-[#111] border border-[#2a2a2a] rounded px-2 py-1 text-xs text-white"
              />
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={save} disabled={busy} className="bg-[#c8a951] text-black text-xs font-semibold px-3 py-1 rounded disabled:opacity-50">
            {busy ? 'Saving…' : 'Save'}
          </button>
          <button onClick={onDone} className="text-xs text-gray-400 px-3 py-1">Cancel</button>
        </div>
      </td>
    </tr>
  );
}

// Live feed of the latest submissions for a department, with inline edit + delete.
export default function RecentEntries({ department }: { department: string }) {
  const { entries, loading, refresh } = useEntries(department, 8);
  const [editing, setEditing] = useState<number | null>(null);

  if (loading) return <div className="text-xs text-gray-600 py-4">Loading…</div>;
  if (!entries.length)
    return (
      <EmptyState message="No submissions yet" hint="Entries from the forms appear here as they are saved." height={120} />
    );

  const onDelete = async (id: number) => {
    try {
      await deleteEntry(id);
      refresh();
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[#2a2a2a] text-gray-500">
            <th className="text-left py-2 pr-3 font-medium">Form</th>
            <th className="text-left py-2 pr-3 font-medium">Details</th>
            <th className="text-right py-2 px-3 font-medium whitespace-nowrap">When</th>
            <th className="text-right py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) =>
            editing === e.id ? (
              <EditRow key={e.id} entry={e} onDone={() => { setEditing(null); refresh(); }} />
            ) : (
              <tr key={e.id} className="border-b border-[#1a1a1a]">
                <td className="py-2 pr-3 capitalize text-[#c8a951] whitespace-nowrap">{e.formType.replace(/-/g, ' ')}</td>
                <td className="py-2 pr-3 text-gray-300">{summarize(e.payload)}</td>
                <td className="py-2 px-3 text-right text-gray-500 whitespace-nowrap">{timeAgo(e.createdAt)}</td>
                <td className="py-2 text-right whitespace-nowrap">
                  <button onClick={() => setEditing(e.id)} className="text-gray-400 hover:text-[#c8a951] mr-3">Edit</button>
                  <button onClick={() => onDelete(e.id)} className="text-gray-400 hover:text-red-400">Delete</button>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}
