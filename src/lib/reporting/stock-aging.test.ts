import { describe, expect, it } from 'vitest';
import {
  classifyStock,
  replayStock,
  reconcileOpeningLots,
  type StockEvent,
} from './stock-aging';

describe('automatic stock aging', () => {
  it('reconciles imported opening stock before FIFO consumes known receipts', () => {
    const result = reconcileOpeningLots(
      [{ storeId: 1, productId: 1, quantity: 100 }],
      [
        {
          key: 'receipt',
          storeId: 1,
          productId: 1,
          date: '2026-08-01',
          kind: 'receipt',
          quantity: 10,
          receiptDate: '2026-08-01',
        },
        {
          key: 'sale',
          storeId: 1,
          productId: 1,
          date: '2026-08-02',
          kind: 'sale',
          quantity: -5,
        },
      ],
      '2026-09-12'
    );
    expect(result.get('1:1')).toEqual([
      { quantity: 90, receiptDate: '2026-07-01', assumed: true },
      { quantity: 10, receiptDate: '2026-08-01', assumed: false },
    ]);
  });
  it('uses the 30 day inactivity and 90/91 day aging boundaries without double counting', () => {
    const input = {
      lots: [{ quantity: 4, receiptDate: '2026-07-01', assumed: true }],
      asOf: '2026-09-29',
      lastSale: '2026-09-01',
      observedFrom: '2026-07-01',
      historyComplete: true,
      sellingPrice: '12.50',
    };
    expect(classifyStock(input)).toMatchObject({
      oldestAge: 90,
      nonMoving: false,
      riskQuantity: 0,
    });
    expect(classifyStock({ ...input, asOf: '2026-09-30' })).toMatchObject({
      oldestAge: 91,
      riskQuantity: 4,
      riskValue: '50.00',
    });
    expect(classifyStock({ ...input, asOf: '2026-10-01' })).toMatchObject({
      nonMoving: true,
      riskQuantity: 4,
      riskValue: '50.00',
    });
  });
  it('does not classify incomplete history or new stock as non-moving, and preserves missing prices', () => {
    const input = {
      lots: [{ quantity: 4, receiptDate: '2026-07-01', assumed: true }],
      asOf: '2026-07-30',
      lastSale: null,
      observedFrom: '2026-07-01',
      historyComplete: true,
      sellingPrice: null,
    };
    expect(classifyStock(input).nonMoving).toBe(false);
    expect(classifyStock({ ...input, asOf: '2026-07-31' }).nonMoving).toBe(
      true
    );
    expect(
      classifyStock({ ...input, asOf: '2026-10-01', historyComplete: false })
    ).toMatchObject({ nonMoving: false, riskValue: null });
  });
  it('takes oldest stock first and carries receipt dates between stores', () => {
    const events: StockEvent[] = [
      {
        key: 'a',
        storeId: 1,
        productId: 1,
        date: '2026-07-01',
        kind: 'receipt',
        receiptDate: '2026-07-01',
        quantity: 5,
      },
      {
        key: 'b',
        storeId: 1,
        productId: 1,
        date: '2026-08-01',
        kind: 'receipt',
        receiptDate: '2026-08-01',
        quantity: 5,
      },
      {
        key: 'c',
        storeId: 1,
        productId: 1,
        date: '2026-08-02',
        kind: 'transfer-out',
        transferKey: 'T1',
        quantity: -7,
      },
      {
        key: 'd',
        storeId: 2,
        productId: 1,
        date: '2026-08-03',
        kind: 'transfer-in',
        transferKey: 'T1',
        quantity: 7,
      },
    ];
    const result = replayStock([...events, events[3]], '2026-08-04');
    expect(result.get('1:1')?.quantity).toBe(3);
    expect(result.get('2:1')?.lots).toEqual([
      { quantity: 5, receiptDate: '2026-07-01', assumed: false },
      { quantity: 2, receiptDate: '2026-08-01', assumed: false },
    ]);
  });
});
