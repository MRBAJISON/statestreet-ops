import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { saveDailyReportSchema } from './contracts/daily-report';
import {
  buildCreateDailyReportQuery,
  buildDecideDailyReportQuery,
  buildReplaceDailyReportQuery,
} from './daily-report-queries';

const databaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = databaseUrl ? describe : describe.skip;
const dialect = new PgDialect();

describeWithDatabase('daily report SQL integration', () => {
  const client = new Client({ connectionString: databaseUrl });
  let userId: number;
  let storeId: number;
  let categoryOneId: number;
  let categoryTwoId: number;
  let paymentOneId: number;
  let paymentTwoId: number;

  async function execute(query: SQL) {
    const compiled = dialect.sqlToQuery(query);
    return client.query(compiled.sql, compiled.params);
  }

  beforeAll(async () => {
    await client.connect();
    await client.query(`
      truncate table
        audit_events, daily_payment_lines, daily_sales_lines, daily_reports,
        payment_methods, categories, stores, users
      restart identity cascade
    `);
    userId = Number(
      (
        await client.query(
          `insert into users (name, email, password_hash, role, department)
           values ('Finance Test', 'finance-test@example.com', 'not-used', 'finance', 'finance')
           returning id`
        )
      ).rows[0].id
    );
    storeId = Number(
      (await client.query(`insert into stores (code, name) values ('test-store', 'Test Store') returning id`)).rows[0].id
    );
    const categoryRows = await client.query(
      `insert into categories (code, name, sort_order)
       values ('shirts', 'Shirts', 1), ('shoes', 'Shoes', 2)
       returning id, code`
    );
    categoryOneId = Number(categoryRows.rows.find((row) => row.code === 'shirts')?.id);
    categoryTwoId = Number(categoryRows.rows.find((row) => row.code === 'shoes')?.id);
    const paymentRows = await client.query(
      `insert into payment_methods (code, name, sort_order)
       values ('cash', 'Cash', 1), ('card', 'Card', 2)
       returning id, code`
    );
    paymentOneId = Number(paymentRows.rows.find((row) => row.code === 'cash')?.id);
    paymentTwoId = Number(paymentRows.rows.find((row) => row.code === 'card')?.id);
  });

  afterAll(async () => {
    await client.end();
  });

  it('creates, replaces, locks, approves, and reopens atomically', async () => {
    const initial = saveDailyReportSchema.parse({
      businessDate: '2026-07-10',
      status: 'draft',
      transactions: 10,
      footfall: 16,
      totalCustomers: 8,
      newCustomers: 3,
      returningCustomers: 5,
      sales: [
        {
          categoryId: categoryOneId,
          openingStock: 20,
          unitsSold: 4,
          grossRevenue: '1000',
          cogs: '500',
        },
      ],
      payments: [{ paymentMethodId: paymentOneId, amount: '1000' }],
    });
    const created = await execute(buildCreateDailyReportQuery(userId, storeId, initial));
    expect(created.rows[0]).toMatchObject({ lock_version: 1, sales_count: 1, payment_count: 1 });
    const reportId = Number(created.rows[0].id);

    await expect(execute(buildCreateDailyReportQuery(userId, storeId, initial))).rejects.toMatchObject({ code: '23505' });
    expect((await client.query('select count(*)::integer as count from daily_reports')).rows[0].count).toBe(1);
    expect((await client.query('select count(*)::integer as count from audit_events')).rows[0].count).toBe(1);

    const submitted = saveDailyReportSchema.parse({
      ...initial,
      status: 'submitted',
      transactions: 12,
      sales: [
        {
          categoryId: categoryTwoId,
          openingStock: 14,
          unitsSold: 3,
          grossRevenue: '750',
          cogs: '350',
          discounts: '50',
          creditSales: '100',
        },
      ],
      payments: [{ paymentMethodId: paymentTwoId, amount: '600' }],
    });
    const replaced = await execute(buildReplaceDailyReportQuery(userId, reportId, { ...submitted, lockVersion: 1 }));
    expect(replaced.rows[0]).toMatchObject({ lock_version: 2, sales_count: 1, payment_count: 1 });
    expect(
      (await client.query('select category_id from daily_sales_lines where daily_report_id = $1', [reportId])).rows.map(
        (row) => Number(row.category_id)
      )
    ).toEqual([categoryTwoId]);
    expect(
      (await client.query('select payment_method_id from daily_payment_lines where daily_report_id = $1', [reportId])).rows.map(
        (row) => Number(row.payment_method_id)
      )
    ).toEqual([paymentTwoId]);

    const stale = await execute(buildReplaceDailyReportQuery(userId, reportId, { ...submitted, lockVersion: 1 }));
    expect(stale.rowCount).toBe(0);
    expect((await client.query('select lock_version from daily_reports where id = $1', [reportId])).rows[0].lock_version).toBe(2);

    const approved = await execute(buildDecideDailyReportQuery(userId, reportId, 'approve', 2));
    expect(approved.rows[0]).toMatchObject({ status: 'approved', lock_version: 3 });
    const locked = await execute(buildReplaceDailyReportQuery(userId, reportId, { ...submitted, lockVersion: 3 }));
    expect(locked.rowCount).toBe(0);

    const reopened = await execute(
      buildDecideDailyReportQuery(userId, reportId, 'reopen', 3, 'Correcting the payment split')
    );
    expect(reopened.rows[0]).toMatchObject({ status: 'submitted', lock_version: 4 });
    const audit = await client.query(
      `select action, before, after, metadata
       from audit_events where entity_type = 'daily-report' and entity_id = $1 order by id`,
      [reportId]
    );
    expect(audit.rows.map((row) => row.action)).toEqual(['create', 'update', 'approve', 'reopen']);
    expect(audit.rows[1].before.sales[0].category_id).toBe(categoryOneId);
    expect(audit.rows[1].after.sales[0].categoryId).toBe(categoryTwoId);
    expect(audit.rows[2].before.status).toBe('submitted');
    expect(audit.rows[2].after.status).toBe('approved');
    expect(audit.rows[3].metadata).toEqual({ reason: 'Correcting the payment split' });
  });
});
