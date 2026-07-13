import { describe, expect, it } from 'vitest';
import { dailyReportDecisionSchema, saveDailyReportSchema } from './daily-report';
import { createProductSchema, updateProductSchema } from './product';
import { dateSchema, moneySchema } from './shared';
import { publicSurveySchema } from './survey';
import { updateUserSchema } from './user';

const validReport = {
  businessDate: '2026-07-10',
  storeId: 2,
  status: 'submitted' as const,
  transactions: 12,
  footfall: 20,
  totalCustomers: 9,
  newCustomers: 4,
  returningCustomers: 5,
  sales: [
    {
      categoryId: 3,
      openingStock: 25,
      unitsSold: 4,
      grossRevenue: '1200',
      cogs: '600.50',
      discounts: '50',
      returns: '25',
      creditSales: '100',
    },
  ],
  payments: [{ paymentMethodId: 1, amount: '1025' }],
};

describe('shared data contracts', () => {
  it('normalizes exact money values and rejects excess precision', () => {
    expect(moneySchema.parse('0012.5')).toBe('12.50');
    expect(moneySchema.safeParse('12.345').success).toBe(false);
    expect(moneySchema.safeParse('-1.00').success).toBe(false);
  });

  it('rejects impossible calendar dates', () => {
    expect(dateSchema.safeParse('2026-02-29').success).toBe(false);
    expect(dateSchema.safeParse('2024-02-29').success).toBe(true);
  });
});

describe('product contract', () => {
  it('normalizes SKU and money fields', () => {
    const product = createProductSchema.parse({
      sku: ' arb-101-blk-42 ',
      name: 'Carbon sneaker',
      brandId: 1,
      categoryId: 2,
      unitCost: '350',
    });
    expect(product.sku).toBe('ARB-101-BLK-42');
    expect(product.unitCost).toBe('350.00');
  });

  it('keeps product money exact and supports explicitly clearing a price', () => {
    const update = updateProductSchema.parse({
      sellingPrice: null,
      unitCost: '850',
      expectedUpdatedAt: '2026-07-11T17:00:00.123Z',
    });
    expect(update.sellingPrice).toBeNull();
    expect(update.unitCost).toBe('850.00');
  });

  it('requires a product change and concurrency timestamp', () => {
    expect(updateProductSchema.safeParse({ active: false }).success).toBe(false);
    expect(updateProductSchema.safeParse({ expectedUpdatedAt: '2026-07-11T17:00:00.123Z' }).success).toBe(false);
  });
});

describe('daily report contract', () => {
  it('normalizes a valid report', () => {
    const report = saveDailyReportSchema.parse(validReport);
    expect(report.sales[0].grossRevenue).toBe('1200.00');
    expect(report.payments[0].amount).toBe('1025.00');
  });

  it('applies normalized zero defaults to optional sales amounts', () => {
    const report = saveDailyReportSchema.parse({
      ...validReport,
      status: 'draft',
      sales: [{ ...validReport.sales[0], discounts: undefined, returns: undefined, creditSales: undefined }],
    });
    expect(report.sales[0].discounts).toBe('0.00');
    expect(report.sales[0].returns).toBe('0.00');
    expect(report.sales[0].creditSales).toBe('0.00');
  });

  it('rejects duplicate categories and payment methods', () => {
    const result = saveDailyReportSchema.safeParse({
      ...validReport,
      sales: [...validReport.sales, { ...validReport.sales[0] }],
      payments: [...validReport.payments, { ...validReport.payments[0] }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toEqual(
        expect.arrayContaining(['Category is already included', 'Payment method is already included'])
      );
    }
  });

  it('rejects inconsistent customers, discounts, and credit sales', () => {
    const result = saveDailyReportSchema.safeParse({
      ...validReport,
      totalCustomers: 2,
      sales: [{ ...validReport.sales[0], grossRevenue: '100', discounts: '70', returns: '20', creditSales: '30' }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toEqual(
        expect.arrayContaining([
          'Total customers cannot be less than new plus returning customers',
          'Credit sales cannot exceed net revenue',
        ])
      );
    }
  });

  it('requires submitted payments to reconcile but permits incomplete drafts', () => {
    const submitted = saveDailyReportSchema.safeParse({
      ...validReport,
      payments: [{ paymentMethodId: 1, amount: '1000' }],
    });
    expect(submitted.success).toBe(false);
    if (!submitted.success) {
      expect(submitted.error.issues.map((issue) => issue.message)).toContain(
        'Payment total must match net cash sales before this report can be submitted'
      );
    }
    expect(
      saveDailyReportSchema.safeParse({ ...validReport, status: 'draft', payments: [] }).success
    ).toBe(true);
  });

  it('requires a reason when Finance reopens an approved report', () => {
    expect(dailyReportDecisionSchema.safeParse({ action: 'reopen', lockVersion: 2 }).success).toBe(false);
    expect(
      dailyReportDecisionSchema.safeParse({ action: 'reopen', lockVersion: 2, reason: 'Correcting payment split' }).success
    ).toBe(true);
  });
});

describe('public survey contract', () => {
  const base = { storeId: 2, category: 'overall' as const, npsScore: 9 };

  it('accepts anonymous feedback without contact details', () => {
    expect(publicSurveySchema.safeParse(base).success).toBe(true);
  });

  it('requires consent and contact value before storing contact details', () => {
    expect(publicSurveySchema.safeParse({ ...base, contactValue: 'customer@example.com' }).success).toBe(false);
    expect(publicSurveySchema.safeParse({ ...base, contactConsent: true }).success).toBe(false);
    expect(publicSurveySchema.safeParse({ ...base, contactConsent: true, contactValue: 'customer@example.com' }).success).toBe(true);
  });
});

describe('user update contract', () => {
  it('requires both a change and an optimistic concurrency timestamp', () => {
    expect(updateUserSchema.safeParse({ active: false }).success).toBe(false);
    expect(updateUserSchema.safeParse({ expectedUpdatedAt: '2026-07-11T17:00:00.123Z' }).success).toBe(false);
    expect(updateUserSchema.safeParse({ active: false, expectedUpdatedAt: '2026-07-11T17:00:00.123Z' }).success).toBe(true);
  });
});
