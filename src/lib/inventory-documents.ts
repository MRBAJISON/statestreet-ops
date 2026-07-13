import { and, eq, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { AppUser } from './auth';
import type {
  goodsReceiptSchema,
  InventoryDocumentName,
  inventoryDocumentDecisionSchema,
  replenishmentSchema,
  stockCountSchema,
  stockTransferSchema,
} from './contracts/documents';
import { db } from './db';
import { brandStores, stores } from './db/foundation-schema';
import { HttpError, sessionUserId } from './server-errors';
import type { z } from 'zod';

type StockTransferInput = z.infer<typeof stockTransferSchema>;
type GoodsReceiptInput = z.infer<typeof goodsReceiptSchema>;
type StockCountInput = z.infer<typeof stockCountSchema>;
type ReplenishmentInput = z.infer<typeof replenishmentSchema>;
type InventoryDecisionInput = z.infer<typeof inventoryDocumentDecisionSchema>;

const INVENTORY_DOCUMENT_CREATORS: Record<InventoryDocumentName, ReadonlySet<AppUser['role']>> = {
  'stock-transfer': new Set(['inventory', 'operations', 'store-manager']),
  'goods-receipt': new Set(['inventory', 'operations']),
  'stock-count': new Set(['inventory', 'operations']),
  replenishment: new Set(['inventory', 'operations', 'store-manager']),
};
const managerSourceBrands = alias(brandStores, 'manager_source_brands');
const managerDestinationBrands = alias(brandStores, 'manager_destination_brands');

export function canCreateInventoryDocument(document: InventoryDocumentName, role: AppUser['role']) {
  return INVENTORY_DOCUMENT_CREATORS[document].has(role);
}

async function activeStore(id: number) {
  const [store] = await db
    .select({ id: stores.id, code: stores.code, name: stores.name, type: stores.type })
    .from(stores)
    .where(and(eq(stores.id, id), eq(stores.active, true), eq(stores.type, 'store')))
    .limit(1);
  if (!store) throw new HttpError(400, 'The selected location must be an active retail store');
  return store;
}

async function managerStore(user: AppUser) {
  if (!user.store) throw new HttpError(403, 'No store is assigned to this account');
  const [store] = await db
    .select({ id: stores.id, code: stores.code, name: stores.name, type: stores.type })
    .from(stores)
    .where(and(eq(stores.code, user.store), eq(stores.active, true), eq(stores.type, 'store')))
    .limit(1);
  if (!store) throw new HttpError(409, 'The assigned store is not active');
  return store;
}

async function sourceStore(user: AppUser, requestedId?: number) {
  if (user.role === 'store-manager') {
    const store = await managerStore(user);
    if (requestedId && requestedId !== store.id) throw new HttpError(403, 'Source store does not match this account');
    return store;
  }
  if (!['inventory', 'operations'].includes(user.role)) throw new HttpError(403, 'Forbidden');
  if (!requestedId) throw new HttpError(400, 'fromStoreId is required');
  return activeStore(requestedId);
}

async function destinationStore(user: AppUser, sourceStoreId: number, destinationStoreId: number) {
  if (user.role !== 'store-manager') return activeStore(destinationStoreId);
  const [destination] = await db
    .select({ id: stores.id, code: stores.code, name: stores.name, type: stores.type })
    .from(stores)
    .innerJoin(managerDestinationBrands, eq(managerDestinationBrands.storeId, stores.id))
    .innerJoin(
      managerSourceBrands,
      and(
        eq(managerSourceBrands.brandId, managerDestinationBrands.brandId),
        eq(managerSourceBrands.storeId, sourceStoreId)
      )
    )
    .where(
      and(
        eq(stores.id, destinationStoreId),
        eq(stores.active, true),
        eq(stores.type, 'store')
      )
    )
    .limit(1);
  if (!destination) throw new HttpError(400, 'Destination is not available for this store');
  return destination;
}

function mutationRecord(result: { rows: unknown[] }, message: string) {
  const record = (result.rows[0] as { record?: Record<string, unknown> } | undefined)?.record;
  if (!record) throw new HttpError(400, message);
  return record;
}

export async function createStockTransfer(user: AppUser, input: StockTransferInput) {
  if (!canCreateInventoryDocument('stock-transfer', user.role)) throw new HttpError(403, 'Forbidden');
  const source = await sourceStore(user, input.fromStoreId);
  const destination = await destinationStore(user, source.id, input.toStoreId);
  if (source.id === destination.id) throw new HttpError(400, 'Destination must differ from the source store');
  const actorUserId = sessionUserId(user.id);
  const lines = JSON.stringify(input.lines);
  const result = await db.execute(sql`
    with input_lines as (
      select * from jsonb_to_recordset(${lines}::jsonb) as line("productId" bigint, quantity integer)
    ), valid_lines as (
      select product.id as product_id, input.quantity, product.unit_cost
      from input_lines input
      join products product on product.id = input."productId" and product.active = true
      where ${user.role !== 'store-manager'}::boolean
        or (
          exists (
            select 1 from brand_stores source_brand
            where source_brand.store_id = ${source.id}
              and source_brand.brand_id = product.brand_id
          )
          and exists (
            select 1 from brand_stores destination_brand
            where destination_brand.store_id = ${destination.id}
              and destination_brand.brand_id = product.brand_id
          )
        )
    ), created as (
      insert into stock_transfers (
        business_date, from_store_id, to_store_id, status, reason,
        requested_by_user_id, notes
      )
      select ${input.businessDate}, ${source.id}, ${destination.id}, 'requested', ${input.reason},
             ${actorUserId}, ${input.notes ?? null}
      where (select count(*) from valid_lines) = jsonb_array_length(${lines}::jsonb)
      returning *
    ), created_lines as (
      insert into stock_transfer_lines (stock_transfer_id, product_id, quantity, unit_cost)
      select created.id, line.product_id, line.quantity, line.unit_cost
      from created cross join valid_lines line
      returning *
    ), audit as (
      insert into audit_events (entity_type, entity_id, action, actor_user_id, after)
      select 'stock-transfer', created.id, 'create', ${actorUserId},
             jsonb_build_object('document', to_jsonb(created), 'lines', ${lines}::jsonb)
      from created
      returning id
    )
    select jsonb_build_object(
      'id', created.id,
      'status', created.status,
      'fromStoreId', created.from_store_id,
      'toStoreId', created.to_store_id,
      'lineCount', (select count(*) from created_lines)
    ) as record
    from created
  `);
  return mutationRecord(result, 'One or more selected products are inactive or not carried by both stores');
}

export async function createGoodsReceipt(user: AppUser, input: GoodsReceiptInput) {
  if (!canCreateInventoryDocument('goods-receipt', user.role)) throw new HttpError(403, 'Forbidden');
  await activeStore(input.receivingStoreId);
  const actorUserId = sessionUserId(user.id);
  const lines = JSON.stringify(input.lines);
  const result = await db.execute(sql`
    with input_lines as (
      select * from jsonb_to_recordset(${lines}::jsonb) as line(
        "productId" bigint, quantity integer, "unitCost" numeric(14,2), condition text, discrepancy text
      )
    ), valid_lines as (
      select
        product.id as product_id,
        input.quantity,
        coalesce(input."unitCost", product.unit_cost) as unit_cost,
        input.condition,
        input.discrepancy
      from input_lines input
      join products product on product.id = input."productId" and product.active = true
      where coalesce(input."unitCost", product.unit_cost) is not null
    ), created as (
      insert into goods_receipts (
        business_date, po_number, supplier_id, receiving_store_id, status, notes,
        created_by_user_id, updated_by_user_id
      )
      select ${input.businessDate}, ${input.poNumber ?? null}, ${input.supplierId}, ${input.receivingStoreId},
             'received', ${input.notes ?? null}, ${actorUserId}, ${actorUserId}
      where (select count(*) from valid_lines) = jsonb_array_length(${lines}::jsonb)
        and exists (
          select 1 from suppliers supplier
          where supplier.id = ${input.supplierId} and supplier.active = true
        )
      returning *
    ), created_lines as (
      insert into goods_receipt_lines (
        goods_receipt_id, product_id, quantity, unit_cost, condition, discrepancy
      )
      select created.id, line.product_id, line.quantity, line.unit_cost, line.condition, line.discrepancy
      from created cross join valid_lines line
      returning *
    ), movements as (
      insert into inventory_movements (
        business_date, product_id, store_id, movement_type, quantity, unit_cost,
        source_type, source_id, source_line_id, created_by_user_id
      )
      select created.business_date, line.product_id, created.receiving_store_id, 'receipt',
             line.quantity, line.unit_cost, 'goods-receipt', created.id, line.id, ${actorUserId}
      from created join created_lines line on line.goods_receipt_id = created.id
      returning id
    ), audit as (
      insert into audit_events (entity_type, entity_id, action, actor_user_id, after)
      select 'goods-receipt', created.id, 'receive', ${actorUserId},
             jsonb_build_object('document', to_jsonb(created), 'lines', ${lines}::jsonb)
      from created
      returning id
    )
    select jsonb_build_object(
      'id', created.id,
      'status', created.status,
      'lineCount', (select count(*) from created_lines),
      'movementCount', (select count(*) from movements)
    ) as record
    from created
  `);
  return mutationRecord(result, 'An active supplier and valid product unit costs are required');
}

export async function createStockCount(user: AppUser, input: StockCountInput) {
  if (!canCreateInventoryDocument('stock-count', user.role)) throw new HttpError(403, 'Forbidden');
  await activeStore(input.storeId);
  const actorUserId = sessionUserId(user.id);
  const lines = JSON.stringify(input.lines);
  const result = await db.execute(sql`
    with input_lines as (
      select * from jsonb_to_recordset(${lines}::jsonb) as line("productId" bigint, "physicalQuantity" integer)
    ), valid_lines as (
      select
        product.id as product_id,
        input."physicalQuantity" as physical_quantity,
        coalesce(product.unit_cost, 0) as unit_cost,
        coalesce((
          select sum(movement.quantity)
          from inventory_movements movement
          where movement.product_id = product.id and movement.store_id = ${input.storeId}
            and movement.business_date <= ${input.businessDate}::date
        ), 0)::integer as system_quantity
      from input_lines input
      join products product on product.id = input."productId" and product.active = true
    ), created as (
      insert into stock_counts (
        business_date, store_id, status, counted_by_user_id, notes
      )
      select ${input.businessDate}, ${input.storeId}, 'submitted', ${actorUserId}, ${input.notes ?? null}
      where (select count(*) from valid_lines) = jsonb_array_length(${lines}::jsonb)
      returning *
    ), created_lines as (
      insert into stock_count_lines (
        stock_count_id, product_id, system_quantity, physical_quantity, unit_cost
      )
      select created.id, line.product_id, line.system_quantity, line.physical_quantity, line.unit_cost
      from created cross join valid_lines line
      returning id
    ), audit as (
      insert into audit_events (entity_type, entity_id, action, actor_user_id, after)
      select 'stock-count', created.id, 'submit', ${actorUserId},
             jsonb_build_object('document', to_jsonb(created), 'lines', ${lines}::jsonb)
      from created
      returning id
    )
    select jsonb_build_object(
      'id', created.id,
      'status', created.status,
      'lineCount', (select count(*) from created_lines)
    ) as record
    from created
  `);
  return mutationRecord(result, 'One or more selected products are not active');
}

export async function createReplenishment(user: AppUser, input: ReplenishmentInput) {
  if (!canCreateInventoryDocument('replenishment', user.role)) throw new HttpError(403, 'Forbidden');
  const store = await sourceStore(user, input.storeId);
  const actorUserId = sessionUserId(user.id);
  const lines = JSON.stringify(input.lines);
  const result = await db.execute(sql`
    with input_lines as (
      select * from jsonb_to_recordset(${lines}::jsonb) as line(
        "productId" bigint, "reorderQuantity" integer, urgency text
      )
    ), valid_lines as (
      select
        product.id as product_id,
        input."reorderQuantity" as reorder_quantity,
        input.urgency,
        greatest(coalesce((
          select sum(movement.quantity)
          from inventory_movements movement
          where movement.product_id = product.id and movement.store_id = ${store.id}
            and movement.business_date <= ${input.businessDate}::date
        ), 0), 0)::integer as current_stock
      from input_lines input
      join products product on product.id = input."productId" and product.active = true
      where ${user.role !== 'store-manager'}::boolean
        or exists (
          select 1 from brand_stores carried_brand
          where carried_brand.store_id = ${store.id}
            and carried_brand.brand_id = product.brand_id
        )
    ), created as (
      insert into replenishment_requests (
        business_date, store_id, supplier_id, status, requested_by_user_id, notes
      )
      select ${input.businessDate}, ${store.id}, ${input.supplierId ?? null}, 'requested',
             ${actorUserId}, ${input.notes ?? null}
      where (select count(*) from valid_lines) = jsonb_array_length(${lines}::jsonb)
        and (
          ${input.supplierId ?? null}::bigint is null
          or exists (
            select 1 from suppliers supplier
            where supplier.id = ${input.supplierId ?? null} and supplier.active = true
          )
        )
      returning *
    ), created_lines as (
      insert into replenishment_request_lines (
        replenishment_request_id, product_id, current_stock, reorder_quantity, urgency
      )
      select created.id, line.product_id, line.current_stock, line.reorder_quantity, line.urgency
      from created cross join valid_lines line
      returning id
    ), audit as (
      insert into audit_events (entity_type, entity_id, action, actor_user_id, after)
      select 'replenishment-request', created.id, 'create', ${actorUserId},
             jsonb_build_object('document', to_jsonb(created), 'lines', ${lines}::jsonb)
      from created
      returning id
    )
    select jsonb_build_object(
      'id', created.id,
      'status', created.status,
      'lineCount', (select count(*) from created_lines)
    ) as record
    from created
  `);
  return mutationRecord(result, 'Use active suppliers and products carried by the selected store');
}

export async function decideStockTransfer(user: AppUser, id: number, input: InventoryDecisionInput) {
  const actorUserId = sessionUserId(user.id);
  const expectedStatus: Partial<Record<InventoryDecisionInput['action'], string>> = {
    authorize: 'requested',
    dispatch: 'authorized',
    receive: 'in-transit',
  };
  const nextStatus: Partial<Record<InventoryDecisionInput['action'], string>> = {
    authorize: 'authorized',
    dispatch: 'in-transit',
    receive: 'received',
    cancel: 'cancelled',
  };
  if (!nextStatus[input.action]) throw new HttpError(400, 'Action is not valid for a stock transfer');
  if ((input.action === 'cancel') && !input.reason) throw new HttpError(400, 'A reason is required');
  let managerStoreId: number | null = null;
  if (user.role === 'store-manager') managerStoreId = (await managerStore(user)).id;
  if (user.role !== 'inventory') {
    const managerAction = user.role === 'store-manager' && ['receive', 'cancel'].includes(input.action);
    if (!managerAction) throw new HttpError(403, 'Forbidden');
  }
  const auditAction = input.action === 'dispatch' ? 'update' : input.action;
  const result = await db.execute(sql`
    with before_document as materialized (
      select transfer.*
      from stock_transfers transfer
      where transfer.id = ${id}
        and (
          (${input.action}::text = 'cancel' and transfer.status in ('requested', 'authorized'))
          or transfer.status = ${expectedStatus[input.action] ?? ''}
        )
        and (
          ${user.role === 'inventory'}::boolean
          or (${input.action}::text = 'receive' and transfer.to_store_id = ${managerStoreId})
          or (${input.action}::text = 'cancel' and transfer.from_store_id = ${managerStoreId})
        )
      for update
    ), availability as (
      select line.product_id, line.quantity, balance.available
      from before_document document
      join stock_transfer_lines line on line.stock_transfer_id = document.id
      cross join lateral public.inventory_store_balances(
        document.from_store_id,
        array(
          select requested.product_id
          from stock_transfer_lines requested
          where requested.stock_transfer_id = document.id
          order by requested.product_id
        )
      ) balance
      where ${input.action}::text = 'dispatch'
        and balance.product_id = line.product_id
    ), allowed as (
      select document.*
      from before_document document
      where ${input.action}::text <> 'dispatch'
         or not exists (select 1 from availability where available < quantity)
    ), updated as (
      update stock_transfers transfer
      set status = ${nextStatus[input.action]},
          authorized_by_user_id = case when ${input.action}::text = 'authorize' then ${actorUserId} else transfer.authorized_by_user_id end,
          authorized_at = case when ${input.action}::text = 'authorize' then now() else transfer.authorized_at end,
          received_by_user_id = case when ${input.action}::text = 'receive' then ${actorUserId} else transfer.received_by_user_id end,
          received_at = case when ${input.action}::text = 'receive' then now() else transfer.received_at end,
          notes = case when ${input.reason ?? null}::text is null then transfer.notes
                       else concat_ws(E'\n', transfer.notes, ${input.reason ?? null}::text) end,
          updated_at = now()
      from allowed document
      where transfer.id = document.id
      returning transfer.*
    ), movements as (
      insert into inventory_movements (
        business_date, product_id, store_id, movement_type, quantity, unit_cost,
        source_type, source_id, source_line_id, created_by_user_id
      )
      select
        current_date,
        line.product_id,
        case when ${input.action}::text = 'dispatch' then updated.from_store_id else updated.to_store_id end,
        case when ${input.action}::text = 'dispatch' then 'transfer-out' else 'transfer-in' end,
        case when ${input.action}::text = 'dispatch' then -line.quantity else line.quantity end,
        line.unit_cost,
        'stock-transfer', updated.id, line.id, ${actorUserId}
      from updated
      join stock_transfer_lines line on line.stock_transfer_id = updated.id
      where ${input.action}::text in ('dispatch', 'receive')
      returning id
    ), audit as (
      insert into audit_events (entity_type, entity_id, action, actor_user_id, before, after, metadata)
      select 'stock-transfer', updated.id, ${auditAction}, ${actorUserId},
             to_jsonb(before_document), to_jsonb(updated),
             jsonb_build_object(
               'decision', ${input.action}::text,
               'reason', ${input.reason ?? null}::text
             )
      from updated join before_document on before_document.id = updated.id
      returning id
    )
    select jsonb_build_object(
      'id', updated.id,
      'status', updated.status,
      'movementCount', (select count(*) from movements)
    ) as record
    from updated
  `);
  const record = (result.rows[0] as { record?: Record<string, unknown> } | undefined)?.record;
  if (!record) throw new HttpError(409, 'Transfer state changed, access is restricted, or source stock is insufficient');
  return record;
}

export async function decideStockCount(user: AppUser, id: number, input: InventoryDecisionInput) {
  if (user.role !== 'inventory') throw new HttpError(403, 'Forbidden');
  if (!['approve', 'cancel'].includes(input.action)) throw new HttpError(400, 'Action is not valid for a stock count');
  if (input.action === 'cancel' && !input.reason) throw new HttpError(400, 'A reason is required');
  const actorUserId = sessionUserId(user.id);
  const result = await db.execute(sql`
    with before_document as materialized (
      select * from stock_counts
      where id = ${id} and status = 'submitted'
      for update
    ), availability as (
      select
        line.product_id,
        balance.available,
        line.physical_quantity - line.system_quantity as adjustment
      from before_document document
      join stock_count_lines line on line.stock_count_id = document.id
      cross join lateral public.inventory_store_balances(
        document.store_id,
        array(
          select requested.product_id
          from stock_count_lines requested
          where requested.stock_count_id = document.id
          order by requested.product_id
        )
      ) balance
      where ${input.action}::text = 'approve'
        and balance.product_id = line.product_id
    ), allowed as (
      select document.*
      from before_document document
      where ${input.action}::text <> 'approve'
         or not exists (
           select 1 from availability
           where available + adjustment < 0
         )
    ), updated as (
      update stock_counts document
      set status = case when ${input.action}::text = 'approve' then 'approved' else 'cancelled' end,
          approved_by_user_id = case
            when ${input.action}::text = 'approve' then ${actorUserId}::integer
            else null::integer
          end,
          approved_at = case
            when ${input.action}::text = 'approve' then now()
            else null::timestamptz
          end,
          notes = case when ${input.reason ?? null}::text is null then document.notes
                       else concat_ws(E'\n', document.notes, ${input.reason ?? null}::text) end,
          updated_at = now()
      from allowed before
      where document.id = before.id
      returning document.*
    ), movements as (
      insert into inventory_movements (
        business_date, product_id, store_id, movement_type, quantity, unit_cost,
        source_type, source_id, source_line_id, created_by_user_id
      )
      select updated.business_date, line.product_id, updated.store_id, 'count-adjustment',
             line.physical_quantity - line.system_quantity, line.unit_cost,
             'stock-count', updated.id, line.id, ${actorUserId}
      from updated join stock_count_lines line on line.stock_count_id = updated.id
      where ${input.action}::text = 'approve'
        and line.physical_quantity <> line.system_quantity
      returning id
    ), audit as (
      insert into audit_events (entity_type, entity_id, action, actor_user_id, before, after, metadata)
      select 'stock-count', updated.id,
             case when ${input.action}::text = 'approve' then 'approve' else 'cancel' end,
             ${actorUserId}, to_jsonb(before_document), to_jsonb(updated),
             jsonb_build_object('reason', ${input.reason ?? null}::text)
      from updated join before_document on before_document.id = updated.id
      returning id
    )
    select jsonb_build_object(
      'id', updated.id,
      'status', updated.status,
      'movementCount', (select count(*) from movements)
    ) as record
    from updated
  `);
  const record = (result.rows[0] as { record?: Record<string, unknown> } | undefined)?.record;
  if (!record) {
    throw new HttpError(
      409,
      'Stock count state changed or intervening movements would make stock negative'
    );
  }
  return record;
}

export async function decideReplenishment(user: AppUser, id: number, input: InventoryDecisionInput) {
  const transitions: Record<string, { from: string[]; to: string }> = {
    approve: { from: ['requested'], to: 'approved' },
    order: { from: ['approved'], to: 'ordered' },
    fulfill: { from: ['ordered'], to: 'fulfilled' },
    reject: { from: ['requested', 'approved'], to: 'rejected' },
    cancel: { from: ['requested', 'approved'], to: 'cancelled' },
  };
  const transition = transitions[input.action];
  if (!transition) throw new HttpError(400, 'Action is not valid for replenishment');
  if (['reject', 'cancel'].includes(input.action) && !input.reason) throw new HttpError(400, 'A reason is required');
  let managerStoreId: number | null = null;
  if (user.role === 'store-manager') managerStoreId = (await managerStore(user)).id;
  if (user.role !== 'inventory' && !(user.role === 'store-manager' && input.action === 'cancel')) {
    throw new HttpError(403, 'Forbidden');
  }
  const actorUserId = sessionUserId(user.id);
  const result = await db.execute(sql`
    with before_document as materialized (
      select * from replenishment_requests request
      where request.id = ${id}
        and request.status = any(${transition.from}::text[])
        and (${user.role === 'inventory'}::boolean or request.store_id = ${managerStoreId})
      for update
    ), updated as (
      update replenishment_requests request
      set status = ${transition.to},
          reviewed_by_user_id = case when ${user.role === 'inventory'}::boolean then ${actorUserId} else request.reviewed_by_user_id end,
          reviewed_at = case when ${user.role === 'inventory'}::boolean then now() else request.reviewed_at end,
          notes = case when ${input.reason ?? null}::text is null then request.notes
                       else concat_ws(E'\n', request.notes, ${input.reason ?? null}::text) end,
          updated_at = now()
      from before_document before
      where request.id = before.id
      returning request.*
    ), audit as (
      insert into audit_events (entity_type, entity_id, action, actor_user_id, before, after, metadata)
      select 'replenishment-request', updated.id,
             case
               when ${input.action}::text = 'approve' then 'approve'
               when ${input.action}::text = 'fulfill' then 'complete'
               when ${input.action}::text in ('reject', 'cancel') then 'cancel'
               else 'update'
             end,
             ${actorUserId}, to_jsonb(before_document), to_jsonb(updated),
             jsonb_build_object(
               'decision', ${input.action}::text,
               'reason', ${input.reason ?? null}::text
             )
      from updated join before_document on before_document.id = updated.id
      returning id
    )
    select jsonb_build_object('id', updated.id, 'status', updated.status) as record from updated
  `);
  const record = (result.rows[0] as { record?: Record<string, unknown> } | undefined)?.record;
  if (!record) throw new HttpError(409, 'Replenishment state changed or access is restricted');
  return record;
}
