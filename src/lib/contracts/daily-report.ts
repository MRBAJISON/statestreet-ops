import { z } from 'zod';
import { dateSchema, moneySchema, moneyToCents, positiveIdSchema } from './shared';

const countSchema = z.number().int().min(0).max(10_000_000);

export const dailyReportStatusSchema = z.enum(['draft', 'submitted', 'approved']);

export const dailyReportProductSchema = z
  .object({
    productId: positiveIdSchema.optional(),
    customName: z.string().trim().max(160).optional(),
    unitsSold: countSchema.default(0),
    lineValue: moneySchema.default('0.00'),
    // Set when the manager corrected the value away from units x catalogue price,
    // so a deliberate markdown can be told apart from a derived figure.
    valueOverridden: z.boolean().default(false),
  })
  .refine((value) => Boolean(value.productId || value.customName), {
    path: ['customName'],
    message: 'Choose a product or type a name',
  });

export const dailySalesLineSchema = z
  .object({
    categoryId: positiveIdSchema,
    openingStock: countSchema.default(0),
    unitsSold: countSchema.default(0),
    grossRevenue: moneySchema,
    cogs: moneySchema,
    discounts: moneySchema.default('0.00'),
    returns: moneySchema.default('0.00'),
    creditSales: moneySchema.default('0.00'),
    products: z.array(dailyReportProductSchema).max(100).default([]),
  })
  .superRefine((line, ctx) => {
    const gross = moneyToCents(line.grossRevenue);
    const discounts = moneyToCents(line.discounts);
    const returns = moneyToCents(line.returns);
    const credit = moneyToCents(line.creditSales);

    // Product lines are an attributed subset of the category, so they may add up to
    // less than the category total — a manager who forgets one item should not be
    // blocked from closing the day. They must never add up to more, which would
    // mean the category understates what was actually sold.
    const productUnits = line.products.reduce((total, product) => total + product.unitsSold, 0);
    const productValue = line.products.reduce((total, product) => total + moneyToCents(product.lineValue), BigInt(0));
    if (productUnits > line.unitsSold) {
      ctx.addIssue({
        code: 'custom',
        path: ['unitsSold'],
        message: 'Product lines add up to more units than the category total',
      });
    }
    if (productValue > gross) {
      ctx.addIssue({
        code: 'custom',
        path: ['grossRevenue'],
        message: 'Product lines add up to more than the category gross revenue',
      });
    }
    if (discounts + returns > gross) {
      ctx.addIssue({
        code: 'custom',
        path: ['returns'],
        message: 'Discounts and returns cannot exceed gross revenue',
      });
    }
    if (credit > gross - discounts - returns) {
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
    status: dailyReportStatusSchema.exclude(['approved']).default('draft'),
    transactions: countSchema.default(0),
    footfall: countSchema.default(0),
    totalCustomers: countSchema.default(0),
    newCustomers: countSchema.default(0),
    returningCustomers: countSchema.default(0),
    notes: z.string().trim().max(2000).optional().nullable(),
    staffPerformanceNote: z.string().trim().max(2000).optional().nullable(),
    closingFacilityStatus: z.string().trim().max(2000).optional().nullable(),
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
    if (report.status === 'submitted') {
      const expectedPayments = report.sales.reduce<bigint>(
        (total, line) =>
          total +
          moneyToCents(line.grossRevenue) -
          moneyToCents(line.discounts) -
          moneyToCents(line.returns) -
          moneyToCents(line.creditSales),
        BigInt(0)
      );
      const actualPayments = report.payments.reduce<bigint>(
        (total, line) => total + moneyToCents(line.amount),
        BigInt(0)
      );
      if (actualPayments !== expectedPayments) {
        ctx.addIssue({
          code: 'custom',
          path: ['payments'],
          message: 'Payment total must match net cash sales before this report can be submitted',
        });
      }
    }
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
export type DailyReportStatus = z.infer<typeof dailyReportStatusSchema>;

export interface DailyReportReference {
  id: number;
  code: string;
  name: string;
}

export interface DailyReportOption extends DailyReportReference {
  available: boolean;
}

export interface DailyReportProductRecord {
  productId: number | null;
  productName: string;
  sku: string | null;
  brandName: string | null;
  unitsSold: number;
  lineValue: string;
  valueOverridden: boolean;
}

export interface DailyReportSalesRecord {
  categoryId: number;
  openingStock: number;
  unitsSold: number;
  grossRevenue: string;
  cogs: string;
  discounts: string;
  returns: string;
  creditSales: string;
  products: DailyReportProductRecord[];
}

export interface DailyReportPaymentRecord {
  paymentMethodId: number;
  amount: string;
}

export interface DailyReportActivityRecord {
  id: number;
  action: string;
  actorName: string | null;
  reason: string | null;
  createdAt: string;
}

export interface DailyReportRecord {
  id: number;
  storeId: number;
  storeCode: string;
  storeName: string;
  managerName: string | null;
  businessDate: string;
  status: DailyReportStatus;
  transactions: number;
  footfall: number;
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  notes: string | null;
  staffPerformanceNote: string | null;
  closingFacilityStatus: string | null;
  lockVersion: number;
  submittedAt: string | null;
  approvedAt: string | null;
  updatedAt: string;
  sales: DailyReportSalesRecord[];
  payments: DailyReportPaymentRecord[];
  activity: DailyReportActivityRecord[];
}

export interface DailyReportReferences {
  store: DailyReportReference | null;
  categories: DailyReportOption[];
  paymentMethods: DailyReportOption[];
}

export interface DailyReportsResponse {
  reports: DailyReportRecord[];
  references: DailyReportReferences;
}

export interface DailyReportMutationRecord {
  id: number;
  lockVersion: number;
  status: 'draft' | 'submitted';
  salesCount: number;
  paymentCount: number;
}

export interface DailyReportMutationResponse {
  ok: true;
  report: DailyReportMutationRecord;
}
