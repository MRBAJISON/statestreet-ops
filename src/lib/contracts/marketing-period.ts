import { z } from 'zod';
import { dateSchema } from './shared';

export const marketingPeriodFields = { periodStart: dateSchema, periodEnd: dateSchema };

export function validateMarketingPeriod(value: { periodStart: string; periodEnd: string }, context: z.RefinementCtx) {
  if (value.periodEnd < value.periodStart) {
    context.addIssue({ code: 'custom', path: ['periodEnd'], message: 'End date cannot be before start date' });
  }
  if (value.periodStart.slice(0, 7) !== value.periodEnd.slice(0, 7)) {
    context.addIssue({ code: 'custom', path: ['periodEnd'], message: 'Split a period crossing month-end into separate monthly summaries' });
  }
}
