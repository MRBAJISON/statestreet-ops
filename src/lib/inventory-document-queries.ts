import { and, desc, eq, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { AppUser } from './auth';
import type {
  InventoryDocumentLineRecord,
  InventoryDocumentName,
  InventoryDocumentRecord,
} from './contracts/documents';
import { db } from './db';
import {
  goodsReceiptLines,
  goodsReceipts,
  products,
  replenishmentRequestLines,
  replenishmentRequests,
  stockCountLines,
  stockCounts,
  stockTransferLines,
  stockTransfers,
  stores,
  suppliers,
} from './db/foundation-schema';
import { HttpError } from './server-errors';

const RECENT_DOCUMENT_LIMIT = 20;
const fromStores = alias(stores, 'inventory_document_from_stores');
const toStores = alias(stores, 'inventory_document_to_stores');

export interface InventoryDocumentReadScope {
  allStores: boolean;
  storeCode: string | null;
}

export function getInventoryDocumentReadScope(
  document: InventoryDocumentName,
  user: AppUser
): InventoryDocumentReadScope {
  if (user.role === 'inventory' || user.role === 'operations') {
    return { allStores: true, storeCode: null };
  }
  if (user.role !== 'store-manager' || !['stock-transfer', 'replenishment'].includes(document)) {
    throw new HttpError(403, 'Forbidden');
  }
  if (!user.store) throw new HttpError(403, 'No store is assigned to this account');
  return { allStores: false, storeCode: user.store };
}

async function resolveScopedStoreId(document: InventoryDocumentName, user: AppUser) {
  const scope = getInventoryDocumentReadScope(document, user);
  if (scope.allStores) return undefined;
  const [store] = await db
    .select({ id: stores.id })
    .from(stores)
    .where(and(eq(stores.code, scope.storeCode!), eq(stores.type, 'store'), eq(stores.active, true)))
    .limit(1);
  if (!store) throw new HttpError(409, 'The assigned store was not found or is inactive');
  return store.id;
}

function transferHeaders(storeId?: number, id?: number) {
  return db
    .select({
      id: stockTransfers.id,
      businessDate: stockTransfers.businessDate,
      status: stockTransfers.status,
      fromStoreName: fromStores.name,
      toStoreName: toStores.name,
      reason: stockTransfers.reason,
      notes: stockTransfers.notes,
      lineCount: sql<number>`(
        select count(*)::integer from stock_transfer_lines line
        where line.stock_transfer_id = ${stockTransfers.id}
      )`,
      totalQuantity: sql<number>`(
        select coalesce(sum(line.quantity), 0)::integer from stock_transfer_lines line
        where line.stock_transfer_id = ${stockTransfers.id}
      )`,
    })
    .from(stockTransfers)
    .innerJoin(fromStores, eq(stockTransfers.fromStoreId, fromStores.id))
    .innerJoin(toStores, eq(stockTransfers.toStoreId, toStores.id))
    .where(
      and(
        id ? eq(stockTransfers.id, id) : undefined,
        storeId
          ? or(eq(stockTransfers.fromStoreId, storeId), eq(stockTransfers.toStoreId, storeId))
          : undefined
      )
    )
    .orderBy(desc(stockTransfers.businessDate), desc(stockTransfers.updatedAt))
    .limit(id ? 1 : RECENT_DOCUMENT_LIMIT);
}

function goodsReceiptHeaders(id?: number) {
  return db
    .select({
      id: goodsReceipts.id,
      businessDate: goodsReceipts.businessDate,
      status: goodsReceipts.status,
      receivingStoreName: stores.name,
      supplierName: suppliers.name,
      poNumber: goodsReceipts.poNumber,
      notes: goodsReceipts.notes,
      lineCount: sql<number>`(
        select count(*)::integer from goods_receipt_lines line
        where line.goods_receipt_id = ${goodsReceipts.id}
      )`,
      totalQuantity: sql<number>`(
        select coalesce(sum(line.quantity), 0)::integer from goods_receipt_lines line
        where line.goods_receipt_id = ${goodsReceipts.id}
      )`,
    })
    .from(goodsReceipts)
    .innerJoin(stores, eq(goodsReceipts.receivingStoreId, stores.id))
    .innerJoin(suppliers, eq(goodsReceipts.supplierId, suppliers.id))
    .where(id ? eq(goodsReceipts.id, id) : undefined)
    .orderBy(desc(goodsReceipts.businessDate), desc(goodsReceipts.updatedAt))
    .limit(id ? 1 : RECENT_DOCUMENT_LIMIT);
}

function stockCountHeaders(id?: number) {
  return db
    .select({
      id: stockCounts.id,
      businessDate: stockCounts.businessDate,
      status: stockCounts.status,
      storeName: stores.name,
      notes: stockCounts.notes,
      lineCount: sql<number>`(
        select count(*)::integer from stock_count_lines line
        where line.stock_count_id = ${stockCounts.id}
      )`,
      totalQuantity: sql<number>`(
        select coalesce(sum(line.physical_quantity), 0)::integer from stock_count_lines line
        where line.stock_count_id = ${stockCounts.id}
      )`,
    })
    .from(stockCounts)
    .innerJoin(stores, eq(stockCounts.storeId, stores.id))
    .where(id ? eq(stockCounts.id, id) : undefined)
    .orderBy(desc(stockCounts.businessDate), desc(stockCounts.updatedAt))
    .limit(id ? 1 : RECENT_DOCUMENT_LIMIT);
}

function replenishmentHeaders(storeId?: number, id?: number) {
  return db
    .select({
      id: replenishmentRequests.id,
      businessDate: replenishmentRequests.businessDate,
      status: replenishmentRequests.status,
      storeName: stores.name,
      supplierName: suppliers.name,
      notes: replenishmentRequests.notes,
      lineCount: sql<number>`(
        select count(*)::integer from replenishment_request_lines line
        where line.replenishment_request_id = ${replenishmentRequests.id}
      )`,
      totalQuantity: sql<number>`(
        select coalesce(sum(line.reorder_quantity), 0)::integer from replenishment_request_lines line
        where line.replenishment_request_id = ${replenishmentRequests.id}
      )`,
    })
    .from(replenishmentRequests)
    .innerJoin(stores, eq(replenishmentRequests.storeId, stores.id))
    .leftJoin(suppliers, eq(replenishmentRequests.supplierId, suppliers.id))
    .where(
      and(
        id ? eq(replenishmentRequests.id, id) : undefined,
        storeId ? eq(replenishmentRequests.storeId, storeId) : undefined
      )
    )
    .orderBy(desc(replenishmentRequests.businessDate), desc(replenishmentRequests.updatedAt))
    .limit(id ? 1 : RECENT_DOCUMENT_LIMIT);
}

export async function listInventoryDocuments(
  document: InventoryDocumentName,
  user: AppUser
): Promise<InventoryDocumentRecord[]> {
  const storeId = await resolveScopedStoreId(document, user);
  if (document === 'stock-transfer') return transferHeaders(storeId);
  if (document === 'goods-receipt') return goodsReceiptHeaders();
  if (document === 'stock-count') return stockCountHeaders();
  return replenishmentHeaders(storeId);
}

async function documentLines(
  document: InventoryDocumentName,
  documentId: number
): Promise<InventoryDocumentLineRecord[]> {
  if (document === 'stock-transfer') {
    return db
      .select({
        id: stockTransferLines.id,
        productId: stockTransferLines.productId,
        productName: products.name,
        productSku: products.sku,
        quantity: stockTransferLines.quantity,
      })
      .from(stockTransferLines)
      .innerJoin(products, eq(stockTransferLines.productId, products.id))
      .where(eq(stockTransferLines.stockTransferId, documentId))
      .orderBy(products.name, products.sku);
  }
  if (document === 'goods-receipt') {
    const rows = await db
      .select({
        id: goodsReceiptLines.id,
        productId: goodsReceiptLines.productId,
        productName: products.name,
        productSku: products.sku,
        quantity: goodsReceiptLines.quantity,
        unitCost: goodsReceiptLines.unitCost,
        condition: goodsReceiptLines.condition,
        discrepancy: goodsReceiptLines.discrepancy,
      })
      .from(goodsReceiptLines)
      .innerJoin(products, eq(goodsReceiptLines.productId, products.id))
      .where(eq(goodsReceiptLines.goodsReceiptId, documentId))
      .orderBy(products.name, products.sku);
    return rows.map((line) => ({
      ...line,
      condition: line.condition as InventoryDocumentLineRecord['condition'],
    }));
  }
  if (document === 'stock-count') {
    return db
      .select({
        id: stockCountLines.id,
        productId: stockCountLines.productId,
        productName: products.name,
        productSku: products.sku,
        systemQuantity: stockCountLines.systemQuantity,
        physicalQuantity: stockCountLines.physicalQuantity,
      })
      .from(stockCountLines)
      .innerJoin(products, eq(stockCountLines.productId, products.id))
      .where(eq(stockCountLines.stockCountId, documentId))
      .orderBy(products.name, products.sku);
  }
  const rows = await db
    .select({
      id: replenishmentRequestLines.id,
      productId: replenishmentRequestLines.productId,
      productName: products.name,
      productSku: products.sku,
      currentStock: replenishmentRequestLines.currentStock,
      reorderQuantity: replenishmentRequestLines.reorderQuantity,
      urgency: replenishmentRequestLines.urgency,
    })
    .from(replenishmentRequestLines)
    .innerJoin(products, eq(replenishmentRequestLines.productId, products.id))
    .where(eq(replenishmentRequestLines.replenishmentRequestId, documentId))
    .orderBy(products.name, products.sku);
  return rows.map((line) => ({
    ...line,
    urgency: line.urgency as InventoryDocumentLineRecord['urgency'],
  }));
}

export async function getInventoryDocument(
  document: InventoryDocumentName,
  documentId: number,
  user: AppUser
): Promise<InventoryDocumentRecord> {
  const storeId = await resolveScopedStoreId(document, user);
  const headers =
    document === 'stock-transfer'
      ? await transferHeaders(storeId, documentId)
      : document === 'goods-receipt'
        ? await goodsReceiptHeaders(documentId)
        : document === 'stock-count'
          ? await stockCountHeaders(documentId)
          : await replenishmentHeaders(storeId, documentId);
  const header = headers[0];
  if (!header) throw new HttpError(404, 'Inventory document not found');
  return { ...header, lines: await documentLines(document, documentId) };
}
