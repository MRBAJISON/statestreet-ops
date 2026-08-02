import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { testDatabaseUrl } from '../test-database';

const databaseUrl = testDatabaseUrl(process.env.TEST_DATABASE_URL);
const describeWithDatabase = databaseUrl ? describe : describe.skip;

describeWithDatabase('daily store report supplement', () => {
  const client = new Client({ connectionString: databaseUrl });
  let storeId: number;
  let productId: number;

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.DATABASE_DRIVER = 'node-postgres';
    await client.connect();
    await client.query(`
      truncate table
        customer_interactions, customers, performance_targets, products, brands, categories, stores, users
      restart identity cascade
    `);
    const userId = Number(
      (
        await client.query(
          `insert into users (name, email, password_hash, role, department)
           values ('Report Test', 'report-test@example.com', 'not-used', 'store-manager', 'commercial')
           returning id`
        )
      ).rows[0].id
    );
    storeId = Number(
      (await client.query(`insert into stores (code, name) values ('report-store', 'Report Store') returning id`)).rows[0].id
    );
    const categoryId = Number(
      (await client.query(`insert into categories (code, name, sort_order) values ('shirts', 'Shirts', 1) returning id`)).rows[0].id
    );
    const brandId = Number(
      (await client.query(`insert into brands (code, name) values ('report-brand', 'Report Brand') returning id`)).rows[0].id
    );
    productId = Number(
      (
        await client.query(
          `insert into products (sku, name, brand_id, category_id) values ('SKU-R1', 'Report Product', $1, $2) returning id`,
          [brandId, categoryId]
        )
      ).rows[0].id
    );
    // A 10-day store target covering 2026-07-10: 10,000 total -> 1,000/day.
    await client.query(
      `insert into performance_targets (metric, scope_type, store_id, period_type, period_start, period_end, value, unit, created_by_user_id, updated_by_user_id)
       values ('net-revenue', 'store', $1, 'month', '2026-07-01', '2026-07-10', '10000', 'money', $2, $2)`,
      [storeId, userId]
    );
    const customerId = Number(
      (
        await client.query(
          `insert into customers (name, phone, phone_normalized, created_by_user_id, updated_by_user_id)
           values ('Demo Customer', '0240000000', '0240000000', $1, $1) returning id`,
          [userId]
        )
      ).rows[0].id
    );
    await client.query(
      `insert into customer_interactions
         (customer_id, store_id, business_date, lifecycle, source, product_id, fulfillment_status, captured_by_user_id)
       values
         ($1, $2, '2026-07-10', 'lead', 'walk-in', $3, 'stock_gap', $4),
         ($1, $2, '2026-07-10', 'buyer', 'walk-in', $3, 'in_stock', $4)`,
      [customerId, storeId, productId, userId]
    );
  });

  afterAll(async () => {
    await client.end();
  });

  it('prorates the daily target and computes achievement, surplus, and customer requests for one store-day', async () => {
    const { getDailyStoreReportSupplement } = await import('./daily-store-report');
    const supplement = await getDailyStoreReportSupplement(storeId, '2026-07-10', 1450, 5);

    expect(supplement.dailyTarget).toBe(1000);
    expect(supplement.achievementPercent).toBeCloseTo(145, 0);
    expect(supplement.surplus).toBe(450);
    expect(supplement.statusText).toBe('Target Exceeded (+45.0%)');
    expect(supplement.avgTicketValue).toBe(290);
    expect(supplement.leadsCount).toBe(1);
    expect(supplement.followUpText).toContain('1 new lead captured');
    expect(supplement.customerRequests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ interest: 'Report Product', fulfillmentStatus: 'stock_gap' }),
        expect.objectContaining({ interest: 'Report Product', fulfillmentStatus: 'in_stock' }),
      ])
    );
  });

  it('reports no target set when nothing covers the date', async () => {
    const { getDailyStoreReportSupplement } = await import('./daily-store-report');
    const supplement = await getDailyStoreReportSupplement(storeId, '2026-08-01', 500, 2);

    expect(supplement.dailyTarget).toBe(0);
    expect(supplement.achievementPercent).toBe(0);
    expect(supplement.statusText).toBe('No target set');
  });
});
