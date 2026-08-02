import { describe, expect, it } from 'vitest';
import {
  customerCaptureSchema,
  expenseSchema,
  feedbackSchema,
  leadMetricSchema,
  performanceTargetSchema,
} from './workflows';
import { goodsReceiptSchema, stockTransferSchema, weeklyReviewSchema } from './documents';
import { customerContactRetentionWindow } from '../customer-contact-retention';

describe('typed workflow contracts', () => {
  it('normalizes expense money and rejects empty descriptions', () => {
    expect(
      expenseSchema.parse({
        businessDate: '2026-07-11',
        expenseCategoryId: 2,
        amount: '1250.5',
        description: 'Courier and freight handling',
      }).amount
    ).toBe('1250.50');
    expect(
      expenseSchema.safeParse({
        businessDate: '2026-07-11',
        expenseCategoryId: 2,
        amount: '1250',
        description: ' ',
      }).success
    ).toBe(false);
  });

  it('keeps target references consistent with scope', () => {
    const base = {
      metric: 'net-revenue',
      periodType: 'week',
      periodStart: '2026-07-06',
      periodEnd: '2026-07-12',
      value: '200000',
      unit: 'money',
    } as const;
    expect(performanceTargetSchema.safeParse({ ...base, scopeType: 'store', storeId: 4 }).success).toBe(true);
    expect(performanceTargetSchema.safeParse({ ...base, scopeType: 'store' }).success).toBe(false);
    expect(performanceTargetSchema.safeParse({ ...base, scopeType: 'group', brandId: 2 }).success).toBe(false);
  });

  it('rejects impossible funnel counts and contact storage without consent', () => {
    expect(
      leadMetricSchema.safeParse({
        businessDate: '2026-07-11',
        channel: 'Instagram',
        leadCount: 20,
        qualifiedCount: 15,
        convertedCount: 18,
      }).success
    ).toBe(false);
    expect(
      feedbackSchema.safeParse({
        businessDate: '2026-07-11',
        source: 'Survey',
        type: 'complaint',
        detail: 'Customer requested a follow-up.',
        contactValue: '+233200000000',
      }).success
    ).toBe(false);
    expect(
      feedbackSchema.safeParse({
        businessDate: '2026-07-11',
        source: 'Survey',
        type: 'complaint',
        detail: 'Customer name was recorded without a follow-up policy.',
        contactName: 'Unconsented Contact',
      }).success
    ).toBe(false);
  });

  it('limits consented contact retention to the current 90-day window', () => {
    const retention = customerContactRetentionWindow();
    const base = {
      businessDate: retention.from,
      source: 'In store',
      type: 'request',
      detail: 'Customer requested a follow-up.',
      contactValue: '+233200000000',
      contactConsent: true,
    };
    const yesterday = new Date(`${retention.from}T00:00:00.000Z`);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const afterWindow = new Date(`${retention.to}T00:00:00.000Z`);
    afterWindow.setUTCDate(afterWindow.getUTCDate() + 1);

    expect(feedbackSchema.safeParse({ ...base, retentionUntil: retention.to }).success).toBe(true);
    expect(feedbackSchema.safeParse({ ...base, retentionUntil: yesterday.toISOString().slice(0, 10) }).success).toBe(false);
    expect(feedbackSchema.safeParse({ ...base, retentionUntil: afterWindow.toISOString().slice(0, 10) }).success).toBe(false);
  });

  it('requires customer interest and accepts either a product or free text', () => {
    const base = {
      businessDate: '2026-07-11',
      name: 'Demo Customer',
      phone: '+233200000000',
      lifecycle: 'lead',
      source: 'walk-in',
    } as const;
    expect(customerCaptureSchema.safeParse(base).success).toBe(false);
    expect(customerCaptureSchema.safeParse({ ...base, productId: 3 }).success).toBe(true);
  });

  it('accepts an optional in-stock/stock-gap fulfillment status', () => {
    const base = {
      businessDate: '2026-07-11',
      name: 'Demo Customer',
      phone: '+233200000000',
      lifecycle: 'lead',
      source: 'walk-in',
      productId: 3,
    } as const;
    expect(customerCaptureSchema.parse(base).fulfillmentStatus).toBeUndefined();
    expect(customerCaptureSchema.parse({ ...base, fulfillmentStatus: 'in_stock' }).fulfillmentStatus).toBe('in_stock');
    expect(customerCaptureSchema.parse({ ...base, fulfillmentStatus: 'stock_gap' }).fulfillmentStatus).toBe('stock_gap');
    expect(customerCaptureSchema.safeParse({ ...base, fulfillmentStatus: 'backordered' }).success).toBe(false);
  });
});

describe('document contracts', () => {
  it('rejects duplicate products in transfer and receipt lines', () => {
    expect(
      stockTransferSchema.safeParse({
        businessDate: '2026-07-11',
        fromStoreId: 1,
        toStoreId: 2,
        reason: 'Replenishment',
        lines: [{ productId: 5, quantity: 2 }, { productId: 5, quantity: 1 }],
      }).success
    ).toBe(false);
    expect(
      goodsReceiptSchema.safeParse({
        businessDate: '2026-07-11',
        supplierId: 1,
        receivingStoreId: 9,
        lines: [
          { productId: 5, quantity: 2, condition: 'good' },
          { productId: 5, quantity: 1, condition: 'good' },
        ],
      }).success
    ).toBe(false);
  });

  it('requires an owner for every weekly action', () => {
    expect(
      weeklyReviewSchema.safeParse({
        weekEnd: '2026-07-12',
        actions: [{ action: 'Call top clients', status: 'open' }],
      }).success
    ).toBe(false);
  });
});
