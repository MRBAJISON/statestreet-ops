import { z } from 'zod';
import { dateSchema, moneySchema, moneyToCents, positiveIdSchema } from './shared';

const countSchema = z.number().int().min(0).max(10_000_000);

export const dailySalesLineSchema = z
  .object({
    categoryId: positiveIdSchema,
    openingStock: countSchema.default(0),
    unitsSold: countSchema.default(0),
    grossRevenue: moneySchema,
    cogs: moneySchema,
    discounts: moneySchema.default('0.00'),
    creditSales: moneySchema.default('0.00'),
  })
  .superRefine((line, ctx) => {
    const gross = moneyToCents(line.grossRevenue);
    const discounts = moneyToCents(line.discounts);
    const credit = moneyToCents(line.creditSales);
    if (discounts > gross) {
      ctx.addIssue({ code: 'custom', path: ['discounts'], message: 'Discounts cannot exceed gross revenue' });
    }
    if (credit > gross - discounts) {
      ctx.addIssue({ code: 'custom', path: ['creditSales'], message: 'Credit sales cannot exceed net revenue' });
    }
  });

export const dailyPaymentLineSchema = z.object({
  paymentMethodId: positiveIdSchema,
  amount: moneySchema,
});

export const saveDailyReportSchema = z
  .object({
    businessDate: dateSchema,
    storeId: positiveIdSchema.optional(),
    status: z.enum(['draft', 'submitted']).default('draft'),
    transactions: countSchema.default(0),
    footfall: countSchema.default(0),
    totalCustomers: countSchema.default(0),
    newCustomers: countSchema.default(0),
    returningCustomers: countSchema.default(0),
    notes: z.string().trim().max(2000).optional().nullable(),
    lockVersion: z.number().int().positive().optional(),
    sales: z.array(dailySalesLineSchema).min(1).max(200),
    payments: z.array(dailyPaymentLineSchema).max(30).default([]),
  })
  .superRefine((report, ctx) => {
    if (report.newCustomers + report.returningCustomers > report.totalCustomers) {
      ctx.addIssue({
        code: 'custom',
        path: ['totalCustomers'],
        message: 'Total customers cannot be less than new plus returning customers',
      });
    }
    const categories = new Set<number>();
    report.sales.forEach((line, index) => {
      if (categories.has(line.categoryId)) {
        ctx.addIssue({ code: 'custom', path: ['sales', index, 'categoryId'], message: 'Category is already included' });
      }
      categories.add(line.categoryId);
    });
    const paymentMethods = new Set<number>();
    report.payments.forEach((line, index) => {
      if (paymentMethods.has(line.paymentMethodId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['payments', index, 'paymentMethodId'],
          message: 'Payment method is already included',
        });
      }
      paymentMethods.add(line.paymentMethodId);
    });
  });

export const dailyReportDecisionSchema = z
  .object({
    action: z.enum(['approve', 'reopen']),
    lockVersion: z.number().int().positive(),
    reason: z.string().trim().max(1000).optional(),
  })
  .superRefine((decision, ctx) => {
    if (decision.action === 'reopen' && !decision.reason) {
      ctx.addIssue({ code: 'custom', path: ['reason'], message: 'A reason is required to reopen a report' });
    }
  });

export type SaveDailyReportInput = z.infer<typeof saveDailyReportSchema>;
export type DailyReportDecisionInput = z.infer<typeof dailyReportDecisionSchema>;
