import { describe, expect, it } from 'vitest';
import { leadMetricSchema } from './workflows';
import { leadMetricUpdateSchema } from './lead-metrics';

const valid = { periodStart: '2026-10-01', periodEnd: '2026-10-07', channel: ' Instagram ', leadCount: 30, qualifiedCount: 20, convertedCount: 10 };

describe('lead summary periods', () => {
  it('accepts inclusive ranges and single days', () => {
    expect(leadMetricSchema.parse(valid).channel).toBe('Instagram');
    expect(leadMetricSchema.safeParse({ ...valid, periodEnd: valid.periodStart }).success).toBe(true);
  });
  it.each([
    { periodEnd: '2026-09-30' }, { periodEnd: '2026-11-01' }, { periodStart: '2026-02-30' },
    { periodEnd: '' }, { leadCount: -1 }, { qualifiedCount: 31 }, { convertedCount: 21 }, { leadCount: 2.5 },
  ])('rejects invalid dates or totals: %j', (change) => {
    expect(leadMetricSchema.safeParse({ ...valid, ...change }).success).toBe(false);
  });
  it('requires a version and explanation for corrections', () => {
    expect(leadMetricUpdateSchema.safeParse({ summary: valid, lockVersion: 1, reason: 'Corrected tally' }).success).toBe(true);
    expect(leadMetricUpdateSchema.safeParse({ summary: valid, lockVersion: 1, reason: ' ' }).success).toBe(false);
    expect(leadMetricUpdateSchema.safeParse({ summary: valid, reason: 'Corrected tally' }).success).toBe(false);
  });
});
