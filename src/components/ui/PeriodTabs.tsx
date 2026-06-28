'use client';

import type { Period } from '@/lib/api';

// Standard periods live in the dropdown. "Custom Date" is a separate tab (below).
const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'day', label: 'Date' },
  { value: 'week', label: 'Week' },
  { value: 'mtd', label: 'Month' },
  { value: 'ytd', label: 'Year' },
  { value: 'all', label: 'All time' },
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

const tabBase = 'text-xs rounded-lg px-3 py-1.5 border transition-colors whitespace-nowrap';

// Filter bar: period dropdown + a Custom Date tab + the matching date picker(s) + optional store dropdown.
export default function PeriodTabs({ value, date, onChange, onDateChange, store, stores, onStoreChange }: Props) {
  const isCustom = value === 'custom';
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

      {/* Standard periods. Disabled (dimmed) while the Custom Date tab is active. */}
      <select
        value={isCustom ? '' : value}
        onChange={(e) => onChange(e.target.value as Period)}
        disabled={isCustom}
        className={`${selectClass} ${isCustom ? 'opacity-50' : ''}`}
        aria-label="Period"
      >
        <option value="" disabled hidden>
          Period
        </option>
        {PERIOD_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {/* Custom Date tab: toggles range mode. When active, its start/end range replaces the single anchor date. */}
      <button
        type="button"
        onClick={() => { onDateChange(''); onChange(isCustom ? 'mtd' : 'custom'); }}
        aria-pressed={isCustom}
        className={`${tabBase} ${
          isCustom
            ? 'bg-[#c8a951] border-[#c8a951] text-black font-semibold'
            : 'bg-[var(--c-card2)] border-[var(--c-border)] text-[var(--c-fg)] hover:border-[#c8a951]'
        }`}
      >
        Custom Date
      </button>

      {/* Custom range: two date pickers, encoded as "from~to" through the date prop. */}
      {isCustom ? (
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
