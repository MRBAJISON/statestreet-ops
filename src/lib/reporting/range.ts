import type { AnalyticsPreset, AnalyticsQuery } from '../contracts/analytics';
import type { AnalyticsRange } from './shared';

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function shiftDays(value: Date, days: number): Date {
  const shifted = new Date(value);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted;
}

function startForPreset(preset: Exclude<AnalyticsPreset, 'custom'>, to: Date): Date {
  if (preset === '7d') return shiftDays(to, -6);
  if (preset === '30d') return shiftDays(to, -29);
  if (preset === '90d') return shiftDays(to, -89);
  if (preset === 'mtd') return new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  if (preset === 'qtd') {
    return new Date(Date.UTC(to.getUTCFullYear(), Math.floor(to.getUTCMonth() / 3) * 3, 1));
  }
  return new Date(Date.UTC(to.getUTCFullYear(), 0, 1));
}

export function resolveAnalyticsRange(query: AnalyticsQuery, now = new Date()): AnalyticsRange {
  const toDate = query.to
    ? parseDate(query.to)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const fromDate = query.preset === 'custom'
    ? parseDate(query.from as string)
    : startForPreset(query.preset, toDate);
  const durationDays = Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1;
  const compareTo = shiftDays(fromDate, -1);
  const compareFrom = shiftDays(compareTo, -(durationDays - 1));
  return {
    preset: query.preset,
    from: isoDate(fromDate),
    to: isoDate(toDate),
    compareFrom: isoDate(compareFrom),
    compareTo: isoDate(compareTo),
  };
}
