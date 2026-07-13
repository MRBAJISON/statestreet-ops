import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { testDatabaseUrl } from '../test-database';

const databaseUrl = testDatabaseUrl(process.env.TEST_DATABASE_URL);
const describeWithDatabase = databaseUrl ? describe : describe.skip;

describeWithDatabase('reporting SQL integration', () => {
  const client = new Client({ connectionString: databaseUrl });
  let reportId: number;
  let storeId: number;
  let userId: number;

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.DATABASE_DRIVER = 'node-postgres';
    await client.connect();
    await client.query('truncate table entries, users, stores, brands, categories, expense_categories restart identity cascade');
    userId = Number(
      (
        await client.query(
          `insert into users (name, email, password_hash, role, department)
           values ('Reporting Test', 'reporting-test@example.com', 'not-used', 'finance', 'finance')
           returning id`
        )
      ).rows[0].id
    );
    storeId = Number(
      (await client.query(`insert into stores (code, name) values ('multi-brand', 'Multi Brand Store') returning id`)).rows[0].id
    );
    const brandRows = await client.query(
      `insert into brands (code, name) values ('brand-a', 'Brand A'), ('brand-b', 'Brand B') returning id`
    );
    for (const brand of brandRows.rows) {
      await client.query('insert into brand_stores (brand_id, store_id) values ($1, $2)', [brand.id, storeId]);
    }
    const categoryId = Number(
      (await client.query(`insert into categories (code, name) values ('reporting', 'Reporting') returning id`)).rows[0].id
    );
    const secondCategoryId = Number(
      (await client.query(`insert into categories (code, name) values ('reporting-2', 'Reporting 2') returning id`)).rows[0].id
    );
    reportId = Number(
      (
        await client.query(
          `insert into daily_reports (
             store_id, business_date, status, transactions, footfall, created_by_user_id, updated_by_user_id
           ) values ($1, '2026-07-10', 'approved', 7, 10, $2, $2)
           returning id`,
          [storeId, userId]
        )
      ).rows[0].id
    );
    await client.query(
      `insert into daily_sales_lines (
         daily_report_id, category_id, opening_stock, units_sold, gross_revenue, cogs
       ) values
         ($1, $2, 10, 2, 100, 40),
         ($1, $3, 5, 1, 50, 20)`,
      [reportId, categoryId, secondCategoryId]
    );
  });

  afterAll(async () => {
    await client.end();
  });

  it('counts report-level transactions once and leaves multi-brand revenue unassigned', async () => {
    const [{ getFinanceDomain }, { getTradingOverview }] = await Promise.all([
      import('./finance'),
      import('./trading'),
    ]);
    const scope = {
      preset: 'custom' as const,
      from: '2026-07-01',
      to: '2026-07-31',
      compareFrom: '2026-06-01',
      compareTo: '2026-06-30',
      store: null,
    };
    const [finance, trading] = await Promise.all([getFinanceDomain(scope), getTradingOverview(scope)]);

    expect(finance.dailySalesByStore[0]).toMatchObject({ revenue: 150, transactions: 7, units: 3, reports: 1 });
    expect(trading.stores[0]?.brandName).toBeNull();
    expect(trading.brands).toEqual([{ name: 'Unassigned', value: 150 }]);
  });

  it('prefers group targets for group dashboards and store targets for a selected store', async () => {
    await client.query(
      `insert into performance_targets (
         metric, scope_type, store_id, period_type, period_start, period_end, value, unit,
         created_by_user_id, updated_by_user_id
       ) values
         ('net-revenue', 'group', null, 'month', '2026-07-01', '2026-07-31', 3100, 'money', $1, $1),
         ('net-revenue', 'store', $2, 'month', '2026-07-01', '2026-07-31', 6200, 'money', $1, $1)`,
      [userId, storeId]
    );
    const { getTradingOverview } = await import('./trading');
    const baseScope = {
      preset: 'custom' as const,
      from: '2026-07-01',
      to: '2026-07-31',
      compareFrom: '2026-06-01',
      compareTo: '2026-06-30',
    };
    const [group, store] = await Promise.all([
      getTradingOverview({ ...baseScope, store: null }),
      getTradingOverview({
        ...baseScope,
        store: { id: storeId, code: 'multi-brand', name: 'Multi Brand Store' },
      }),
    ]);

    expect(group.summary.targetRevenue).toBe(3100);
    expect(group.trend.find((point) => point.date === '2026-07-10')?.target).toBe(100);
    expect(store.summary.targetRevenue).toBe(6200);
    expect(store.trend.find((point) => point.date === '2026-07-10')?.target).toBe(200);
  });

  it('uses group budgets when present and otherwise sums store budgets for group reporting', async () => {
    const otherStoreId = Number(
      (await client.query(`insert into stores (code, name) values ('budget-store', 'Budget Store') returning id`)).rows[0].id
    );
    const expenseCategoryId = Number(
      (
        await client.query(
          `insert into expense_categories (code, name, "group")
           values ('reporting-budget', 'Reporting Budget', 'operating')
           returning id`
        )
      ).rows[0].id
    );
    await client.query(
      `insert into budgets (
         year, expense_category_id, store_id, amount, created_by_user_id, updated_by_user_id
       ) values
         (2026, $1, $2, 1200, $4, $4),
         (2026, $1, $3, 2400, $4, $4)`,
      [expenseCategoryId, storeId, otherStoreId, userId]
    );
    await client.query(
      `insert into expenses (
         business_date, expense_category_id, store_id, amount, description,
         created_by_user_id, updated_by_user_id
       ) values
         ('2026-07-10', $1, $2, 100, 'Primary store expense', $4, $4),
         ('2026-07-10', $1, $3, 200, 'Other store expense', $4, $4)`,
      [expenseCategoryId, storeId, otherStoreId, userId]
    );
    const { getFinanceDomain } = await import('./finance');
    const baseScope = {
      preset: 'custom' as const,
      from: '2026-01-01',
      to: '2026-12-31',
      compareFrom: '2025-01-01',
      compareTo: '2025-12-31',
    };
    const [groupFromStores, selectedStore] = await Promise.all([
      getFinanceDomain({ ...baseScope, store: null }),
      getFinanceDomain({
        ...baseScope,
        store: { id: storeId, code: 'multi-brand', name: 'Multi Brand Store' },
      }),
    ]);

    expect(groupFromStores.budget).toMatchObject({ budget: 3600, actual: 300, variance: 3300, utilization: 8.3 });
    expect(selectedStore.budget).toMatchObject({ budget: 1200, actual: 100, variance: 1100, utilization: 8.3 });

    await client.query(
      `insert into budgets (
         year, expense_category_id, store_id, amount, created_by_user_id, updated_by_user_id
       ) values (2026, $1, null, 6000, $2, $2)`,
      [expenseCategoryId, userId]
    );
    const groupBudget = await getFinanceDomain({ ...baseScope, store: null });

    expect(groupBudget.budget).toMatchObject({ budget: 6000, actual: 300, variance: 5700, utilization: 5 });
  });

  it('gates only unresolved legacy daily-report sources', async () => {
    const { getLegacyBackfillStatus } = await import('./readiness');
    await client.query(
      `insert into entries (department, form_type, payload)
       values ('marketing', 'campaign', '{"name":"Historical campaign"}'::jsonb)`
    );
    await expect(getLegacyBackfillStatus()).resolves.toEqual({ ready: true, remainingEntries: 0 });

    const legacyEntryId = Number(
      (
        await client.query(
          `insert into entries (department, form_type, payload)
           values ('finance', 'revenue', '{"store":"multi-brand"}'::jsonb)
           returning id`
        )
      ).rows[0].id
    );
    await expect(getLegacyBackfillStatus()).resolves.toEqual({ ready: false, remainingEntries: 1 });

    await client.query(
      'insert into daily_report_legacy_entries (daily_report_id, entry_id) values ($1, $2)',
      [reportId, legacyEntryId]
    );
    await expect(getLegacyBackfillStatus()).resolves.toEqual({ ready: true, remainingEntries: 0 });
  });

  it('makes ledgered legacy source rows immutable', async () => {
    const entryId = Number(
      (await client.query(
        `insert into entries (department, form_type, payload)
         values ('marketing', 'campaign', '{"name":"Frozen source"}'::jsonb)
         returning id`
      )).rows[0].id
    );
    await client.query(
      `insert into legacy_migration_records (
         entry_id, disposition, source_created_at, source_payload_hash, migrated_by_user_id
       ) select id, 'retained', created_at, repeat('0', 64), $2 from entries where id = $1`,
      [entryId, userId]
    );

    await expect(client.query(`update entries set payload = '{"name":"Changed"}'::jsonb where id = $1`, [entryId]))
      .rejects.toMatchObject({ code: '55000' });
    await expect(client.query('delete from entries where id = $1', [entryId]))
      .rejects.toMatchObject({ code: '55000' });
    await expect(client.query(
      `update legacy_migration_records set note = 'Changed' where entry_id = $1`,
      [entryId]
    )).rejects.toMatchObject({ code: '55000' });
    await expect(client.query('delete from legacy_migration_records where entry_id = $1', [entryId]))
      .rejects.toMatchObject({ code: '55000' });
    await expect(client.query(
      `insert into entries (department, form_type, payload)
       values ('marketing', 'campaign', '{"name":"Late source"}'::jsonb)`
    )).rejects.toMatchObject({ code: '55000' });
    await expect(client.query('select id from entries where id = $1', [entryId]))
      .resolves.toMatchObject({ rowCount: 1 });
  });

  it('scopes activity to events associated with the selected store', async () => {
    const otherStoreId = Number(
      (await client.query(`insert into stores (code, name) values ('other-store', 'Other Store') returning id`)).rows[0].id
    );
    await client.query(
      `insert into audit_events (entity_type, entity_id, action, actor_user_id, after, created_at) values
         ('expense', 901, 'create', $1, jsonb_build_object('store_id', $2::bigint), '2026-07-11 09:00:00+00'),
         ('stock-transfer', 902, 'create', $1, jsonb_build_object('document', jsonb_build_object('from_store_id', $3::bigint, 'to_store_id', $2::bigint)), '2026-07-11 10:00:00+00'),
         ('expense', 903, 'create', $1, jsonb_build_object('store_id', $3::bigint), '2026-07-11 11:00:00+00'),
         ('organization-settings', 1, 'update', $1, '{"currency":"GHS"}'::jsonb, '2026-07-11 12:00:00+00')`,
      [userId, storeId, otherStoreId]
    );
    await client.query(
      `insert into audit_events (entity_type, entity_id, action, actor_user_id, before, after, created_at)
       values ('maintenance-request', 904, 'update', $1,
               jsonb_build_object('store_id', $2::bigint),
               jsonb_build_object('store_id', $3::bigint),
               '2026-07-11 10:30:00+00')`,
      [userId, storeId, otherStoreId]
    );
    const { getActivityFeed } = await import('./activity');
    const activity = await getActivityFeed({
      preset: 'custom',
      from: '2026-07-11',
      to: '2026-07-11',
      compareFrom: '2026-07-10',
      compareTo: '2026-07-10',
      store: { id: storeId, code: 'multi-brand', name: 'Multi Brand Store' },
    });

    expect(activity.map((event) => event.entityId)).toEqual([904, 902, 901]);
  });

  it('uses the latest aggregate inventory snapshot when product movements do not exist', async () => {
    const snapshotOnlyStoreId = Number(
      (await client.query(`insert into stores (code, name) values ('snapshot-only', 'Snapshot Only') returning id`)).rows[0].id
    );
    await client.query(
      `insert into inventory_summary_snapshots (
         business_date, store_id, system_quantity, physical_quantity, stock_value,
         created_by_user_id, updated_by_user_id
       ) values
         ('2026-07-12', $1, 100, 98, 15000, $3, $3),
         ('2026-07-12', $2, 50, 50, 5000, $3, $3)`,
      [storeId, snapshotOnlyStoreId, userId]
    );
    const { getInventoryDomain } = await import('./inventory');
    const inventory = await getInventoryDomain({
      preset: 'custom',
      from: '2026-07-01',
      to: '2026-07-31',
      compareFrom: '2026-06-01',
      compareTo: '2026-06-30',
      store: { id: storeId, code: 'multi-brand', name: 'Multi Brand Store' },
    });

    expect(inventory.summary).toMatchObject({ unitsOnHand: 98, inventoryValue: 15000, stockAccuracy: 98 });
    expect(inventory.stock).toEqual([]);

    const productId = Number(
      (await client.query(
        `insert into products (sku, name, brand_id, category_id, unit_cost, created_by_user_id, updated_by_user_id)
         values ('INV-MIXED', 'Mixed Coverage', (select min(id) from brands),
           (select min(id) from categories), 10, $1, $1)
         returning id`,
        [userId]
      )).rows[0].id
    );
    await client.query(
      `insert into inventory_movements (
         business_date, product_id, store_id, movement_type, quantity, unit_cost,
         source_type, created_by_user_id
       ) values
         ('2026-07-11', $1, $2, 'opening-balance', 100, 10, 'test', $3),
         ('2026-07-12', $1, $2, 'count-adjustment', 2, 10, 'test', $3),
         ('2026-07-13', $1, $2, 'receipt', 3, 10, 'test', $3)`,
      [productId, storeId, userId]
    );
    const mixed = await getInventoryDomain({
      preset: 'custom', from: '2026-07-01', to: '2026-07-31',
      compareFrom: '2026-06-01', compareTo: '2026-06-30', store: null,
    });
    expect(mixed.summary).toMatchObject({ unitsOnHand: 153, inventoryValue: 20050 });
    expect(mixed.stock).toEqual([]);

    const scopedMixed = await getInventoryDomain({
      preset: 'custom', from: '2026-07-01', to: '2026-07-31',
      compareFrom: '2026-06-01', compareTo: '2026-06-30',
      store: { id: storeId, code: 'multi-brand', name: 'Multi Brand Store' },
    });
    expect(scopedMixed.summary).toMatchObject({ unitsOnHand: 103, inventoryValue: 15050 });
    expect(scopedMixed.stock).toEqual([]);

    const nextMonth = await getInventoryDomain({
      preset: 'custom', from: '2026-08-01', to: '2026-08-31',
      compareFrom: '2026-07-01', compareTo: '2026-07-31', store: null,
    });
    expect(nextMonth.summary).toMatchObject({ unitsOnHand: 153, inventoryValue: 20050, stockAccuracy: 0 });
  });

  it('uses overlapping product insight metrics only for group reporting', async () => {
    const productId = Number(
      (await client.query(
        `insert into products (sku, name, brand_id, category_id, unit_cost, created_by_user_id, updated_by_user_id)
         values ('INSIGHT-SCOPE', 'Insight Scope', (select min(id) from brands),
           (select min(id) from categories), 20, $1, $1)
         returning id`,
        [userId]
      )).rows[0].id
    );
    await client.query(
      `insert into product_insights (
         product_id, period_start, period_end, status, units_sold, current_stock, days_in_stock,
         created_by_user_id, updated_by_user_id
       ) values
         ($1, '2026-06-01', '2026-06-30', 'slow', 99, 88, 60, $2, $2),
         ($1, '2026-07-01', '2026-07-31', 'active', 7, 6, 12, $2, $2)`,
      [productId, userId]
    );
    const { getCommercialDomain } = await import('./commercial');
    const baseScope = {
      preset: 'custom' as const,
      from: '2026-07-01',
      to: '2026-07-31',
      compareFrom: '2026-06-01',
      compareTo: '2026-06-30',
    };
    const [group, store] = await Promise.all([
      getCommercialDomain({ ...baseScope, store: null }),
      getCommercialDomain({
        ...baseScope,
        store: { id: storeId, code: 'multi-brand', name: 'Multi Brand Store' },
      }),
    ]);

    expect(group.productVelocity.find((product) => product.id === productId)).toMatchObject({
      unitsSold: 7,
      stock: 6,
      daysSinceMovement: 12,
    });
    expect(store.productVelocity.find((product) => product.id === productId)).toBeUndefined();

    const august = await getCommercialDomain({
      ...baseScope,
      from: '2026-08-01',
      to: '2026-08-31',
      store: null,
    });
    expect(august.productVelocity.find((product) => product.id === productId)).toMatchObject({
      unitsSold: 0,
      stock: 0,
    });
  });
});
