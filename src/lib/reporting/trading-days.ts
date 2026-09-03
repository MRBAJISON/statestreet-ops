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
 * Daily share of a target record. Non-recurring records use their explicit
 * period; recurring records use the calendar period containing the requested
 * date, while still dividing only across Monday-Saturday trading days.
 */
export function targetPerTradingDayForDate(
  value: SQL,
  periodType: SQL,
  recurring: SQL,
  date: SQL,
  periodStart: SQL,
  periodEnd: SQL
): SQL {
  const weekStart = weekStartFor(date);
  const weekEnd = weekEndFor(date);
  const monthStart = sql`date_trunc('month', ${date})::date`;
  const monthEnd = sql`(${monthStart} + interval '1 month - 1 day')::date`;
  return sql`case
    when ${recurring} then case ${periodType}
      when 'day' then ${value}
      when 'week' then ${value} / nullif(${tradingDayCount(weekStart, weekEnd)}, 0)
      when 'month' then ${value} / nullif(${tradingDayCount(monthStart, monthEnd)}, 0)
      else 0
    end
    else ${targetPerTradingDay(value, periodStart, periodEnd)}
  end`;
}

/**
 * True when a target is the effective recurring version for a date. One-time
 * targets override recurring targets; among recurring targets, daily beats
 * weekly, weekly beats monthly, and a later version replaces an older one.
 */
export function targetIsEffectiveForDate(date: SQL): SQL {
  return sql`(
    target.recurring = false or (
      not exists (
        select 1 from performance_targets fixed_target
        where fixed_target.metric = target.metric
          and fixed_target.scope_type = target.scope_type
          and fixed_target.store_id is not distinct from target.store_id
          and fixed_target.brand_id is not distinct from target.brand_id
          and fixed_target.category_id is not distinct from target.category_id
          and fixed_target.recurring = false
          and ${date} between fixed_target.period_start and fixed_target.period_end
      )
      and not exists (
        select 1 from performance_targets newer_target
        where newer_target.metric = target.metric
          and newer_target.scope_type = target.scope_type
          and newer_target.store_id is not distinct from target.store_id
          and newer_target.brand_id is not distinct from target.brand_id
          and newer_target.category_id is not distinct from target.category_id
          and newer_target.recurring = true
          and ${date} between newer_target.period_start and newer_target.period_end
          and (
            case newer_target.period_type when 'day' then 3 when 'week' then 2 when 'month' then 1 else 0 end >
            case target.period_type when 'day' then 3 when 'week' then 2 when 'month' then 1 else 0 end
            or (
              case newer_target.period_type when 'day' then 3 when 'week' then 2 when 'month' then 1 else 0 end =
              case target.period_type when 'day' then 3 when 'week' then 2 when 'month' then 1 else 0 end
              and newer_target.period_start > target.period_start
            )
          )
      )
    )
  )`;
}

/** Total target contribution from a target record inside a selected window. */
export function targetWithinWindowForRecord(
  value: SQL,
  periodType: SQL,
  recurring: SQL,
  periodStart: SQL,
  periodEnd: SQL,
  windowStart: SQL,
  windowEnd: SQL
): SQL {
  const recurringContribution = sql`(
    select coalesce(sum(${targetPerTradingDayForDate(
      value,
      periodType,
      recurring,
      sql`target_day.date`,
      periodStart,
      periodEnd
    )}), 0)
    from generate_series(greatest(${periodStart}, ${windowStart}), least(${periodEnd}, ${windowEnd}), interval '1 day') as target_day(date)
    where extract(dow from target_day.date) <> ${SUNDAY_DOW}
      and ${targetIsEffectiveForDate(sql`target_day.date`)}
  )`;
  return sql`case when ${recurring} then ${recurringContribution} else ${targetWithinWindow(value, periodStart, periodEnd, windowStart, windowEnd)} end`;
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
