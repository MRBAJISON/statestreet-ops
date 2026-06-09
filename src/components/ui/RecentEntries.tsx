'use client';

import { useState } from 'react';
import { useEntries, deleteEntry, updateEntry, type EntryRow } from '@/lib/api';
import EmptyState from './EmptyState';
import Modal, { ConfirmModal } from './Modal';

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

// Live feed of the latest submissions for a department, with edit + delete via modals.
export default function RecentEntries({ department }: { department: string }) {
  const { entries, loading, refresh } = useEntries(department, 8);
  const [editing, setEditing] = useState<EntryRow | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState<EntryRow | null>(null);
  const [busy, setBusy] = useState(false);
  // Row action menu (fixed-positioned so it escapes the table's overflow clip).
  const [menu, setMenu] = useState<{ id: number; top: number; right: number } | null>(null);

  function openEdit(e: EntryRow) {
    setDraft(Object.fromEntries(Object.entries(e.payload).map(([k, v]) => [k, String(v ?? '')])));
    setEditing(e);
  }

  async function saveEdit() {
    if (!editing) return;
    setBusy(true);
    try {
      await updateEntry(editing.id, draft);
      setEditing(null);
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteEntry(deleting.id);
      setDeleting(null);
      refresh();
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="text-xs text-gray-600 py-4">Loading…</div>;
  if (!entries.length)
    return (
      <EmptyState message="No submissions yet" hint="Entries from the forms appear here as they are saved." height={120} />
    );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[var(--c-border)] text-gray-500">
            <th className="text-left py-2 pr-3 font-medium">Form</th>
            <th className="text-left py-2 pr-3 font-medium">Details</th>
            <th className="text-right py-2 px-3 font-medium whitespace-nowrap">When</th>
            <th className="text-right py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-b border-[var(--c-hover)]">
              <td className="py-2 pr-3 capitalize text-[#c8a951] whitespace-nowrap">{e.formType.replace(/-/g, ' ')}</td>
              <td className="py-2 pr-3 text-gray-300">{summarize(e.payload)}</td>
              <td className="py-2 px-3 text-right text-gray-500 whitespace-nowrap">{timeAgo(e.createdAt)}</td>
              <td className="py-2 text-right whitespace-nowrap">
                <button
                  onClick={(ev) => {
                    const r = ev.currentTarget.getBoundingClientRect();
                    setMenu(menu?.id === e.id ? null : { id: e.id, top: r.bottom + 4, right: window.innerWidth - r.right });
                  }}
                  aria-label="Entry actions"
                  className="px-2 py-1 rounded hover:bg-[var(--c-hover)] text-gray-400 hover:text-[var(--c-fg)] text-base leading-none"
                >
                  ⋯
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Row action menu (fixed; escapes table overflow clipping) */}
      {menu && (() => {
        const e = entries.find((x) => x.id === menu.id);
        if (!e) return null;
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} aria-hidden="true" />
            <div className="fixed z-50 w-32 bg-[var(--c-card)] border border-[var(--c-border)] rounded-lg shadow-xl py-1 text-left" style={{ top: menu.top, right: menu.right }}>
              <button onClick={() => { openEdit(e); setMenu(null); }} className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-[var(--c-hover)] hover:text-[#c8a951]">Edit</button>
              <button onClick={() => { setDeleting(e); setMenu(null); }} className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-[var(--c-hover)] hover:text-red-400">Delete</button>
            </div>
          </>
        );
      })()}

      {/* Edit entry modal */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Edit ${editing.formType.replace(/-/g, ' ')}` : 'Edit entry'}
        size="lg"
        footer={
          <>
            <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm rounded-lg border border-[var(--c-border)] text-gray-400 hover:text-[var(--c-fg)]">Cancel</button>
            <button onClick={saveEdit} disabled={busy} className="px-4 py-2 text-sm rounded-lg bg-[#c8a951] hover:bg-[#d4bf7a] text-black font-semibold disabled:opacity-50">
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.keys(draft).map((k) => (
            <label key={k} className="text-[0.7rem] text-gray-400">
              {labelize(k)}
              <input
                value={draft[k]}
                onChange={(ev) => setDraft({ ...draft, [k]: ev.target.value })}
                className="w-full mt-1 bg-[var(--c-hover)] border border-[var(--c-border)] rounded px-2 py-1.5 text-xs text-[var(--c-fg)]"
              />
            </label>
          ))}
        </div>
      </Modal>

      {/* Delete confirmation modal */}
      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Delete entry"
        danger
        busy={busy}
        confirmLabel="Delete entry"
        message={deleting ? <>Delete this <span className="font-semibold capitalize">{deleting.formType.replace(/-/g, ' ')}</span> entry? This cannot be undone.</> : ''}
      />
    </div>
  );
}
