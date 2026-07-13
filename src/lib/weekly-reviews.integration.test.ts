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
  });
});
