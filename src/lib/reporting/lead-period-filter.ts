import { sql, type SQLWrapper } from 'drizzle-orm';

/** Never prorate aggregate counts: partial periods are disclosed separately. */
export function leadPeriodFilter(start: SQLWrapper, end: SQLWrapper, range: { from?: string; to?: string }, partial = false) {
  const contained = sql`(${range.from ? sql`${start} >= ${range.from}::date` : sql`true`}
    and ${range.to ? sql`${end} <= ${range.to}::date` : sql`true`})`;
  if (!partial) return contained;
  return sql`(${range.to ? sql`${start} <= ${range.to}::date` : sql`true`}
    and ${range.from ? sql`${end} >= ${range.from}::date` : sql`true`} and not ${contained})`;
}
