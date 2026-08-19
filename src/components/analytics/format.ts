export function formatCurrency(value: number, currency = 'GHS', compact = true) {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
    notation: compact && Math.abs(value) >= 100_000 ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : 2,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatNumber(value: number, compact = false) {
  return new Intl.NumberFormat('en-GH', {
    notation: compact && Math.abs(value) >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatPercent(value: number, digits = 1) {
  return `${Number.isFinite(value) ? value.toFixed(digits) : '0.0'}%`;
}

/**
 * Sell-through, shown only where there is an opening stock figure to divide by.
 *
 * Without stock loaded for a store, units sold over nothing is not zero percent —
 * it is unknown, and printing 0.0% invites someone to act on a number nobody
 * measured. A dash says so plainly.
 */
export function formatSellThrough(value: number, openingStock: number) {
  if (!openingStock || !Number.isFinite(value)) return '—';
  return formatPercent(value);
}

export function percentageChange(current: number, previous: number) {
  if (!previous) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(
    new Date(`${value}T00:00:00`)
  );
}

export function titleCase(value: string) {
  return value.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function truncateLabel(value: string, maxLength = 12) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}
