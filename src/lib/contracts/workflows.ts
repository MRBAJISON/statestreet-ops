import { z } from 'zod';
import { customerContactRetentionWindow } from '../customer-contact-retention';
import { dateSchema, moneySchema, optionalMoneySchema, positiveIdSchema } from './shared';

const requiredText = (max = 2000) => z.string().trim().min(1).max(max);
const optionalText = (max = 2000) =>
  z.preprocess((value) => (value === '' || value === null ? undefined : value), z.string().trim().max(max).optional());
const optionalId = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  positiveIdSchema.optional()
);
const optionalDate = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  dateSchema.optional()
);
const optionalCount = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  z.number().int().min(0).max(100_000_000).optional()
);
const optionalPercent = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  z.number().min(0).max(100).optional()
);
const optionalEnum = <T extends [string, ...string[]]>(values: T) =>
  z.preprocess((value) => (value === '' || value === null ? undefined : value), z.enum(values).optional());
const count = z.number().int().min(0).max(100_000_000);
const score100 = z.number().int().min(0).max(100);

export const expenseSchema = z.object({
  businessDate: dateSchema,
  expenseCategoryId: positiveIdSchema,
  storeId: optionalId,
  amount: moneySchema,
  vendor: optionalText(200),
  invoiceReference: optionalText(120),
  paymentMethodId: optionalId,
  description: requiredText(1000),
  overspendReason: optionalText(1000),
});

export const budgetSchema = z.object({
  year: z.number().int().min(2000).max(2200),
  expenseCategoryId: positiveIdSchema,
  storeId: optionalId,
  amount: moneySchema,
  notes: optionalText(1000),
});

export const capitalSnapshotSchema = z.object({
  year: z.number().int().min(2000).max(2200),
  capitalEmployed: moneySchema,
  totalInvestment: moneySchema,
  notes: optionalText(1000),
});

export const cashTransactionSchema = z.object({
  businessDate: dateSchema,
  direction: z.enum(['inflow', 'outflow']),
  category: requiredText(120),
  expenseCategoryId: optionalId,
  amount: moneySchema.refine((value) => Number(value) > 0, 'Amount must be greater than zero'),
  cashAccountId: optionalId,
  reference: optionalText(120),
  description: optionalText(1000),
});

export const workingCapitalSchema = z.object({
  type: z.enum(['debtor', 'creditor']),
  entity: requiredText(200),
  originalAmount: moneySchema.refine((value) => Number(value) > 0, 'Amount must be greater than zero'),
  dueDate: optionalDate,
  notes: optionalText(1000),
});

export const financialForecastSchema = z.object({
  periodStart: dateSchema,
  periodEnd: dateSchema,
  revenue: moneySchema,
  grossProfit: moneySchema,
  netProfit: moneySchema,
  cashBalance: moneySchema,
  confidence: z.enum(['low', 'medium', 'high']),
  assumptions: optionalText(3000),
}).refine((value) => value.periodEnd >= value.periodStart, {
  path: ['periodEnd'],
  message: 'Period end cannot be before period start',
});

export const performanceTargetSchema = z
  .object({
    metric: z.enum(['net-revenue', 'gross-profit', 'operating-profit', 'gross-margin', 'units', 'conversion-rate']),
    scopeType: z.enum(['group', 'store', 'brand', 'category']),
    storeId: optionalId,
    brandId: optionalId,
    categoryId: optionalId,
    periodType: z.enum(['week', 'month', 'quarter', 'year']),
    periodStart: dateSchema,
    periodEnd: dateSchema,
    value: moneySchema,
    unit: z.enum(['money', 'percent', 'count', 'ratio']),
  })
  .superRefine((target, context) => {
    if (target.periodEnd < target.periodStart) {
      context.addIssue({ code: 'custom', path: ['periodEnd'], message: 'Period end cannot be before period start' });
    }
    const references = [target.storeId, target.brandId, target.categoryId].filter(Boolean).length;
    if (target.scopeType === 'group' ? references !== 0 : references !== 1) {
      context.addIssue({ code: 'custom', path: ['scopeType'], message: 'Target scope does not match its reference' });
    }
    if (target.scopeType === 'store' && !target.storeId) context.addIssue({ code: 'custom', path: ['storeId'], message: 'Store is required' });
    if (target.scopeType === 'brand' && !target.brandId) context.addIssue({ code: 'custom', path: ['brandId'], message: 'Brand is required' });
    if (target.scopeType === 'category' && !target.categoryId) context.addIssue({ code: 'custom', path: ['categoryId'], message: 'Category is required' });
  });

export const actionItemSchema = z
  .object({
    department: z.enum(['finance', 'commercial', 'marketing', 'operations', 'inventory', 'brand']),
    storeId: optionalId,
    brandId: optionalId,
    categoryId: optionalId,
    title: requiredText(240),
    detail: optionalText(2000),
    priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
    ownerUserId: optionalId,
    ownerName: optionalText(160),
    dueDate: optionalDate,
  })
  .refine((action) => Boolean(action.ownerUserId || action.ownerName), {
    path: ['ownerUserId'],
    message: 'Choose an owner or enter an external owner name',
  });

export const productInsightSchema = z.object({
  productId: positiveIdSchema,
  periodStart: dateSchema,
  periodEnd: dateSchema,
  status: z.enum(['active', 'slow', 'dead', 'out-of-stock']),
  performance: z.enum(['strong', 'steady', 'underperforming']).optional(),
  campaign: optionalText(500),
  insight: optionalText(2000),
  unitsSold: optionalCount,
  currentStock: optionalCount,
  sellThroughPercent: optionalPercent,
  salesValue: optionalMoneySchema,
  daysInStock: optionalCount,
}).refine((value) => value.periodEnd >= value.periodStart, {
  path: ['periodEnd'],
  message: 'Period end cannot be before period start',
});

export const campaignSchema = z.object({
  businessDate: dateSchema,
  name: requiredText(200),
  brandId: positiveIdSchema,
  platform: requiredText(100),
  reach: count,
  engagement: count,
  storeVisits: count,
  revenueInfluenced: moneySchema,
  spend: moneySchema,
  status: z.enum(['planned', 'active', 'paused', 'completed']),
});

export const leadMetricSchema = z
  .object({
    businessDate: dateSchema,
    channel: requiredText(120),
    campaignReportId: optionalId,
    leadCount: count,
    qualifiedCount: count,
    convertedCount: count,
    averageValue: optionalMoneySchema,
    notes: optionalText(1000),
  })
  .refine((value) => value.qualifiedCount <= value.leadCount && value.convertedCount <= value.qualifiedCount, {
    path: ['convertedCount'],
    message: 'Converted leads cannot exceed qualified leads, and qualified leads cannot exceed total leads',
  });

export const socialMetricSchema = z.object({
  businessDate: dateSchema,
  platform: requiredText(100),
  brandId: optionalId,
  followers: count,
  posts: count,
  reels: count,
  stories: count,
  reach: count,
  impressions: count,
  engagement: count,
  clicks: count,
  websiteVisits: count,
});

export const clientelingSchema = z
  .object({
    businessDate: dateSchema,
    type: requiredText(120),
    storeId: optionalId,
    contacted: count,
    responses: count,
    appointments: count,
    estimatedRevenue: moneySchema,
    notes: optionalText(1000),
  })
  .refine((value) => value.responses <= value.contacted && value.appointments <= value.responses, {
    path: ['appointments'],
    message: 'Appointments cannot exceed responses, and responses cannot exceed contacts',
  });

export const feedbackSchema = z
  .object({
    businessDate: dateSchema,
    source: requiredText(120),
    type: requiredText(120),
    category: optionalText(120),
    npsScore: z.number().int().min(0).max(10).optional(),
    recommendation: z.enum(['yes', 'likely', 'no']).optional(),
    frequency: optionalText(80),
    detail: requiredText(3000),
    storeId: optionalId,
    brandId: optionalId,
    contactName: optionalText(160),
    contactValue: optionalText(200),
    contactConsent: z.boolean().default(false),
    retentionUntil: optionalDate,
  })
  .superRefine((feedback, context) => {
    const hasContactDetails = Boolean(feedback.contactName || feedback.contactValue);
    if (hasContactDetails && !feedback.contactConsent) {
      context.addIssue({
        code: 'custom',
        path: ['contactConsent'],
        message: 'Contact consent is required before storing contact details',
      });
    }
    if (hasContactDetails && !feedback.retentionUntil) {
      context.addIssue({
        code: 'custom',
        path: ['retentionUntil'],
        message: 'A retention date is required before storing contact details',
      });
    }
    if (hasContactDetails && feedback.retentionUntil) {
      const retention = customerContactRetentionWindow();
      if (feedback.retentionUntil < retention.from) {
        context.addIssue({
          code: 'custom',
          path: ['retentionUntil'],
          message: 'The retention date cannot be in the past',
        });
      } else if (feedback.retentionUntil > retention.to) {
        context.addIssue({
          code: 'custom',
          path: ['retentionUntil'],
          message: 'Contact details can be retained for at most 90 days',
        });
      }
    }
  });

export const storeStandardSchema = z.object({
  businessDate: dateSchema,
  storeId: positiveIdSchema,
  operationsScore: score100,
  vmScore: score100,
  readinessScore: score100,
  customerExperienceScore: score100,
  cleanlinessScore: score100,
  safetyScore: score100,
  issues: optionalText(2000),
});

export const vmReviewSchema = z.object({
  businessDate: dateSchema,
  storeId: positiveIdSchema,
  windowDisplayScore: score100,
  mannequinScore: score100,
  productPresentationScore: score100,
  sizeArrangementScore: score100,
  improvements: optionalText(2000),
});

export const storeExperienceSchema = z.object({
  businessDate: dateSchema,
  storeId: positiveIdSchema,
  category: requiredText(120),
  rating: z.number().int().min(1).max(5),
  npsScore: z.number().int().min(0).max(10).optional(),
  recommendation: z.enum(['yes', 'likely', 'no']).optional(),
  comments: optionalText(2000),
});

export const maintenanceSchema = z.object({
  businessDate: dateSchema,
  storeId: positiveIdSchema,
  category: requiredText(120),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  description: requiredText(2000),
  assignedToUserId: optionalId,
  assignedToName: optionalText(160),
  estimatedCost: optionalMoneySchema,
  dueDate: optionalDate,
});

export const incidentSchema = z.object({
  occurredAt: z.string().datetime({ offset: true }),
  storeId: positiveIdSchema,
  type: requiredText(120),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  description: requiredText(3000),
  immediateAction: optionalText(2000),
  followUpRequired: z.boolean().default(false),
});

export const sopReviewSchema = z.object({
  businessDate: dateSchema,
  storeId: positiveIdSchema,
  area: requiredText(160),
  complianceScore: score100,
  deviations: optionalText(2000),
  correctiveAction: optionalText(2000),
});

export const peopleSnapshotSchema = z.object({
  businessDate: dateSchema,
  storeId: positiveIdSchema,
  staffTotal: count,
  staffPresent: count,
  punctualityScore: score100,
  trainingCompletionScore: score100,
  absenceReason: optionalText(500),
  notes: optionalText(1000),
}).refine((value) => value.staffPresent <= value.staffTotal, {
  path: ['staffPresent'],
  message: 'Present staff cannot exceed total staff',
});

export const brandHealthSchema = z.object({
  businessDate: dateSchema,
  brandId: positiveIdSchema,
  type: requiredText(100),
  awarenessScore: score100,
  considerationScore: score100,
  preferenceScore: score100,
  satisfactionScore: score100,
  loyaltyScore: score100,
  advocacyScore: score100,
  momentumScore: score100,
  overallOverride: score100.optional(),
  overrideReason: optionalText(1000),
}).refine((value) => value.overallOverride === undefined || Boolean(value.overrideReason), {
  path: ['overrideReason'],
  message: 'Explain any overall score override',
});

export const brandSentimentSchema = z.object({
  businessDate: dateSchema,
  brandId: positiveIdSchema,
  source: requiredText(120),
  positiveMentions: count,
  neutralMentions: count,
  negativeMentions: count,
  positiveTheme: optionalText(500),
  negativeTheme: optionalText(500),
});

export const competitorSchema = z.object({
  businessDate: dateSchema,
  competitor: requiredText(160),
  brandId: optionalId,
  shareOfVoice: z.number().min(0).max(100).optional(),
  activityType: optionalText(120),
  description: requiredText(2000),
  threatLevel: z.enum(['low', 'medium', 'high', 'critical']),
  recommendedResponse: optionalText(2000),
});

export const digitalReputationSchema = z.object({
  businessDate: dateSchema,
  brandId: optionalId,
  googleRating: z.number().min(0).max(5).optional(),
  googleReviewCount: count,
  instagramSentiment: z.number().min(0).max(100).optional(),
  instagramFollowers: count,
  responseRate: z.number().min(0).max(100).optional(),
  averageResponseHours: z.number().min(0).optional(),
  nps: z.number().int().min(-100).max(100).optional(),
  trustpilotRating: z.number().min(0).max(5).optional(),
  newReviews: count,
  negativeReviews: count,
});

export const inventoryDispositionSchema = z.object({
  reviewDate: dateSchema,
  productId: positiveIdSchema,
  storeId: positiveIdSchema,
  action: z.enum(['markdown-20', 'markdown-40', 'markdown-60', 'transfer', 'donate', 'write-off']),
  justification: requiredText(2000),
});

export const customerCaptureSchema = z.object({
  businessDate: dateSchema,
  storeId: optionalId,
  name: requiredText(160),
  phone: requiredText(40),
  occupation: optionalText(120),
  sizePreference: optionalText(80),
  lifecycle: z.enum(['lead', 'buyer']),
  source: requiredText(120),
  sourceDetail: optionalText(200),
  productId: optionalId,
  interestText: optionalText(500),
  fulfillmentStatus: optionalEnum(['in_stock', 'stock_gap']),
  notes: optionalText(1000),
}).refine((value) => Boolean(value.productId || value.interestText), {
  path: ['productId'],
  message: 'Choose a product or describe the customer interest',
});

export const workflowSchemas = {
  expense: expenseSchema,
  budget: budgetSchema,
  'capital-snapshot': capitalSnapshotSchema,
  'cash-transaction': cashTransactionSchema,
  'working-capital': workingCapitalSchema,
  forecast: financialForecastSchema,
  target: performanceTargetSchema,
  action: actionItemSchema,
  'product-insight': productInsightSchema,
  campaign: campaignSchema,
  'lead-metric': leadMetricSchema,
  'social-metric': socialMetricSchema,
  clienteling: clientelingSchema,
  feedback: feedbackSchema,
  'store-standard': storeStandardSchema,
  'vm-review': vmReviewSchema,
  'store-experience': storeExperienceSchema,
  maintenance: maintenanceSchema,
  incident: incidentSchema,
  'sop-review': sopReviewSchema,
  people: peopleSnapshotSchema,
  'brand-health': brandHealthSchema,
  'brand-sentiment': brandSentimentSchema,
  competitor: competitorSchema,
  'digital-reputation': digitalReputationSchema,
  'inventory-disposition': inventoryDispositionSchema,
  'customer-capture': customerCaptureSchema,
} as const;

export type WorkflowName = keyof typeof workflowSchemas;

export function isWorkflowName(value: string): value is WorkflowName {
  return Object.prototype.hasOwnProperty.call(workflowSchemas, value);
}
