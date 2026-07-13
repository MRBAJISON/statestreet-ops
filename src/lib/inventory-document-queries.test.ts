import { describe, expect, it, vi } from 'vitest';
import type { AppUser } from './auth';
import { getInventoryDocumentReadScope } from './inventory-document-queries';

vi.mock('./db', () => ({ db: {} }));

function user(overrides: Partial<AppUser> = {}): AppUser {
  return {
    id: '12',
    name: 'Inventory User',
    email: 'inventory@example.com',
    role: 'inventory',
    department: 'inventory',
    ...overrides,
  };
}

describe('inventory document read scopes', () => {
  it.each(['stock-transfer', 'goods-receipt', 'stock-count', 'replenishment'] as const)(
    'allows Inventory to read all %s documents',
    (document) => {
      expect(getInventoryDocumentReadScope(document, user())).toEqual({
        allStores: true,
        storeCode: null,
      });
    }
  );

  it.each(['stock-transfer', 'goods-receipt', 'stock-count', 'replenishment'] as const)(
    'preserves Operations access to all %s documents',
    (document) => {
      expect(
        getInventoryDocumentReadScope(
          document,
          user({ role: 'operations', department: 'operations' })
        )
      ).toEqual({ allStores: true, storeCode: null });
    }
  );

  it.each(['stock-transfer', 'replenishment'] as const)(
    'scopes store managers to their assigned store for %s history',
    (document) => {
      expect(
        getInventoryDocumentReadScope(
          document,
          user({ role: 'store-manager', department: 'commercial', store: 'labone-men' })
        )
      ).toEqual({ allStores: false, storeCode: 'labone-men' });
    }
  );

  it.each(['goods-receipt', 'stock-count'] as const)(
    'does not expose %s history to store managers',
    (document) => {
      expect(() =>
        getInventoryDocumentReadScope(
          document,
          user({ role: 'store-manager', department: 'commercial', store: 'labone-men' })
        )
      ).toThrowError(expect.objectContaining({ status: 403 }));
    }
  );

  it('requires an assigned store for store-scoped history', () => {
    expect(() =>
      getInventoryDocumentReadScope(
        'stock-transfer',
        user({ role: 'store-manager', department: 'commercial', store: undefined })
      )
    ).toThrowError(expect.objectContaining({ status: 403 }));
  });

  it('rejects roles without an inventory document workflow', () => {
    expect(() =>
      getInventoryDocumentReadScope(
        'stock-transfer',
        user({ role: 'commercial', department: 'commercial' })
      )
    ).toThrowError(expect.objectContaining({ status: 403 }));
  });
});
