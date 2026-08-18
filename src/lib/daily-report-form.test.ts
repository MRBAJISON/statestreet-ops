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
  managerName: 'Labone Men Manager',
  businessDate: '2026-07-10',
  status: 'draft',
  transactions: 3,
  footfall: 5,
  totalCustomers: 3,
  newCustomers: 1,
  returningCustomers: 2,
  notes: 'Quiet morning',
  staffPerformanceNote: 'Team handled the morning rush well',
  closingFacilityStatus: 'Locked and alarmed at 9pm',
  noSales: false,
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
      products: [
        { productId: 501, productName: 'Test Product', sku: 'TP-1', brandName: 'TestBrand', unitsSold: 1, lineValue: '150.00', valueOverridden: false },
        { productId: null, productName: 'Custom item', sku: null, brandName: null, unitsSold: 1, lineValue: '200.00', valueOverridden: true },
      ],
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
    expect(draft.staffPerformanceNote).toBe('Team handled the morning rush well');
    expect(draft.closingFacilityStatus).toBe('Locked and alarmed at 9pm');
    expect(draft.sales[0].products.map((product) => product.name)).toEqual(['Test Product', 'Custom item']);
    expect(draft.sales[0].products.map((product) => product.unitsSold)).toEqual(['1', '1']);
    // The saved value carries no catalogue price, so it is recovered from the line
    // so that changing the units still recalculates.
    expect(draft.sales[0].products[0].unitPrice).toBe('150.00');
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
      products: [],
      totalsOverridden: false,
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
        products: [],
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

  it('refuses an empty report unless the day is marked as having no sales', () => {
    const draft = createDailyReportDraft('2026-07-10', references);
    expect(() => buildDailyReportInput(draft, 'submitted')).toThrow('mark the day as having no sales');
  });

  it('submits a no-sales day with no lines at all', () => {
    const draft: DailyReportDraft = { ...createDailyReportDraft('2026-07-10', references), noSales: true };
    const input = buildDailyReportInput(draft, 'submitted');
    expect(input.noSales).toBe(true);
    // No phantom zero row against a category that never traded, which is the
    // whole reason the flag exists.
    expect(input.sales).toEqual([]);
  });

  it('drops half-typed sales when the day is marked as having no sales', () => {
    const draft = createDailyReportDraft('2026-07-10', references);
    draft.sales[0] = { ...draft.sales[0], unitsSold: '3', grossRevenue: '120' };
    draft.noSales = true;
    expect(buildDailyReportInput(draft, 'draft').sales).toEqual([]);
  });

  it('creates and upserts a local saved record when a refresh cannot complete', () => {
    const draft = createDailyReportDraft('2026-07-10', references, report);
    const input = buildDailyReportInput(draft, 'submitted', report.lockVersion);
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
    // The offline record is built from the save payload, which carries a catalogue
    // product by id rather than by name, so the name is blank until the next
    // successful refresh replaces this record with the server's.
    expect(saved.sales[0].products).toEqual([
      { productId: 501, productName: '', sku: null, brandName: null, unitsSold: 1, lineValue: '150.00', valueOverridden: false },
      { productId: null, productName: 'Custom item', sku: null, brandName: null, unitsSold: 1, lineValue: '200.00', valueOverridden: true },
    ]);
    expect(upsertDailyReport([report], saved)).toEqual([saved]);
  });

  it('rejects product lines that add up to more than the category total', () => {
    const draft = createDailyReportDraft('2026-07-10', references);
    draft.sales[0] = {
      ...draft.sales[0],
      unitsSold: '2',
      grossRevenue: '500',
      cogs: '250',
      products: [
        { key: 'a', productId: 601, name: 'Blue Oxford Shirt', sku: 'BOS-1', unitsSold: '5', lineValue: '100.00', valueOverridden: false, unitPrice: '20.00' },
      ],
      totalsOverridden: true,
    };
    expect(() => buildDailyReportInput(draft, 'draft')).toThrow('more units than the category total');
  });

  it('allows product lines that add up to less than the category total', () => {
    const draft = createDailyReportDraft('2026-07-10', references);
    draft.sales[0] = {
      ...draft.sales[0],
      unitsSold: '5',
      grossRevenue: '500',
      cogs: '250',
      products: [
        { key: 'a', productId: 601, name: 'Blue Oxford Shirt', sku: 'BOS-1', unitsSold: '2', lineValue: '100.00', valueOverridden: false, unitPrice: '50.00' },
      ],
      totalsOverridden: true,
    };
    // Attribution is partial by design: a manager who forgets an item must still be
    // able to close the day.
    expect(buildDailyReportInput(draft, 'draft').sales[0].unitsSold).toBe(5);
  });

  it('maps catalogue and free-typed product lines onto the saved shape', () => {
    const draft = createDailyReportDraft('2026-07-10', references);
    draft.sales[0] = {
      ...draft.sales[0],
      unitsSold: '3',
      grossRevenue: '500',
      cogs: '250',
      products: [
        { key: 'a', productId: 601, name: 'Blue Oxford Shirt', sku: 'BOS-1', unitsSold: '2', lineValue: '300.00', valueOverridden: false, unitPrice: '150.00' },
        { key: 'b', productId: null, name: '  Grey Blazer  ', sku: null, unitsSold: '1', lineValue: '200.00', valueOverridden: true, unitPrice: null },
      ],
      totalsOverridden: true,
    };
    const input = buildDailyReportInput(draft, 'draft');
    expect(input.sales[0].products).toEqual([
      { productId: 601, unitsSold: 2, lineValue: '300.00', valueOverridden: false },
      { customName: 'Grey Blazer', unitsSold: 1, lineValue: '200.00', valueOverridden: true },
    ]);
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
