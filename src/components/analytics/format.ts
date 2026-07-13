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
