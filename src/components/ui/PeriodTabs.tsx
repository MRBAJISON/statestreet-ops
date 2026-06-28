'use client';

import type { Period } from '@/lib/api';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'day', label: 'Date' },
  { value: 'week', label: 'Week' },
  { value: 'mtd', label: 'Month' },
  { value: 'ytd', label: 'Year' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom Date' },
];

interface StoreOption {
  label: string;
  value: string;
}

interface Props {
  value: Period;
  date: string;
  onChange: (p: Period) => void;
  onDateChange: (d: string) => void;
  // Optional store filter (only shown on store-scoped dashboards).
  store?: string;
  stores?: StoreOption[];
  onStoreChange?: (s: string) => void;
}

const selectClass =
  'bg-[var(--c-card2)] border border-[var(--c-border)] text-xs text-[var(--c-fg)] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#c8a951]';

// Filter bar: period dropdown + calendar date picker + optional store dropdown.
export default function PeriodTabs({ value, date, onChange, onDateChange, store, stores, onStoreChange }: Props) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {onStoreChange && stores && (
        <select value={store ?? ''} onChange={(e) => onStoreChange(e.target.value)} className={selectClass} aria-label="Store">
          <option value="">All Stores</option>
          {stores.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      )}

      <select value={value} onChange={(e) => onChange(e.target.value as Period)} className={selectClass} aria-label="Period">
        {PERIOD_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {/* Custom range: two date pickers, encoded as "from~to" through the date prop. */}
      {value === 'custom' ? (
        (() => {
          const [from = '', to = ''] = (date || '').split('~');
          return (
            <span className="flex items-center gap-1">
              <input type="date" value={from} onChange={(e) => onDateChange(`${e.target.value}~${to}`)} className={selectClass} aria-label="Start date" />
              <span className="text-gray-500 text-xs">to</span>
              <input type="date" value={to} onChange={(e) => onDateChange(`${from}~${e.target.value}`)} className={selectClass} aria-label="End date" />
            </span>
          );
        })()
      ) : value !== 'all' && (
        <input
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          className={selectClass}
          aria-label="Anchor date"
        />
      )}
    </div>
  );
}
