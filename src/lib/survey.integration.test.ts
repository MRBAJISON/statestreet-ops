import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { NextRequest } from 'next/server';
import { testDatabaseUrl } from './test-database';

const databaseUrl = testDatabaseUrl(process.env.TEST_DATABASE_URL);
const describeWithDatabase = databaseUrl ? describe : describe.skip;

describeWithDatabase('public survey SQL integration', () => {
  const client = new Client({ connectionString: databaseUrl });
  let storeId: number;

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.DATABASE_DRIVER = 'node-postgres';
    process.env.AUTH_SECRET = 'survey-integration-secret';
    await client.connect();
    await client.query('truncate table stores, brands restart identity cascade');
    storeId = Number(
      (await client.query(`insert into stores (code, name) values ('survey-store', 'Survey Store') returning id`)).rows[0].id
    );
    const brandRows = await client.query(
      `insert into brands (code, name) values ('survey-a', 'Survey A'), ('survey-b', 'Survey B') returning id`
    );
    for (const brand of brandRows.rows) {
      await client.query('insert into brand_stores (brand_id, store_id) values ($1, $2)', [brand.id, storeId]);
    }
  });

  afterAll(async () => {
    await client.end();
  });

  it('does not invent brand attribution for feedback from a multi-brand store', async () => {
    const { POST } = await import('../app/api/survey/route');
    const response = await POST(
      new NextRequest('http://localhost/api/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '127.0.0.77' },
        body: JSON.stringify({
          storeId,
          category: 'overall',
          npsScore: 9,
          detail: 'Survey fixture',
          contactConsent: false,
        }),
      })
    );
    const feedback = await client.query(
      `select store_id, brand_id from customer_feedback where source = 'survey' order by id desc limit 1`
    );

    expect(response.status).toBe(201);
    expect(feedback.rows[0]).toMatchObject({ store_id: String(storeId), brand_id: null });
  });

  it('authenticates scheduled cleanup and redacts expired contact data', async () => {
    await client.query(
      `insert into customer_feedback (
         business_date, source, type, detail, store_id, contact_name, contact_value,
         contact_consent, retention_until
       ) values (current_date, 'retention-test', 'customer-experience', 'Expired contact', $1,
         'Expired Contact', 'expired@example.com', true, current_date - 1)`,
      [storeId]
    );
    process.env.CRON_SECRET = 'survey-retention-test-secret';
    const { GET } = await import('../app/api/cron/customer-data-retention/route');

    const unauthorized = await GET(new NextRequest('http://localhost/api/cron/customer-data-retention'));
    expect(unauthorized.status).toBe(401);

    const response = await GET(
      new NextRequest('http://localhost/api/cron/customer-data-retention', {
        headers: { authorization: 'Bearer survey-retention-test-secret' },
      })
    );
    const result = await response.json();
    const feedback = await client.query(
      `select contact_name, contact_value, contact_consent, contact_redacted_at
       from customer_feedback where source = 'retention-test'`
    );

    expect(response.status).toBe(200);
    expect(result.redacted).toBeGreaterThanOrEqual(1);
    expect(feedback.rows[0]).toMatchObject({
      contact_name: null,
      contact_value: null,
      contact_consent: false,
    });
    expect(feedback.rows[0].contact_redacted_at).toBeTruthy();
  });
});
