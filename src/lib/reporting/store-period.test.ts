import { describe, expect, it } from 'vitest';
import { resolveStorePeriod, tradingDaysBetween } from './store-period';

describe('store period ranges', () => {
  it('resolves a trading week as Monday to Saturday from any day inside it', () => {
    // Wed 22 Jul 2026 sits in the week Mon 20 - Sat 25.
    const midweek = resolveStorePeriod('week', '2026-07-22');
    expect(midweek.range).toMatchObject({ from: '2026-07-20', to: '2026-07-25' });

    // The Monday and the Saturday themselves resolve to the same week.
    expect(resolveStorePeriod('week', '2026-07-20').range.from).toBe('2026-07-20');
    expect(resolveStorePeriod('week', '2026-07-25').range.to).toBe('2026-07-25');
  });

  it('treats a Sunday as belonging to the week that just ended', () => {
    // Sun 26 Jul closes out the Mon 20 - Sat 25 week rather than opening a new one,
    // which matches how week_end is stored on weekly reviews.
    expect(resolveStorePeriod('week', '2026-07-26').range).toMatchObject({
      from: '2026-07-20',
      to: '2026-07-25',
    });
  });

  it('gives the preceding week as the comparison period', () => {
    expect(resolveStorePeriod('week', '2026-07-22').previousRange).toMatchObject({
      from: '2026-07-13',
      to: '2026-07-18',
    });
  });

  it('resolves a month as the calendar month with the previous month for comparison', () => {
    const july = resolveStorePeriod('month', '2026-07-22');
    expect(july.range).toMatchObject({ from: '2026-07-01', to: '2026-07-31', label: 'July 2026' });
    expect(july.previousRange).toMatchObject({ from: '2026-06-01', to: '2026-06-30', label: 'June 2026' });
  });

  it('rolls a January anchor back to the previous December', () => {
    expect(resolveStorePeriod('month', '2026-01-14').previousRange).toMatchObject({
      from: '2025-12-01',
      to: '2025-12-31',
      label: 'December 2025',
    });
  });

  it('counts six trading days in a week and excludes Sundays from a month', () => {
    expect(tradingDaysBetween('2026-07-20', '2026-07-25')).toHaveLength(6);
    // July 2026 holds 31 days less 4 Sundays.
    const july = tradingDaysBetween('2026-07-01', '2026-07-31');
    expect(july).toHaveLength(27);
    expect(july).not.toContain('2026-07-05');
    expect(july).toContain('2026-07-04');
  });
});
