import { describe, expect, it } from 'vitest';
import { buildFoundationBackfillPlan } from './foundation-backfill-plan.mjs';

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
});
