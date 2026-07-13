import { describe, expect, it } from 'vitest';
import type {
  DailyReportMutationRecord,
  DailyReportRecord,
  DailyReportReferences,
} from './contracts/daily-report';
import {
  buildDailyReportInput,
  calculateDailyReportTotals,
  createDailyReportDraft,
  createSavedDailyReportRecord,
  mergeDailyReportsResponses,
  type DailyReportDraft,
  upsertDailyReport,
} from './daily-report-form';

const references: DailyReportReferences = {
  store: { id: 5, code: 'labone-men', name: 'Labone Men' },
  categories: [
    { id: 10, code: 'shoes', name: 'Shoes', available: true },
    { id: 11, code: 'shirts', name: 'Shirts', available: true },
  ],
  paymentMethods: [
    { id: 20, code: 'cash', name: 'Cash', available: true },
    { id: 21, code: 'card', name: 'Card', available: true },
  ],
};

const report: DailyReportRecord = {
  id: 99,
  storeId: 5,
  storeCode: 'labone-men',
  storeName: 'Labone Men',
  businessDate: '2026-07-10',
  status: 'draft',
  transactions: 3,
  footfall: 5,
  totalCustomers: 3,
  newCustomers: 1,
  returningCustomers: 2,
  notes: 'Quiet morning',
  lockVersion: 2,
  submittedAt: null,
  approvedAt: null,
  updatedAt: '2026-07-10T12:00:00.000Z',
  sales: [
    {
      categoryId: 10,
      openingStock: 12,
      unitsSold: 2,
      grossRevenue: '500.00',
      cogs: '250.00',
      discounts: '20.00',
      returns: '0.00',
      creditSales: '80.00',
    },
  ],
  payments: [{ paymentMethodId: 20, amount: '400.00' }],
  activity: [],
};

describe('daily report form helpers', () => {
  it('hydrates every configured option without losing existing lines', () => {
    const draft = createDailyReportDraft('2026-07-10', references, report);
    expect(draft.sales).toHaveLength(2);
    expect(draft.sales[0]).toMatchObject({ categoryId: 10, grossRevenue: '500.00' });
    expect(draft.sales[1]).toMatchObject({ categoryId: 11, grossRevenue: '' });
    expect(draft.payments).toHaveLength(2);
    expect(draft.transactions).toBe('3');
  });

  it('keeps unavailable historical options only on reports that already use them', () => {
    const historicalReferences: DailyReportReferences = {
      ...references,
      categories: [
        ...references.categories,
        { id: 12, code: 'retired', name: 'Retired category', available: false },
      ],
      paymentMethods: [
        ...references.paymentMethods,
        { id: 22, code: 'retired-pay', name: 'Retired payment', available: false },
      ],
    };
    const historicalReport: DailyReportRecord = {
      ...report,
      sales: [...report.sales, { ...report.sales[0], categoryId: 12 }],
      payments: [...report.payments, { paymentMethodId: 22, amount: '25.00' }],
    };

    expect(createDailyReportDraft('2026-07-10', historicalReferences).sales).toHaveLength(2);
    const draft = createDailyReportDraft('2026-07-10', historicalReferences, historicalReport);
    expect(draft.sales.map((line) => line.categoryId)).toEqual([10, 11, 12]);
    expect(draft.payments.map((line) => line.paymentMethodId)).toEqual([20, 21, 22]);
  });

  it('omits untouched rows and normalizes submitted money', () => {
    const draft = createDailyReportDraft('2026-07-10', references);
    draft.sales[0] = {
      categoryId: 10,
      openingStock: '20',
      unitsSold: '2',
      grossRevenue: '500',
      cogs: '250',
      discounts: '',
      returns: '',
      creditSales: '80',
    };
    draft.payments[0].amount = '420';
    const input = buildDailyReportInput(draft, 'submitted');

    expect(input.sales).toEqual([
      {
        categoryId: 10,
        openingStock: 20,
        unitsSold: 2,
        grossRevenue: '500.00',
        cogs: '250.00',
        discounts: '0.00',
        returns: '0.00',
        creditSales: '80.00',
      },
    ]);
    expect(input.payments).toEqual([{ paymentMethodId: 20, amount: '420.00' }]);
  });

  it('calculates the expected payment and variance from net less credit', () => {
    const draft = createDailyReportDraft('2026-07-10', references, report);
    const totals = calculateDailyReportTotals(draft);
    expect(totals).toMatchObject({
      grossCents: 50_000,
      discountCents: 2_000,
      netCents: 48_000,
      creditCents: 8_000,
      expectedPaymentsCents: 40_000,
      paymentsCents: 40_000,
      paymentVarianceCents: 0,
      unitsSold: 2,
    });
  });

  it('rejects inconsistent customer counts and an empty sales report', () => {
    const draft: DailyReportDraft = {
      ...createDailyReportDraft('2026-07-10', references),
      totalCustomers: '1',
      newCustomers: '1',
      returningCustomers: '1',
    };
    expect(() => buildDailyReportInput(draft, 'draft')).toThrow('Total customers cannot be less');
  });

  it('creates and upserts a local saved record when a refresh cannot complete', () => {
    const input = buildDailyReportInput(
      createDailyReportDraft('2026-07-10', references, report),
      'submitted',
      report.lockVersion
    );
    const mutation: DailyReportMutationRecord = {
      id: report.id,
      lockVersion: 3,
      status: 'submitted',
      salesCount: 1,
      paymentCount: 1,
    };
    const saved = createSavedDailyReportRecord(
      input,
      mutation,
      references,
      report,
      '2026-07-10T13:00:00.000Z'
    );

    expect(saved).toMatchObject({
      id: 99,
      status: 'submitted',
      lockVersion: 3,
      submittedAt: '2026-07-10T13:00:00.000Z',
    });
    expect(upsertDailyReport([report], saved)).toEqual([saved]);
  });

  it('merges an explicitly selected historical report into capped recent history', () => {
    const historicalReport: DailyReportRecord = {
      ...report,
      id: 100,
      businessDate: '2024-01-05',
      sales: [{ ...report.sales[0], categoryId: 12 }],
    };
    const historicalCategory = {
      id: 12,
      code: 'retired',
      name: 'Retired category',
      available: false,
    };
    const merged = mergeDailyReportsResponses(
      { reports: [report], references },
      {
        reports: [historicalReport],
        references: {
          ...references,
          categories: [...references.categories, historicalCategory],
        },
      }
    );

    expect(merged.reports.map((item) => item.id)).toEqual([99, 100]);
    expect(merged.references.categories).toContainEqual(historicalCategory);
  });
});
