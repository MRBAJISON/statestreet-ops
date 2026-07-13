import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import type { AppUser } from './auth';
import { testDatabaseUrl } from './test-database';

const databaseUrl = testDatabaseUrl(process.env.TEST_DATABASE_URL);
const describeWithDatabase = databaseUrl ? describe : describe.skip;

describeWithDatabase('workflow mutation SQL integration', () => {
  const client = new Client({ connectionString: databaseUrl });
  let user: AppUser;
  let expenseCategoryId: number;

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.DATABASE_DRIVER = 'node-postgres';
    await client.connect();
    await client.query('truncate table users, stores, expense_categories restart identity cascade');
    const userRow = await client.query(
      `insert into users (name, email, password_hash, role, department)
       values ('Finance Test', 'finance-workflow-test@example.com', 'not-used', 'finance', 'finance')
       returning id`
    );
    user = {
      id: String(userRow.rows[0].id),
      name: 'Finance Test',
      email: 'finance-workflow-test@example.com',
      role: 'finance',
      department: 'finance',
    };
    const category = await client.query(
      `insert into expense_categories (code, name, "group")
       values ('concurrent-expense', 'Concurrent Expense', 'operating')
       returning id`
    );
    expenseCategoryId = Number(category.rows[0].id);
    await client.query(
      `insert into budgets (
         year, expense_category_id, store_id, amount, created_by_user_id, updated_by_user_id
       ) values (2026, $1, null, 100, $2, $2)`,
      [expenseCategoryId, Number(user.id)]
    );
  });

  afterAll(async () => {
    await client.end();
  });

  it('serializes concurrent expenses against the same remaining budget', async () => {
    const { WORKFLOW_HANDLERS } = await import('./workflow-mutations');
    await client.query(`
      create function test_delay_expense_insert() returns trigger language plpgsql as $$
      begin
        perform pg_sleep(0.2);
        return new;
      end;
      $$;
      create trigger test_delay_expense_insert
      before insert on expenses for each row execute function test_delay_expense_insert();
    `);
    let attempts: PromiseSettledResult<Record<string, unknown>>[];
    try {
      attempts = await Promise.allSettled([
        WORKFLOW_HANDLERS.expense.execute(user, {
          businessDate: '2026-07-01',
          expenseCategoryId,
          amount: '80.00',
          description: 'Concurrent expense A',
        }),
        WORKFLOW_HANDLERS.expense.execute(user, {
          businessDate: '2026-07-01',
          expenseCategoryId,
          amount: '80.00',
          description: 'Concurrent expense B',
        }),
      ]);
    } finally {
      await client.query('drop trigger test_delay_expense_insert on expenses; drop function test_delay_expense_insert()');
    }
    const expenses = await client.query(
      `select count(*)::integer as count, coalesce(sum(amount), 0)::numeric::text as amount
       from expenses where expense_category_id = $1`,
      [expenseCategoryId]
    );

    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === 'rejected')).toHaveLength(1);
    expect(expenses.rows[0]).toEqual({ count: 1, amount: '80.00' });
  });

  it('serializes concurrent first saves for the same keyed target', async () => {
    const { WORKFLOW_HANDLERS } = await import('./workflow-mutations');
    await client.query(`
      create function test_delay_target_insert() returns trigger language plpgsql as $$
      begin
        perform pg_sleep(0.2);
        return new;
      end;
      $$;
      create trigger test_delay_target_insert
      before insert on performance_targets for each row execute function test_delay_target_insert();
    `);
    const input = {
      metric: 'net-revenue' as const,
      scopeType: 'group' as const,
      periodType: 'month' as const,
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
      unit: 'money' as const,
    };
    let attempts: PromiseSettledResult<Record<string, unknown>>[];
    try {
      attempts = await Promise.allSettled([
        WORKFLOW_HANDLERS.target.execute(user, { ...input, value: '100.00' }),
        WORKFLOW_HANDLERS.target.execute(user, { ...input, value: '200.00' }),
      ]);
    } finally {
      await client.query('drop trigger test_delay_target_insert on performance_targets; drop function test_delay_target_insert()');
    }
    const targets = await client.query(
      `select count(*)::integer as count, min(value)::numeric::text as value
       from performance_targets
       where metric = 'net-revenue' and scope_type = 'group'
         and period_start = '2026-08-01' and period_end = '2026-08-31'`
    );
    const audits = await client.query(
      `select action, before is not null as has_before
       from audit_events
       where entity_type = 'performance-target'
       order by id`
    );

    expect(
      attempts.map((attempt) =>
        attempt.status === 'fulfilled'
          ? { status: attempt.status }
          : {
              status: attempt.status,
              reason: `${String(attempt.reason)}\nCause: ${String(
                (attempt.reason as { cause?: unknown })?.cause
              )}`,
            }
      )
    ).toEqual([{ status: 'fulfilled' }, { status: 'fulfilled' }]);
    expect(targets.rows[0].count).toBe(1);
    expect(['100.00', '200.00']).toContain(targets.rows[0].value);
    expect(audits.rows).toEqual([
      { action: 'create', has_before: false },
      { action: 'update', has_before: true },
    ]);
  });

  it('rejects store-manager action decisions without mutating the action or audit log', async () => {
    const managerRow = await client.query(
      `insert into users (name, email, password_hash, role, department, store)
       values ('Store Manager Test', 'store-manager-action-test@example.com', 'not-used', 'store-manager', 'commercial', 'test-store')
       returning id`
    );
    const actionRow = await client.query(
      `insert into action_items (
         department, title, owner_user_id, created_by_user_id, updated_by_user_id
       ) values ('commercial', 'Commercial leadership action', $1, $1, $1)
       returning id`,
      [Number(user.id)]
    );
    const actionId = Number(actionRow.rows[0].id);
    const manager: AppUser = {
      id: String(managerRow.rows[0].id),
      name: 'Store Manager Test',
      email: 'store-manager-action-test@example.com',
      role: 'store-manager',
      department: 'commercial',
      store: 'test-store',
    };
    const { decideAction } = await import('./workflow-decisions');

    await expect(decideAction(manager, actionId, { status: 'completed' })).rejects.toMatchObject({
      status: 403,
      message: 'Forbidden',
    });
    expect((await client.query('select status from action_items where id = $1', [actionId])).rows[0].status).toBe('open');
    expect(
      (
        await client.query(
          `select count(*)::integer as count from audit_events
           where entity_type = 'action-item' and entity_id = $1`,
          [actionId]
        )
      ).rows[0].count
    ).toBe(0);
  });
});
