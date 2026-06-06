'use client';

import { useEntries } from '@/lib/api';
import EmptyState from './EmptyState';

function summarize(payload: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(payload)) {
    if (v === '' || v === null || v === undefined) continue;
    parts.push(`${k}: ${v}`);
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

// Live feed of the latest submissions for a department.
export default function RecentEntries({ department }: { department: string }) {
  const { entries, loading } = useEntries(department, 8);

  if (loading) return <div className="text-xs text-gray-600 py-4">Loading…</div>;
  if (!entries.length)
    return (
      <EmptyState message="No submissions yet" hint="Entries from the forms appear here as they are saved." height={120} />
    );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[#2a2a2a] text-gray-500">
            <th className="text-left py-2 pr-3 font-medium">Form</th>
            <th className="text-left py-2 pr-3 font-medium">Details</th>
            <th className="text-right py-2 font-medium whitespace-nowrap">When</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-b border-[#1a1a1a]">
              <td className="py-2 pr-3 capitalize text-[#c8a951] whitespace-nowrap">
                {e.formType.replace(/-/g, ' ')}
              </td>
              <td className="py-2 pr-3 text-gray-300">{summarize(e.payload)}</td>
              <td className="py-2 text-right text-gray-500 whitespace-nowrap">{timeAgo(e.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
