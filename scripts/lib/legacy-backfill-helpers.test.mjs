import { describe, expect, it } from 'vitest';
import {
  actionState,
  compareLegacyEntries,
  firstCode,
  legacyStockValue,
  maintenanceStatus,
  monthPeriod,
  normalizePhone,
  productStatus,
  score,
  validDate,
  weekStart,
} from './legacy-backfill-helpers.mjs';

describe('legacy workflow backfill helpers', () => {
  it('normalizes legacy dates, phones, codes, and periods deterministically', () => {
    expect(validDate('2026-02-29')).toBe(false);
    expect(normalizePhone('024 123 4567')).toBe('233241234567');
    expect(normalizePhone('123')).toBeNull();
    expect(firstCode('shirts, shoes')).toBe('shirts');
    expect(weekStart('2026-07-12')).toBe('2026-07-06');
    expect(monthPeriod('2026-07-13T10:00:00Z')).toEqual({ start: '2026-07-01', end: '2026-07-31' });
  });

  it('maps legacy statuses without widening the typed enums', () => {
    expect(productStatus('oos')).toBe('out-of-stock');
    expect(actionState('on-track')).toEqual({ status: 'open', priority: 'low' });
    expect(actionState('On Track')).toEqual({ status: 'open', priority: 'low' });
    expect(actionState('Ahead')).toEqual({ status: 'open', priority: 'low' });
    expect(actionState('Behind')).toEqual({ status: 'in-progress', priority: 'high' });
    expect(actionState('at-risk')).toEqual({ status: 'in-progress', priority: 'high' });
    expect(actionState('off-track')).toEqual({ status: 'blocked', priority: 'high' });
    expect(maintenanceStatus('overdue')).toBe('blocked');
    expect(maintenanceStatus('resolved')).toBe('completed');
    expect(score('', 0)).toBe(0);
    expect(score('101')).toBeNull();
  });

  it('preserves aggregate stock value and derives it from legacy per-unit value', () => {
    expect(legacyStockValue('1250.50', '99', 4)).toBe('1250.50');
    expect(legacyStockValue('', '125.50', 4)).toBe('502.00');
    expect(legacyStockValue('', 'invalid', 4)).toBeNull();
  });

  it('orders repeated legacy snapshots by timestamp and then source id', () => {
    const earlier = { id: 12, created_at: '2026-07-13T10:00:00Z' };
    const later = { id: 3, created_at: '2026-07-13T11:00:00Z' };
    const sameTimeLaterId = { id: 13, created_at: earlier.created_at };

    expect(compareLegacyEntries(earlier, later)).toBeLessThan(0);
    expect(compareLegacyEntries(earlier, sameTimeLaterId)).toBeLessThan(0);
  });
});
