import { z } from 'zod';
import { leadMetricSchema } from './workflows';

export const leadMetricUpdateSchema = z.object({
  summary: leadMetricSchema,
  lockVersion: z.number().int().positive(),
  reason: z.string().trim().min(1, 'Explain the correction').max(1000),
});

export interface LeadMetricRecord {
  id: number;
  periodStart: string;
  periodEnd: string;
  channel: string;
  campaignReportId: number | null;
  leadCount: number;
  qualifiedCount: number;
  convertedCount: number;
  averageValue: string | null;
  notes: string | null;
  lockVersion: number;
}

export interface LeadMetricPage {
  records: LeadMetricRecord[];
  page: number;
  totalPages: number;
}
