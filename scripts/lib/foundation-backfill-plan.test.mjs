import { describe, expect, it } from 'vitest';
import {
  buildFoundationBackfillPlan,
  legacyCount,
  normalizeLegacyCustomerCounts,
  validLegacyCount,
} from './foundation-backfill-plan.mjs';

const org = {
  stores: [{ value: 'labone-men', label: 'Labone Men' }],
  brands: [{ value: 'boulevard-men', label: 'Boulevard Men' }],
  categories: [{ value: 'formal-shirts', label: 'Formal Shirts' }],
  subCategories: [],
  expenseItems: [{ value: 'rent', label: 'Rent', group: 'operating' }],
};

describe('foundation backfill planner', () => {
  it('groups category rows into one store-day report without multiplying header counts', () => {
    const plan = buildFoundationBackfillPlan(org, [
      {
        id: 1,
        department: 'finance',
        form_type: 'revenue',
        created_at: '2026-07-10T10:00:00Z',
        payload: {
          store: 'labone-men',
          date: '2026-07-10',
          category: 'formal-shirts',
          grossRevenue: '100.50',
          cogs: '40',
          discounts: '5',
          creditSales: '10',
          itemsSold: '2',
          transactions: '8',
          footfall: '12',
        },
      },
      {
        id: 2,
        department: 'finance',
        form_type: 'revenue',
        created_at: '2026-07-10T11:00:00Z',
        payload: {
          store: 'labone-men',
          date: '2026-07-10',
          category: 'formal-shirts',
          grossRevenue: '49.50',
          cogs: '20',
          itemsSold: '1',
          transactions: '8',
          footfall: '12',
        },
      },
      {
        id: 3,
        department: 'finance',
        form_type: 'closing',
        created_at: '2026-07-10T19:00:00Z',
        payload: { store: 'labone-men', date: '2026-07-10', pay_cash: '135' },
      },
    ]);
    expect(plan.dailyReports).toMatchObject({ reports: 1, salesLines: 1, paymentLines: 1, legacyLinks: 3 });
    expect(plan.parity).toMatchObject({
      grossRevenue: '150.00',
      unitsSold: 3,
      transactionsBefore: 16,
      transactionsAfterHeaderDeduplication: 8,
      footfallBefore: 24,
      footfallAfterHeaderDeduplication: 12,
    });
    expect(plan.blockers).toEqual({
      stores: [],
      categories: [],
      dates: [],
      numbers: [],
      masterData: [],
      subcategories: [],
      expenseCategories: [],
      relationships: [],
    });
  });

  it('uses the same legacy count and customer normalization as the converter', () => {
    expect(validLegacyCount('12.9')).toBe(true);
    expect(legacyCount('12.9')).toBe(12);
    expect(normalizeLegacyCustomerCounts('4', '3', '2')).toEqual({
      totalCustomers: 5,
      newCustomers: 3,
      returningCustomers: 2,
    });
  });

  it('preserves closing-only days and links every repeated closing source row', () => {
    const plan = buildFoundationBackfillPlan(org, [
      {
        id: 10,
        department: 'finance',
        form_type: 'closing',
        created_at: '2026-07-10T18:00:00Z',
        payload: { store: 'labone-men', date: '2026-07-10', pay_cash: '100' },
      },
      {
        id: 11,
        department: 'finance',
        form_type: 'closing',
        created_at: '2026-07-10T19:00:00Z',
        payload: {
          store: 'labone-men',
          date: '2026-07-10',
          customers: '4',
          newCustomers: '3',
          returningCustomers: '2',
          pay_cash: '125',
        },
      },
    ]);

    expect(plan.dailyReports).toMatchObject({
      reports: 1,
      salesLines: 0,
      paymentLines: 1,
      legacyLinks: 2,
      closingWithoutSales: 1,
    });
    expect(plan.blockers.numbers).toEqual([]);
  });

  it('reports unresolved references and product classification gaps without inventing records', () => {
    const plan = buildFoundationBackfillPlan(org, [
      {
        id: 4,
        department: 'finance',
        form_type: 'revenue',
        created_at: '2026-07-10T10:00:00Z',
        payload: {
          store: 'unknown-store',
          date: '2026-02-30',
          category: 'unknown-category',
          grossRevenue: 'not-a-number',
        },
      },
      {
        id: 5,
        department: 'commercial',
        form_type: 'sku-entry',
        created_at: '2026-07-10T10:00:00Z',
        payload: { sku: 'ABC-1', name: 'Unclassified product' },
      },
    ]);
    expect(plan.dailyReports.reports).toBe(0);
    expect(plan.products).toMatchObject({ candidates: 1, classified: 0, unclassified: 1 });
    expect(plan.blockers).toEqual({
      stores: ['unknown-store'],
      categories: ['unknown-category'],
      dates: ['2026-02-30'],
      numbers: ['4:grossRevenue'],
      masterData: [],
      subcategories: [],
      expenseCategories: [],
      relationships: [],
    });
  });

  it('normalizes the known historical relationship aliases without changing master codes', () => {
    const plan = buildFoundationBackfillPlan({
      ...org,
      stores: [
        ...org.stores,
        { value: 'dzorwulu-women', label: 'Dzorwulu Women' },
        { value: 'labone-women', label: 'Labone Women' },
      ],
      brandStores: { 'boulevard-men': ['a'], 'boulevard-women': ['bw-dzorwulu', 'bw-labone'] },
      brandCategories: { 'boulevard-men': ['a'], 'boulevard-women': ['formal-shirts', 'd'] },
      brands: [...org.brands, { value: 'boulevard-women', label: 'Boulevard Women' }],
    }, []);

    expect(plan.blockers.relationships).toEqual([]);
    expect(plan.masters).toMatchObject({ stores: 3, brands: 2, categories: 1 });
  });
});
