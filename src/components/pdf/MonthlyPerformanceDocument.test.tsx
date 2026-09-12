import React from 'react';
import { writeFile } from 'node:fs/promises';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { pdf } from '@react-pdf/renderer';
import type { MonthlyReviewContext } from '@/lib/monthly-reviews';
import { MonthlyPerformanceDocument } from './MonthlyPerformanceDocument';

// Vitest's standalone TSX transform does not use Next's automatic JSX runtime.
beforeAll(() => vi.stubGlobal('React', React));
afterAll(() => vi.unstubAllGlobals());

it('renders a long cluster report with large stock tables and commentary across A4 pages', async () => {
  const narrative =
    'The manager recorded customer follow-ups and reviewed category performance against the dated sales records. ';
  const stores = [1, 2].map((id) => ({
    store: { id, name: id === 1 ? 'Carbon QA store' : 'D’Angelo QA store' },
    report: {
      managerName: 'Local verification manager',
      totals: {
        netRevenue: 12345.67 * id,
        unitsSold: 80,
        transactions: 20,
        footfall: 100,
      },
      target: 15000,
      days: [{ date: '2026-08-03', netRevenue: 12345.67 * id }],
      categories: [
        {
          categoryId: 1,
          unitsSold: 80,
          grossRevenue: 12345.67 * id,
          netRevenue: 12345.67 * id,
        },
      ],
      transactionSummary: {},
      notes: [
        {
          date: '2026-08-03',
          notes: narrative,
          staffPerformanceNote: 'Advisor follow-ups completed',
          closingFacilityStatus: 'Facility secured',
        },
      ],
      customerRequests: [
        {
          interest: 'Premium leather shoes, size 43',
          fulfillmentStatus: 'stock_gap',
          stockGapQuantity: 2,
        },
      ],
    },
  }));
  const products = Array.from({ length: 45 }, (_, i) => ({
    storeId: (i % 2) + 1,
    storeName: stores[i % 2].store.name,
    productId: i + 1,
    name: `Verification premium product ${i + 1}`,
    sku: `QA-${i + 1}`,
    categoryId: 1,
    categoryName: 'Footwear',
    unitsSold: 45 - i,
    salesValue: ((45 - i) * 350).toFixed(2),
    returnedUnits: 0,
    sellingPrice: i === 44 ? null : '350.00',
    quantity: 10,
    available: 8,
    reserved: 2,
    lastSale: '2026-08-01',
    historyComplete: true,
    warnings:
      i === 44
        ? ['Selling price is missing; risk valuation is incomplete.']
        : [],
    bands: {
      days0to30: 0,
      days31to60: 0,
      days61to90: 0,
      over90: 10,
      unknown: 0,
    },
    oldestAge: 91,
    observationDays: 91,
    daysSinceSale: 30,
    nonMoving: i > 30,
    riskQuantity: 10,
    riskValue: i === 44 ? null : '3500.00',
  }));
  const context = {
    name: 'Carbon & D’Angelo — verification cluster',
    currency: 'GHS',
    range: { from: '2026-08-01', to: '2026-08-31', label: 'August 2026' },
    nextRange: {
      from: '2026-09-01',
      to: '2026-09-30',
      label: 'September 2026',
    },
    stores,
    totalSales: 37037.01,
    totalTarget: 30000,
    weeks: [{ from: '2026-08-03', to: '2026-08-08' }],
    categories: [{ id: 1, name: 'Footwear' }],
    review: {
      executiveSummary: narrative.repeat(15),
      managementOutcomes: narrative.repeat(12),
      operationalAssessment: narrative.repeat(5),
      conclusion: narrative.repeat(3),
      storeComments: {},
      advisors: [
        {
          storeId: 1,
          name: 'QA Advisor',
          actualSales: '10000',
          target: '15000',
        },
      ],
      actions: [],
    },
    performance: {
      from: '2026-08-01',
      to: '2026-08-31',
      asOf: '2026-08-31',
      rows: products,
      unmatched: [
        {
          storeId: 1,
          categoryId: 1,
          name: 'Unmatched QA product',
          units: 1,
          value: '120.00',
        },
      ],
      incompleteReportCount: 1,
    },
    nextTargets: [
      { storeId: 1, target: 15000 },
      { storeId: 2, target: 15000 },
    ],
    carriedActions: [],
    summary: {
      facts: ['Combined sales GHS 37,037.01 against GHS 30,000.00 target.'],
      evidence: [],
    },
    weeklyReviews: stores.map(({ store }) => ({
      id: store.id,
      storeId: store.id,
      storeName: store.name,
      status: 'submitted',
      weekFrom: '2026-08-03',
      weekTo: '2026-08-08',
      summary: narrative.repeat(12),
      risks: 'Recorded stock gaps',
      categoryNotes: [
        {
          id: store.id,
          categoryId: 1,
          performanceComment: narrative.repeat(60),
          correctiveAction: 'Follow up requested sizes',
          managerComment: narrative.repeat(10),
          valueAtRisk: '3500.00',
        },
      ],
      actions: [],
    })),
  } as unknown as MonthlyReviewContext;
  const warnings = vi.spyOn(console, 'warn');
  const stream = await pdf(
    MonthlyPerformanceDocument({ context, currency: 'GHS' })
  ).toBuffer();
  const chunks: Buffer[] = [];
  for await (const chunk of stream)
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const buffer = Buffer.concat(chunks);
  expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  expect(
    (buffer.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length
  ).toBeGreaterThan(4);
  expect(warnings.mock.calls.flat().join(' ')).not.toMatch(
    /can't wrap|larger than available page/i
  );
  warnings.mockRestore();
  if (process.env.PERFORMANCE_QA_PDF)
    await writeFile(process.env.PERFORMANCE_QA_PDF, buffer);
}, 120000);
