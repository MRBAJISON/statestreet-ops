'use client';

import type { Period } from '@/lib/api';

const OPTIONS: { value: Period; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'mtd', label: 'Month' },
  { value: 'ytd', label: 'Year' },
  { value: 'all', label: 'All' },
];

interface Props {
  value: Period;
  date: string;
  onChange: (p: Period) => void;
  onDateChange: (d: string) => void;
}

// Reporting-period selector. Day/Week reveal a date picker that anchors the range.
export default function PeriodTabs({ value, date, onChange, onDateChange }: Props) {
  return (
    <div className="flex items-center gap-2">
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
      {(value === 'day' || value === 'week') && (
        <input
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          className="bg-[#0d0d0d] border border-[#2a2a2a] text-xs text-white rounded-lg px-2 py-1"
        />
      )}
    </div>
  );
}
