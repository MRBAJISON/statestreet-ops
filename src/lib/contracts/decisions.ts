import { z } from 'zod';
import { dateSchema, moneySchema, positiveIdSchema } from './shared';

export const mutableWorkflowSchema = z.enum([
  'action',
  'maintenance',
  'incident',
  'inventory-disposition',
  'working-capital',
]);
export type MutableWorkflow = z.infer<typeof mutableWorkflowSchema>;

export const actionDecisionSchema = z.object({
  status: z.enum(['open', 'in-progress', 'blocked', 'completed', 'cancelled']),
  note: z.string().trim().max(1000).optional(),
});

export const maintenanceDecisionSchema = z.object({
  status: z.enum(['open', 'in-progress', 'blocked', 'completed', 'cancelled']),
  note: z.string().trim().max(1000).optional(),
});

export const incidentDecisionSchema = z.object({
  status: z.enum(['open', 'investigating', 'resolved', 'closed']),
  note: z.string().trim().max(1000).optional(),
});

export const dispositionDecisionSchema = z.object({
  status: z.enum(['proposed', 'approved', 'in-progress', 'completed', 'rejected', 'cancelled']),
  note: z.string().trim().max(1000).optional(),
});

export const workingCapitalSettlementSchema = z.object({
  businessDate: dateSchema,
  amount: moneySchema.refine((value) => Number(value) > 0, 'Amount must be greater than zero'),
  cashAccountId: positiveIdSchema.optional(),
  reference: z.string().trim().max(120).optional(),
});
