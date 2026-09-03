import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import type { AppUser } from './auth';
import { testDatabaseUrl } from './test-database';

const databaseUrl = testDatabaseUrl(process.env.TEST_DATABASE_URL);
const describeWithDatabase = databaseUrl ? describe : describe.skip;

describeWithDatabase('weekly review SQL integration', () => {
  const client = new Client({ connectionString: databaseUrl });
  let manager: AppUser;

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.DATABASE_DRIVER = 'node-postgres';
    await client.connect();
    await client.query('truncate table users, stores restart identity cascade');
    const user = await client.query(
      `insert into users (name, email, password_hash, role, department, store)
       values ('Weekly Review Manager', 'weekly-review-manager@example.com', 'not-used', 'store-manager', 'commercial', 'weekly-review-store')
       returning id`
    );
    await client.query(
      `insert into stores (code, name, type)
       values ('weekly-review-store', 'Weekly Review Store', 'store')`
    );
    manager = {
      id: String(user.rows[0].id),
      name: 'Weekly Review Manager',
      email: 'weekly-review-manager@example.com',
      role: 'store-manager',
      department: 'commercial',
      store: 'weekly-review-store',
    };
  });

  afterAll(async () => {
    await client.end();
  });

  it('serializes concurrent first saves for the same store and week', async () => {
    await client.query(`
      create function test_delay_weekly_review_insert() returns trigger language plpgsql as $$
      begin
        perform pg_sleep(0.2);
        return new;
      end;
      $$;
      create trigger test_delay_weekly_review_insert
      before insert on weekly_reviews for each row execute function test_delay_weekly_review_insert();
    `);
    const { saveWeeklyReview } = await import('./weekly-reviews');
    let attempts: PromiseSettledResult<Record<string, unknown>>[];
    try {
      attempts = await Promise.allSettled([
        saveWeeklyReview(manager, {
          weekEnd: '2026-07-12',
          status: 'draft',
          summary: 'Concurrent review A',
          categoryNotes: [],
          actions: [],
        }),
        saveWeeklyReview(manager, {
          weekEnd: '2026-07-12',
          status: 'draft',
          summary: 'Concurrent review B',
          categoryNotes: [],
          actions: [],
        }),
      ]);
    } finally {
      await client.query(
        'drop trigger test_delay_weekly_review_insert on weekly_reviews; drop function test_delay_weekly_review_insert()'
      );
    }

    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
    const rejected = attempts.filter((attempt) => attempt.status === 'rejected');
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ status: 409 });
    expect(
      (
        await client.query(
          `select count(*)::integer as count from weekly_reviews
           where week_end = '2026-07-12'`
        )
      ).rows[0].count
    ).toBe(1);
    expect(
      (
        await client.query(
          `select count(*)::integer as count from audit_events
           where entity_type = 'weekly-review'`
        )
      ).rows[0].count
    ).toBe(1);
  }, 15000);

  it('requires every store category and derives Stock at Risk from selling price', async () => {
    const { saveWeeklyReview } = await import('./weekly-reviews');
    const suffix = Date.now().toString();
    const storeId = (await client.query(`select id from stores where code = 'weekly-review-store'`)).rows[0].id;
    const brand = await client.query(
      `insert into brands (code, name) values ($1, $2) returning id`,
      [`weekly-review-brand-${suffix}`, `Weekly Review Brand ${suffix}`]
    );
    const categoryOne = await client.query(
      `insert into categories (code, name, sort_order) values ($1, $2, 1) returning id`,
      [`weekly-review-category-one-${suffix}`, `Weekly Review Category One ${suffix}`]
    );
    const categoryTwo = await client.query(
      `insert into categories (code, name, sort_order) values ($1, $2, 2) returning id`,
      [`weekly-review-category-two-${suffix}`, `Weekly Review Category Two ${suffix}`]
    );
    const categoryOneId = Number(categoryOne.rows[0].id);
    const categoryTwoId = Number(categoryTwo.rows[0].id);
    await client.query(`insert into brand_stores (brand_id, store_id) values ($1, $2)`, [brand.rows[0].id, storeId]);
    await client.query(`insert into brand_categories (brand_id, category_id) values ($1, $2), ($1, $3)`, [
      brand.rows[0].id,
      categoryOne.rows[0].id,
      categoryTwo.rows[0].id,
    ]);
    const product = await client.query(
      `insert into products (sku, name, brand_id, category_id, selling_price)
       values ($1, $2, $3, $4, 125.00) returning id`,
      [`WEEKLY-REVIEW-${suffix}`, `Weekly Review Product ${suffix}`, brand.rows[0].id, categoryOne.rows[0].id]
    );
    await client.query(
      `insert into store_stock_levels (store_id, product_id, quantity, as_of_date)
       values ($1, $2, 4, '2026-07-19')`,
      [storeId, product.rows[0].id]
    );

    const base = {
      weekEnd: '2026-07-19' as const,
      actions: [] as [],
    };
    await expect(saveWeeklyReview(manager, {
      ...base,
      status: 'submitted',
      categoryNotes: [{ categoryId: categoryOneId, performanceComment: 'Reviewed', overstocked: true, slowMoving: false }],
    })).rejects.toMatchObject({ status: 400 });

    const record = await saveWeeklyReview(manager, {
      ...base,
      status: 'submitted',
      categoryNotes: [
        {
          categoryId: categoryOneId,
          performanceComment: 'Reviewed stock position',
          overstocked: true,
          slowMoving: false,
          valueAtRisk: '999999.99',
          correctiveAction: 'Run a focused promotion',
        },
        { categoryId: categoryTwoId, performanceComment: 'Reviewed and no issue found', overstocked: false, slowMoving: false },
      ],
    });

    expect(record).toMatchObject({ status: 'submitted', categoryNoteCount: 2 });
    const stored = await client.query(
      `select category_id::integer as category_id, value_at_risk::text as value_at_risk
       from weekly_review_category_notes
       where weekly_review_id = (select id from weekly_reviews where store_id = $1 and week_end = '2026-07-19')
       order by category_id`,
      [storeId]
    );
    expect(stored.rows).toEqual([
      { category_id: categoryOneId, value_at_risk: '500.00' },
      { category_id: categoryTwoId, value_at_risk: null },
    ]);
  });
});
