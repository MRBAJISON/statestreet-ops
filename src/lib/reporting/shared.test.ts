import { describe, expect, it } from 'vitest';
import { analyticsQuerySchema } from '../contracts/analytics';
import { resolveAnalyticsRange } from './range';

describe('analytics range contract', () => {
  const now = new Date('2026-07-11T12:00:00.000Z');

  it('builds inclusive rolling and comparison ranges', () => {
    expect(resolveAnalyticsRange({ preset: '30d' }, now)).toEqual({
      preset: '30d',
      from: '2026-06-12',
      to: '2026-07-11',
      compareFrom: '2026-05-13',
      compareTo: '2026-06-11',
    });
  });

  it('anchors month, quarter, and year ranges to the requested end date', () => {
    expect(resolveAnalyticsRange({ preset: 'mtd', to: '2026-05-18' }, now).from).toBe('2026-05-01');
    expect(resolveAnalyticsRange({ preset: 'qtd', to: '2026-05-18' }, now).from).toBe('2026-04-01');
    expect(resolveAnalyticsRange({ preset: 'ytd', to: '2026-05-18' }, now).from).toBe('2026-01-01');
  });

  it('requires both dates for a custom range and rejects reversed dates', () => {
    expect(analyticsQuerySchema.safeParse({ preset: 'custom', from: '2026-07-01' }).success).toBe(false);
    expect(
      analyticsQuerySchema.safeParse({ preset: 'custom', from: '2026-07-11', to: '2026-07-01' }).success
    ).toBe(false);
  });
});
