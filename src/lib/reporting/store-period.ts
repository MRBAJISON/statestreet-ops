// Pure period arithmetic for store reports, kept free of database imports so the
// boundaries can be tested on their own (same split as range.ts).
//
// A store's trading week runs Monday to Saturday; Sunday is closed and belongs to
// the week that just ended. A month is the calendar month, counting only its
// trading days.

export type StorePeriodType = 'week' | 'month';

export interface StorePeriodRange {
  from: string;
  to: string;
  label: string;
}

const SUNDAY = 0;
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toUtc(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function isoOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shiftDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatDay(iso: string): string {
  const date = toUtc(iso);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()].slice(0, 3)}`;
}

/** Monday of the trading week containing the date; a Sunday looks back to its own Monday. */
function mondayOf(date: Date): Date {
  const offset = (date.getUTCDay() + 6) % 7;
  return shiftDays(date, -offset);
}

function weekRange(monday: Date): StorePeriodRange {
  const saturday = shiftDays(monday, 5);
  const from = isoOf(monday);
  const to = isoOf(saturday);
  // Plain ASCII hyphen: the PDF renderer silently drops an en dash from the standard
  // Helvetica face, which would leave the range reading "20 Jul  25 Jul".
  return { from, to, label: `${formatDay(from)} - ${formatDay(to)} ${saturday.getUTCFullYear()}` };
}

function monthRange(anchor: Date): StorePeriodRange {
  const first = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
  const last = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0));
  return {
    from: isoOf(first),
    to: isoOf(last),
    label: `${MONTHS[first.getUTCMonth()]} ${first.getUTCFullYear()}`,
  };
}

/** Resolve the period containing an anchor date, plus the period immediately before it. */
export function resolveStorePeriod(
  periodType: StorePeriodType,
  anchorIso: string
): { range: StorePeriodRange; previousRange: StorePeriodRange } {
  const anchor = toUtc(anchorIso);
  if (periodType === 'week') {
    const monday = mondayOf(anchor);
    return { range: weekRange(monday), previousRange: weekRange(shiftDays(monday, -7)) };
  }
  const previousAnchor = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - 1, 1));
  return { range: monthRange(anchor), previousRange: monthRange(previousAnchor) };
}

/** Every trading day (Mon-Sat) in an inclusive range. */
export function tradingDaysBetween(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = toUtc(from); isoOf(day) <= to; day = shiftDays(day, 1)) {
    if (day.getUTCDay() !== SUNDAY) days.push(isoOf(day));
  }
  return days;
}
