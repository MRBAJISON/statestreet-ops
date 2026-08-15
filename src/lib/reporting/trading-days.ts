import { sql, type SQL } from 'drizzle-orm';

// Stores trade Monday to Saturday and close on Sunday, so a Sunday can never earn
// revenue and therefore carries no target. Targets are prorated across the trading
// days of their own period rather than its calendar days: every trading day carries
// an equal share and Sundays carry zero. A GHS 320,000 July target is 320,000 / 27
// trading days, not / 31 calendar days.
//
// This lives in one place so the daily report, the dashboards and the weekly review
// cannot drift apart on what a day's target is worth.

const SUNDAY_DOW = 0;

/** Trading days (Mon-Sat) in an inclusive date range. Zero when the range is empty. */
export function tradingDayCount(start: SQL, end: SQL): SQL {
  return sql`(
    select count(*)::numeric
    from generate_series(${start}, ${end}, interval '1 day') as trading_day(date)
    where extract(dow from trading_day.date) <> ${SUNDAY_DOW}
  )`;
}

/** True when the given date is a trading day. */
export function isTradingDay(date: SQL): SQL {
  return sql`(extract(dow from ${date}) <> ${SUNDAY_DOW})`;
}

/**
 * One trading day's share of a target, i.e. the target value spread evenly across
 * the trading days of its own period. Null-safe when a period somehow holds no
 * trading day.
 */
export function targetPerTradingDay(value: SQL, periodStart: SQL, periodEnd: SQL): SQL {
  return sql`(${value} / nullif(${tradingDayCount(periodStart, periodEnd)}, 0))`;
}

/**
 * The portion of a target that falls inside a window, weighted by trading days on
 * both sides. A target spanning a month contributes only the trading days it shares
 * with the window.
 */
export function targetWithinWindow(
  value: SQL,
  periodStart: SQL,
  periodEnd: SQL,
  windowStart: SQL,
  windowEnd: SQL
): SQL {
  const overlap = tradingDayCount(
    sql`greatest(${periodStart}, ${windowStart})`,
    sql`least(${periodEnd}, ${windowEnd})`
  );
  return sql`(${value} * ${overlap} / nullif(${tradingDayCount(periodStart, periodEnd)}, 0))`;
}

/** Monday of the trading week containing the given date (ISO weeks start Monday). */
export function weekStartFor(date: SQL): SQL {
  return sql`(date_trunc('week', ${date})::date)`;
}

/** Saturday of the trading week containing the given date. */
export function weekEndFor(date: SQL): SQL {
  return sql`(date_trunc('week', ${date})::date + 5)`;
}
