import { z } from 'zod';
import { positiveIdSchema } from './shared';

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();

export const publicSurveySchema = z
  .object({
    storeId: positiveIdSchema,
    category: z.enum(['cleanliness', 'staff-knowledge', 'availability', 'fitting-room', 'checkout', 'overall']),
    npsScore: z.number().int().min(0).max(10).optional(),
    recommendation: z.enum(['yes', 'likely', 'no']).optional(),
    detail: optionalText(3000),
    contactName: optionalText(160),
    contactValue: optionalText(200),
    contactConsent: z.boolean().default(false),
    company: z.string().max(300).optional(),
  })
  .strict()
  .superRefine((survey, context) => {
    if (survey.npsScore === undefined && !survey.recommendation && !survey.detail) {
      context.addIssue({ code: 'custom', path: ['detail'], message: 'Share a rating, recommendation, or comment' });
    }
    if ((survey.contactName || survey.contactValue) && !survey.contactConsent) {
      context.addIssue({ code: 'custom', path: ['contactConsent'], message: 'Consent is required before contact details can be stored' });
    }
    if (survey.contactConsent && !survey.contactValue) {
      context.addIssue({ code: 'custom', path: ['contactValue'], message: 'Add a phone number or email for follow-up' });
    }
  });

export type PublicSurveyInput = z.infer<typeof publicSurveySchema>;
