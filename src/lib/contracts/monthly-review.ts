import { z } from 'zod';
import { dateSchema, moneySchema, positiveIdSchema } from './shared';
const narrative = z.string().trim().max(12000).default('');
export const monthlyScopeSchema = z
  .object({
    storeId: positiveIdSchema.optional(),
    groupId: positiveIdSchema.optional(),
    month: dateSchema,
  })
  .refine(
    (v) => Boolean(v.storeId) !== Boolean(v.groupId),
    'Choose one store or cluster'
  )
  .refine((v) => v.month.endsWith('-01'), 'Month must start on day 1');
export type MonthlyScopeInput = z.infer<typeof monthlyScopeSchema>;
export const monthlyActionSchema = z.object({
  id: z.uuid(),
  storeId: positiveIdSchema.nullable().default(null),
  action: z.string().trim().min(1).max(1000),
  outcome: z.string().trim().min(1).max(1000),
  ownerName: z.string().trim().min(1).max(160),
  dueDate: dateSchema,
  goal: z.string().trim().min(1).max(500),
  status: z
    .enum(['open', 'in-progress', 'completed', 'cancelled'])
    .default('open'),
  progress: z.string().trim().max(2000).default(''),
});
export const saveMonthlyReviewSchema = z
  .object({
    scope: monthlyScopeSchema,
    lockVersion: z.number().int().positive().optional(),
    status: z.enum(['draft', 'submitted']),
    executiveSummary: narrative,
    managementOutcomes: narrative,
    operationalAssessment: narrative,
    conclusion: narrative,
    storeComments: z
      .record(z.string(), z.string().trim().max(3000))
      .default({}),
    sourceHash: z.string().length(64),
    confirmNarrative: z.boolean().default(false),
    advisors: z
      .array(
        z.object({
          storeId: positiveIdSchema,
          name: z.string().trim().min(1).max(160),
          actualSales: moneySchema,
          target: moneySchema,
        })
      )
      .max(100)
      .default([]),
    actions: z.array(monthlyActionSchema).max(5).default([]),
    carriedActions: z
      .array(
        z.object({
          id: z.uuid(),
          status: z.enum(['open', 'in-progress', 'completed', 'cancelled']),
          progress: z.string().trim().max(2000),
          expectedStatus: z.enum([
            'open',
            'in-progress',
            'completed',
            'cancelled',
          ]),
          expectedProgress: z.string().max(2000),
        })
      )
      .max(100)
      .default([]),
  })
  .superRefine((v, ctx) => {
    if (new Set(v.actions.map((a) => a.id)).size !== v.actions.length)
      ctx.addIssue({
        code: 'custom',
        path: ['actions'],
        message: 'Duplicate action',
      });
    if (
      new Set(v.carriedActions.map((a) => a.id)).size !==
      v.carriedActions.length
    )
      ctx.addIssue({
        code: 'custom',
        path: ['carriedActions'],
        message: 'Duplicate carried action',
      });
    if (v.status === 'submitted') {
      for (const field of [
        'managementOutcomes',
        'operationalAssessment',
        'conclusion',
      ] as const)
        if (!v[field])
          ctx.addIssue({
            code: 'custom',
            path: [field],
            message: 'Complete this section before submitting',
          });
      if (!v.confirmNarrative)
        ctx.addIssue({
          code: 'custom',
          path: ['confirmNarrative'],
          message: 'Check the generated summary before submitting',
        });
    }
  });
export type SaveMonthlyReviewInput = z.infer<typeof saveMonthlyReviewSchema>;
export type MonthlyActionInput = z.infer<typeof monthlyActionSchema>;
