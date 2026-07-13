import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { testDatabaseUrl } from './test-database';

const databaseUrl = testDatabaseUrl(process.env.TEST_DATABASE_URL);
const describeWithDatabase = databaseUrl ? describe : describe.skip;

describeWithDatabase('inventory document SQL integration', () => {
  const client = new Client({ connectionString: databaseUrl });
  let userId: number;
  let storeId: number;
  let brandId: number;
  let productId: number;
  let stockCountId: number;

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.DATABASE_DRIVER = 'node-postgres';
    await client.connect();
    await client.query('truncate table users, stores, brands, categories, suppliers restart identity cascade');
    userId = Number(
      (
        await client.query(
          `insert into users (name, email, password_hash, role, department)
           values ('Inventory Test', 'inventory-test@example.com', 'not-used', 'inventory', 'inventory')
           returning id`
        )
      ).rows[0].id
    );
    storeId = Number(
      (await client.query(`insert into stores (code, name) values ('count-store', 'Count Store') returning id`)).rows[0].id
    );
    brandId = Number(
      (await client.query(`insert into brands (code, name) values ('count-brand', 'Count Brand') returning id`)).rows[0].id
    );
    const categoryId = Number(
      (await client.query(`insert into categories (code, name) values ('count-category', 'Count Category') returning id`)).rows[0].id
    );
    productId = Number(
      (
        await client.query(
          `insert into products (sku, name, brand_id, category_id, unit_cost)
           values ('COUNT-001', 'Count Product', $1, $2, 20)
           returning id`,
          [brandId, categoryId]
        )
      ).rows[0].id
    );
    await client.query(
      `insert into inventory_movements (
         business_date, product_id, store_id, movement_type, quantity, unit_cost,
         source_type, created_by_user_id
       ) values ('2026-07-01', $1, $2, 'opening-balance', 100, 20, 'test', $3)`,
      [productId, storeId, userId]
    );
    stockCountId = Number(
      (
        await client.query(
          `insert into stock_counts (business_date, store_id, status, counted_by_user_id)
           values ('2026-07-02', $1, 'submitted', $2)
           returning id`,
          [storeId, userId]
        )
      ).rows[0].id
    );
    await client.query(
      `insert into stock_count_lines (
         stock_count_id, product_id, system_quantity, physical_quantity, unit_cost
       ) values ($1, $2, 100, 100, 20)`,
      [stockCountId, productId]
    );
    await client.query(
      `insert into inventory_movements (
         business_date, product_id, store_id, movement_type, quantity, unit_cost,
         source_type, created_by_user_id
       ) values ('2026-07-03', $1, $2, 'sale', -10, 20, 'test', $3)`,
      [productId, storeId, userId]
    );
  });

  afterAll(async () => {
    await client.end();
  });

  it('limits store-manager transfers to retail stores in the same brand', async () => {
    const eligibleStoreId = Number(
      (
        await client.query(
          `insert into stores (code, name) values ('same-brand-store', 'Same Brand Store') returning id`
        )
      ).rows[0].id
    );
    const crossBrandStoreId = Number(
      (
        await client.query(
          `insert into stores (code, name) values ('other-brand-store', 'Other Brand Store') returning id`
        )
      ).rows[0].id
    );
    const warehouseId = Number(
      (
        await client.query(
          `insert into stores (code, name, type) values ('same-brand-warehouse', 'Same Brand Warehouse', 'warehouse') returning id`
        )
      ).rows[0].id
    );
    const otherBrandId = Number(
      (
        await client.query(
          `insert into brands (code, name) values ('other-brand', 'Other Brand') returning id`
        )
      ).rows[0].id
    );
    const sourceOnlyBrandId = Number(
      (
        await client.query(
          `insert into brands (code, name) values ('source-only-brand', 'Source Only Brand') returning id`
        )
      ).rows[0].id
    );
    const sourceOnlyProductId = Number(
      (
        await client.query(
          `insert into products (sku, name, brand_id, category_id, unit_cost)
           select 'SOURCE-ONLY-001', 'Source Only Product', $1, category_id, 25
           from products where id = $2
           returning id`,
          [sourceOnlyBrandId, productId]
        )
      ).rows[0].id
    );
    await client.query(
      `insert into brand_stores (brand_id, store_id) values
       ($1, $2), ($1, $3), ($1, $4), ($5, $6), ($7, $2)`,
      [brandId, storeId, eligibleStoreId, warehouseId, otherBrandId, crossBrandStoreId, sourceOnlyBrandId]
    );
    const manager = {
      id: String(userId),
      name: 'Store Manager Test',
      email: 'manager-test@example.com',
      role: 'store-manager' as const,
      department: 'commercial' as const,
      store: 'count-store',
    };
    const input = {
      businessDate: '2026-07-05',
      reason: 'Rebalancing',
      lines: [{ productId, quantity: 2 }],
    };
    const { createStockTransfer } = await import('./inventory-documents');

    await expect(createStockTransfer(manager, { ...input, toStoreId: eligibleStoreId })).resolves.toMatchObject({
      status: 'requested',
      lineCount: 1,
    });
    await expect(createStockTransfer(manager, { ...input, toStoreId: crossBrandStoreId })).rejects.toMatchObject({
      status: 400,
      message: 'Destination is not available for this store',
    });
    await expect(createStockTransfer(manager, { ...input, toStoreId: warehouseId })).rejects.toMatchObject({
      status: 400,
      message: 'Destination is not available for this store',
    });
    await expect(
      createStockTransfer(manager, {
        ...input,
        toStoreId: eligibleStoreId,
        lines: [{ productId: sourceOnlyProductId, quantity: 1 }],
      })
    ).rejects.toMatchObject({
      status: 400,
      message: 'One or more selected products are inactive or not carried by both stores',
    });
    const transfers = await client.query(
      `select to_store_id from stock_transfers where requested_by_user_id = $1 and reason = 'Rebalancing'`,
      [userId]
    );
    expect(transfers.rows.map((row) => Number(row.to_store_id))).toEqual([eligibleStoreId]);
  });

  it('rejects non-retail locations for inventory documents at the service boundary', async () => {
    const warehouseId = Number(
      (
        await client.query(
          `insert into stores (code, name, type) values ('inventory-warehouse', 'Inventory Warehouse', 'warehouse') returning id`
        )
      ).rows[0].id
    );
    const { createStockCount } = await import('./inventory-documents');

    await expect(
      createStockCount(
        {
          id: String(userId),
          name: 'Inventory Test',
          email: 'inventory-test@example.com',
          role: 'inventory',
          department: 'inventory',
        },
        {
          businessDate: '2026-07-06',
          storeId: warehouseId,
          lines: [{ productId, physicalQuantity: 1 }],
        }
      )
    ).rejects.toMatchObject({
      status: 400,
      message: 'The selected location must be an active retail store',
    });
    await expect(client.query('select id from stock_counts where store_id = $1', [warehouseId])).resolves.toMatchObject({
      rowCount: 0,
    });
  });

  it('limits store-manager replenishment requests to products carried by their store', async () => {
    const outsideBrandId = Number(
      (
        await client.query(
          `insert into brands (code, name) values ('replenishment-outside-brand', 'Replenishment Outside Brand') returning id`
        )
      ).rows[0].id
    );
    const outsideProductId = Number(
      (
        await client.query(
          `insert into products (sku, name, brand_id, category_id, unit_cost)
           select 'REPLENISHMENT-OUTSIDE-001', 'Replenishment Outside Product', $1, category_id, 20
           from products where id = $2
           returning id`,
          [outsideBrandId, productId]
        )
      ).rows[0].id
    );
    await client.query(
      `insert into brand_stores (brand_id, store_id) values ($1, $2)
       on conflict (brand_id, store_id) do nothing`,
      [brandId, storeId]
    );
    const manager = {
      id: String(userId),
      name: 'Store Manager Test',
      email: 'manager-test@example.com',
      role: 'store-manager' as const,
      department: 'commercial' as const,
      store: 'count-store',
    };
    const { createReplenishment } = await import('./inventory-documents');

    await expect(
      createReplenishment(manager, {
        businessDate: '2026-07-06',
        notes: 'Manager carried product request',
        lines: [{ productId, reorderQuantity: 4, urgency: 'normal' }],
      })
    ).resolves.toMatchObject({ status: 'requested', lineCount: 1 });
    await expect(
      createReplenishment(manager, {
        businessDate: '2026-07-06',
        notes: 'Manager outside product request',
        lines: [{ productId: outsideProductId, reorderQuantity: 4, urgency: 'normal' }],
      })
    ).rejects.toMatchObject({
      status: 400,
      message: 'Use active suppliers and products carried by the selected store',
    });
    const requests = await client.query(
      `select notes from replenishment_requests
       where requested_by_user_id = $1 and notes like 'Manager % product request'
       order by notes`,
      [userId]
    );
    expect(requests.rows).toEqual([{ notes: 'Manager carried product request' }]);
  });

  it('rejects inactive suppliers without creating inventory documents', async () => {
    const supplierId = Number(
      (
        await client.query(
          `insert into suppliers (code, name, active)
           values ('inactive-document-supplier', 'Inactive Document Supplier', false)
           returning id`
        )
      ).rows[0].id
    );
    const inventoryUser = {
      id: String(userId),
      name: 'Inventory Test',
      email: 'inventory-test@example.com',
      role: 'inventory' as const,
      department: 'inventory' as const,
    };
    const { createGoodsReceipt, createReplenishment } = await import('./inventory-documents');

    await expect(
      createGoodsReceipt(inventoryUser, {
        businessDate: '2026-07-06',
        supplierId,
        receivingStoreId: storeId,
        notes: 'Inactive supplier receipt',
        lines: [{ productId, quantity: 2, condition: 'good' }],
      })
    ).rejects.toMatchObject({
      status: 400,
      message: 'An active supplier and valid product unit costs are required',
    });
    await expect(
      createReplenishment(inventoryUser, {
        businessDate: '2026-07-06',
        storeId,
        supplierId,
        notes: 'Inactive supplier replenishment',
        lines: [{ productId, reorderQuantity: 2, urgency: 'normal' }],
      })
    ).rejects.toMatchObject({
      status: 400,
      message: 'Use active suppliers and products carried by the selected store',
    });
    const created = await client.query(
      `select
         (select count(*)::integer from goods_receipts where notes = 'Inactive supplier receipt') as receipts,
         (select count(*)::integer from replenishment_requests where notes = 'Inactive supplier replenishment') as requests`
    );
    expect(created.rows[0]).toEqual({ receipts: 0, requests: 0 });
  });

  it('preserves the submitted count-time variance when approval is delayed', async () => {
    const { decideStockCount } = await import('./inventory-documents');
    const record = await decideStockCount(
      {
        id: String(userId),
        name: 'Inventory Test',
        email: 'inventory-test@example.com',
        role: 'inventory',
        department: 'inventory',
      },
      stockCountId,
      { action: 'approve' }
    );
    const balance = await client.query(
      `select sum(quantity)::integer as quantity,
              count(*) filter (where movement_type = 'count-adjustment')::integer as adjustments
       from inventory_movements
       where product_id = $1 and store_id = $2`,
      [productId, storeId]
    );
    const countLine = await client.query(
      'select system_quantity, physical_quantity from stock_count_lines where stock_count_id = $1',
      [stockCountId]
    );

    expect(record.status).toBe('approved');
    expect(record.movementCount).toBe(0);
    expect(balance.rows[0]).toMatchObject({ quantity: 90, adjustments: 0 });
    expect(countLine.rows[0]).toMatchObject({ system_quantity: 100, physical_quantity: 100 });
  });

  it('posts an approved adjustment on the physical count business date', async () => {
    const count = await client.query(
      `insert into stock_counts (business_date, store_id, status, counted_by_user_id)
       values ('2026-06-30', $1, 'submitted', $2)
       returning id`,
      [storeId, userId]
    );
    const countId = Number(count.rows[0].id);
    await client.query(
      `insert into stock_count_lines (
         stock_count_id, product_id, system_quantity, physical_quantity, unit_cost
       ) values ($1, $2, 100, 95, 20)`,
      [countId, productId]
    );

    const { decideStockCount } = await import('./inventory-documents');
    const record = await decideStockCount(
      {
        id: String(userId),
        name: 'Inventory Test',
        email: 'inventory-test@example.com',
        role: 'inventory',
        department: 'inventory',
      },
      countId,
      { action: 'approve' }
    );
    const movement = await client.query(
      `select business_date::text, quantity::integer
       from inventory_movements
       where source_type = 'stock-count' and source_id = $1`,
      [countId]
    );

    expect(record).toMatchObject({ status: 'approved', movementCount: 1 });
    expect(movement.rows).toEqual([{ business_date: '2026-06-30', quantity: -5 }]);
  });

  it('does not post inventory adjustments when a submitted count is cancelled', async () => {
    const count = await client.query(
      `insert into stock_counts (business_date, store_id, status, counted_by_user_id)
       values ('2026-06-29', $1, 'submitted', $2)
       returning id`,
      [storeId, userId]
    );
    const countId = Number(count.rows[0].id);
    await client.query(
      `insert into stock_count_lines (
         stock_count_id, product_id, system_quantity, physical_quantity, unit_cost
       ) values ($1, $2, 100, 90, 20)`,
      [countId, productId]
    );

    const { decideStockCount } = await import('./inventory-documents');
    const record = await decideStockCount(
      {
        id: String(userId),
        name: 'Inventory Test',
        email: 'inventory-test@example.com',
        role: 'inventory',
        department: 'inventory',
      },
      countId,
      { action: 'cancel', reason: 'Duplicate count' }
    );
    const movements = await client.query(
      `select count(*)::integer as count
       from inventory_movements
       where source_type = 'stock-count' and source_id = $1`,
      [countId]
    );

    expect(record).toMatchObject({ status: 'cancelled', movementCount: 0 });
    expect(movements.rows[0].count).toBe(0);
  });

  it('serializes concurrent dispatches that consume the same source stock', async () => {
    const concurrentProduct = await client.query(
      `insert into products (sku, name, brand_id, category_id, unit_cost)
       select 'COUNT-CONCURRENT', 'Concurrent Dispatch Product', brand_id, category_id, 20
       from products where id = $1
       returning id`,
      [productId]
    );
    const concurrentProductId = Number(concurrentProduct.rows[0].id);
    const destination = await client.query(
      `insert into stores (code, name) values ('count-destination', 'Count Destination') returning id`
    );
    const destinationStoreId = Number(destination.rows[0].id);
    await client.query(
      `insert into inventory_movements (
         business_date, product_id, store_id, movement_type, quantity, unit_cost,
         source_type, created_by_user_id
       ) values ('2026-07-01', $1, $2, 'opening-balance', 100, 20, 'test', $3)`,
      [concurrentProductId, storeId, userId]
    );
    const transfers = await client.query(
      `insert into stock_transfers (
         business_date, from_store_id, to_store_id, status, reason,
         requested_by_user_id, authorized_by_user_id, authorized_at
       ) values
         ('2026-07-04', $1, $2, 'authorized', 'Concurrent A', $3, $3, now()),
         ('2026-07-04', $1, $2, 'authorized', 'Concurrent B', $3, $3, now())
       returning id`,
      [storeId, destinationStoreId, userId]
    );
    const transferIds = transfers.rows.map((row) => Number(row.id));
    await client.query(
      `insert into stock_transfer_lines (stock_transfer_id, product_id, quantity, unit_cost)
       values ($1, $3, 70, 20), ($2, $3, 70, 20)`,
      [transferIds[0], transferIds[1], concurrentProductId]
    );

    await client.query(`
      create function test_delay_transfer_dispatch() returns trigger language plpgsql as $$
      begin
        if new.movement_type = 'transfer-out' then
          perform pg_sleep(0.2);
        end if;
        return new;
      end;
      $$;
      create trigger test_delay_transfer_dispatch
      before insert on inventory_movements for each row execute function test_delay_transfer_dispatch();
    `);
    const { decideStockTransfer } = await import('./inventory-documents');
    const inventoryUser = {
      id: String(userId),
      name: 'Inventory Test',
      email: 'inventory-test@example.com',
      role: 'inventory' as const,
      department: 'inventory' as const,
    };
    let decisions: PromiseSettledResult<Record<string, unknown>>[];
    try {
      decisions = await Promise.allSettled(
        transferIds.map((transferId) => decideStockTransfer(inventoryUser, transferId, { action: 'dispatch' }))
      );
    } finally {
      await client.query(
        'drop trigger test_delay_transfer_dispatch on inventory_movements; drop function test_delay_transfer_dispatch()'
      );
    }
    const balance = await client.query(
      `select sum(quantity)::integer as quantity,
              count(*) filter (where movement_type = 'transfer-out')::integer as dispatches
       from inventory_movements
       where product_id = $1 and store_id = $2`,
      [concurrentProductId, storeId]
    );
    const statuses = await client.query(
      `select status, count(*)::integer as count
       from stock_transfers where id = any($1::bigint[])
       group by status order by status`,
      [transferIds]
    );

    expect(decisions.filter((decision) => decision.status === 'fulfilled')).toHaveLength(1);
    expect(decisions.filter((decision) => decision.status === 'rejected')).toHaveLength(1);
    expect(balance.rows[0]).toMatchObject({ quantity: 30, dispatches: 1 });
    expect(statuses.rows).toEqual([
      { status: 'authorized', count: 1 },
      { status: 'in-transit', count: 1 },
    ]);
  });

  it('serializes stock-count approval with a dispatch from the same store', async () => {
    const raceProduct = await client.query(
      `insert into products (sku, name, brand_id, category_id, unit_cost)
       select 'COUNT-TRANSFER-RACE', 'Count Transfer Race Product', brand_id, category_id, 20
       from products where id = $1
       returning id`,
      [productId]
    );
    const raceProductId = Number(raceProduct.rows[0].id);
    const destination = await client.query(
      `insert into stores (code, name) values ('count-race-destination', 'Count Race Destination') returning id`
    );
    const destinationStoreId = Number(destination.rows[0].id);
    await client.query(
      `insert into inventory_movements (
         business_date, product_id, store_id, movement_type, quantity, unit_cost,
         source_type, created_by_user_id
       ) values (current_date, $1, $2, 'opening-balance', 100, 20, 'test', $3)`,
      [raceProductId, storeId, userId]
    );
    const count = await client.query(
      `insert into stock_counts (business_date, store_id, status, counted_by_user_id)
       values (current_date, $1, 'submitted', $2)
       returning id`,
      [storeId, userId]
    );
    const raceCountId = Number(count.rows[0].id);
    await client.query(
      `insert into stock_count_lines (
         stock_count_id, product_id, system_quantity, physical_quantity, unit_cost
       ) values ($1, $2, 100, 0, 20)`,
      [raceCountId, raceProductId]
    );
    const transfer = await client.query(
      `insert into stock_transfers (
         business_date, from_store_id, to_store_id, status, reason,
         requested_by_user_id, authorized_by_user_id, authorized_at
       ) values (current_date, $1, $2, 'authorized', 'Count approval race', $3, $3, now())
       returning id`,
      [storeId, destinationStoreId, userId]
    );
    const raceTransferId = Number(transfer.rows[0].id);
    await client.query(
      `insert into stock_transfer_lines (stock_transfer_id, product_id, quantity, unit_cost)
       values ($1, $2, 10, 20)`,
      [raceTransferId, raceProductId]
    );
    await client.query(`
      create function test_delay_racing_dispatch() returns trigger language plpgsql as $$
      begin
        if new.source_type = 'stock-transfer' and new.source_id = ${raceTransferId} then
          perform pg_sleep(0.2);
        end if;
        return new;
      end;
      $$;
      create trigger test_delay_racing_dispatch
      before insert on inventory_movements for each row execute function test_delay_racing_dispatch();
    `);
    const { decideStockCount, decideStockTransfer } = await import('./inventory-documents');
    const inventoryUser = {
      id: String(userId),
      name: 'Inventory Test',
      email: 'inventory-test@example.com',
      role: 'inventory' as const,
      department: 'inventory' as const,
    };
    let dispatch: PromiseSettledResult<Record<string, unknown>>;
    let approval: PromiseSettledResult<Record<string, unknown>>;
    try {
      const dispatchPromise = decideStockTransfer(inventoryUser, raceTransferId, { action: 'dispatch' });
      await new Promise((resolve) => setTimeout(resolve, 50));
      [dispatch, approval] = await Promise.allSettled([
        dispatchPromise,
        decideStockCount(inventoryUser, raceCountId, { action: 'approve' }),
      ]);
    } finally {
      await client.query(
        'drop trigger test_delay_racing_dispatch on inventory_movements; drop function test_delay_racing_dispatch()'
      );
    }
    const balance = await client.query(
      `select sum(quantity)::integer as quantity
       from inventory_movements where product_id = $1 and store_id = $2`,
      [raceProductId, storeId]
    );
    const states = await client.query(
      `select
         (select status from stock_transfers where id = $1) as transfer_status,
         (select status from stock_counts where id = $2) as count_status`,
      [raceTransferId, raceCountId]
    );

    expect(dispatch.status).toBe('fulfilled');
    expect(approval.status).toBe('rejected');
    expect(balance.rows[0].quantity).toBe(90);
    expect(states.rows[0]).toEqual({ transfer_status: 'in-transit', count_status: 'submitted' });
  });
});
