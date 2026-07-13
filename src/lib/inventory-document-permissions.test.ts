import { describe, expect, it, vi } from 'vitest';
import { canCreateInventoryDocument } from './inventory-documents';

vi.mock('./db', () => ({ db: {} }));

describe('inventory document creation roles', () => {
  it.each(['stock-transfer', 'goods-receipt', 'stock-count', 'replenishment'] as const)(
    'preserves Operations creation access for %s',
    (document) => {
      expect(canCreateInventoryDocument(document, 'operations')).toBe(true);
    }
  );

  it('keeps store managers limited to store-originated requests', () => {
    expect(canCreateInventoryDocument('stock-transfer', 'store-manager')).toBe(true);
    expect(canCreateInventoryDocument('replenishment', 'store-manager')).toBe(true);
    expect(canCreateInventoryDocument('goods-receipt', 'store-manager')).toBe(false);
    expect(canCreateInventoryDocument('stock-count', 'store-manager')).toBe(false);
  });
});
