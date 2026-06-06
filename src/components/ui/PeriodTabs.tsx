'use client';

import type { Period } from '@/lib/api';

const OPTIONS: { value: Period; label: string }[] = [
  { value: 'mtd', label: 'Month' },
  { value: 'ytd', label: 'Year' },
  { value: 'all', label: 'All time' },
];

// Reporting-period selector used in dashboard headers.
export default function PeriodTabs({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-0.5">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1 text-xs rounded-md transition-colors ${
            value === o.value ? 'bg-[#c8a951] text-black font-semibold' : 'text-gray-400 hover:text-white'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
