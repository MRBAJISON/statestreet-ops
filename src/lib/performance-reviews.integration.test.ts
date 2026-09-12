import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { testDatabaseUrl } from './test-database';
import type { AppUser } from './auth';
import { saveDailyReportSchema } from './contracts/daily-report';
import { saveMonthlyReviewSchema } from './contracts/monthly-review';
import { tradingDaysBetween } from './reporting/store-period';
const url = testDatabaseUrl(process.env.TEST_DATABASE_URL);
const suite = url ? describe : describe.skip;
suite('performance reporting and stock integrity', () => {
  const client = new Client({ connectionString: url });
  let manager: AppUser,
    storeId: number,
    categoryId: number,
    productId: number,
    paymentMethodId: number;
  let monthly: typeof import('./monthly-reviews');
  let products: typeof import('./reporting/product-performance');
  let daily: typeof import('./daily-reports');
  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.DATABASE_DRIVER = 'node-postgres';
    await client.connect();
    await client.query(
      'truncate table entries,users,stores,brands,categories restart identity cascade'
    );
    monthly = await import('./monthly-reviews');
    products = await import('./reporting/product-performance');
    daily = await import('./daily-reports');
  }, 120000);
  beforeEach(async () => {
    const key = randomUUID().slice(0, 8);
    storeId = Number(
      (
        await client.query(
          "insert into stores(code,name) values($1,'Performance Store') returning id",
          [key]
        )
      ).rows[0].id
    );
    const user = Number(
      (
        await client.query(
          "insert into users(name,email,password_hash,role,department,store) values('Manager',$1,'not-used','store-manager','commercial',$2) returning id",
          [`${key}@example.test`, key]
        )
      ).rows[0].id
    );
    manager = {
      id: String(user),
      name: 'Manager',
      email: `${key}@example.test`,
      role: 'store-manager',
      department: 'commercial',
      store: key,
    };
    categoryId = Number(
      (
        await client.query(
          "insert into categories(code,name) values($1,'Test category') returning id",
          [key]
        )
      ).rows[0].id
    );
    paymentMethodId = Number(
      (
        await client.query(
          "insert into payment_methods(code,name) values($1,'Cash') returning id",
          [key]
        )
      ).rows[0].id
    );
    const brand = Number(
      (
        await client.query(
          "insert into brands(code,name) values($1,'Test brand') returning id",
          [key]
        )
      ).rows[0].id
    );
    productId = Number(
      (
        await client.query(
          "insert into products(sku,name,category_id,brand_id,selling_price,unit_cost) values($3,'Test shoe',$1,$2,25,4) returning id",
          [categoryId, brand, key]
        )
      ).rows[0].id
    );
    await client.query('begin');
    await client.query(
      "select set_config('statestreet.stock_posting','on',true)"
    );
    await client.query(
      "insert into store_stock_levels(store_id,product_id,quantity,as_of_date) values($1,$2,100,'2026-07-01')",
      [storeId, productId]
    );
    await client.query(
      "insert into stock_history_baselines(store_id,product_id,as_of_date,quantity,lots) values($1,$2,'2026-07-01',100,$3::jsonb)",
      [
        storeId,
        productId,
        JSON.stringify([
          { quantity: 100, receiptDate: '2026-07-01', assumed: true },
        ]),
      ]
    );
    await client.query('commit');
  }, 30000);
  afterAll(async () => {
    await client.end();
  });
  it('persists daily product units/value and reverses/resubmits stock only once', async () => {
    const input = saveDailyReportSchema.parse({
      businessDate: '2026-08-01',
      status: 'submitted',
      transactions: 1,
      footfall: 1,
      totalCustomers: 1,
      newCustomers: 1,
      returningCustomers: 0,
      sales: [
        {
          categoryId,
          unitsSold: 2,
          grossRevenue: '50.00',
          cogs: '8.00',
          products: [{ productId, unitsSold: 2, lineValue: '50.00' }],
        },
      ],
      payments: [{ paymentMethodId, amount: '50.00' }],
    });
    const report = await daily.createDailyReport(manager, storeId, input);
    expect(
      (await client.query('select units,line_value from daily_report_products'))
        .rows[0]
    ).toMatchObject({ units: 2, line_value: '50.00' });
    const balance = async () =>
      Number(
        (
          await client.query(
            'select quantity from store_stock_levels where store_id=$1',
            [storeId]
          )
        ).rows[0].quantity
      );
    expect(await balance()).toBe(98);
    await client.query(
      'update daily_reports set lock_version=lock_version+1 where id=$1',
      [report.id]
    );
    expect(await balance()).toBe(98);
    await client.query(
      "update daily_reports set status='draft',lock_version=lock_version+1 where id=$1",
      [report.id]
    );
    expect(await balance()).toBe(100);
    await client.query(
      "update daily_reports set status='submitted',lock_version=lock_version+1 where id=$1",
      [report.id]
    );
    expect(await balance()).toBe(98);
    const data = await products.getProductPerformance(
      [storeId],
      '2026-08-01',
      '2026-08-31'
    );
    expect(data.rows[0]).toMatchObject({
      unitsSold: 2,
      salesValue: '50.00',
      quantity: 98,
    });
  });
  it('keeps selling-price exposure automatic and preserves repeated-import age', async () => {
    const before = await products.getProductPerformance(
      [storeId],
      '2026-07-01',
      '2026-08-31'
    );
    expect(before.rows[0].oldestAge).toBe(61);
    expect(before.rows[0].historyComplete).toBe(false);
    expect(before.rows[0].riskValue).toBeNull();
    await client.query(
      "update store_stock_levels set quantity=100,as_of_date='2026-08-31' where store_id=$1",
      [storeId]
    );
    const after = await products.getProductPerformance(
      [storeId],
      '2026-07-01',
      '2026-08-31'
    );
    expect(after.rows[0].oldestAge).toBe(before.rows[0].oldestAge);
    expect(after.rows[0].riskValue).not.toBe('400.00');
  });
  it('shows recurring targets before the first daily report without unlocking a financial download', async () => {
    await client.query(
      "insert into performance_targets(metric,scope_type,store_id,period_type,recurring,period_start,period_end,value,unit,created_by_user_id,updated_by_user_id) values('net-revenue','store',$1,'month',true,'2026-07-01','2099-12-31',1000,'money',$2,$2)",
      [storeId, Number(manager.id)]
    );
    const context = await monthly.getMonthlyReviewContext(manager, {
      storeId,
      month: '2026-08-01',
    });
    expect(context.totalSales).toBe(0);
    expect(context.totalTarget).toBeCloseTo(1000);
    expect(context.nextTargets[0].target).toBeCloseTo(1000);
    expect(context.ready).toBe(false);
    const { getStorePeriodReport } = await import(
      './reporting/store-period-report'
    );
    expect(
      await getStorePeriodReport(storeId, 'month', '2026-08-01')
    ).toBeNull();
  });
  it('creates and updates a typed monthly draft, rejects stale edits and missing source submissions', async () => {
    const scope = { storeId, month: '2026-08-01' };
    const context = await monthly.getMonthlyReviewContext(manager, scope);
    expect(context.weeks.at(-1)).toEqual({
      from: '2026-08-31',
      to: '2026-09-05',
    });
    expect(context.missing.some((s) => s.includes('2026-09-05'))).toBe(true);
    const input = saveMonthlyReviewSchema.parse({
      scope,
      status: 'draft',
      sourceHash: context.sourceHash,
      executiveSummary: 'Checked narrative',
      advisors: [
        { storeId, name: 'Advisor', actualSales: '20.00', target: '100.00' },
      ],
      actions: [
        {
          id: randomUUID(),
          action: 'Call customers',
          outcome: 'More visits',
          ownerName: 'Manager',
          dueDate: '2026-09-15',
          goal: '10 visits',
        },
      ],
    });
    await monthly.saveMonthlyReview(manager, input);
    const saved = await monthly.readMonthlyRecord(scope);
    expect(saved?.executiveSummary).toBe('Checked narrative');
    expect(saved?.advisors).toHaveLength(1);
    expect(saved?.actions).toHaveLength(1);
    await monthly.saveMonthlyReview(manager, {
      ...input,
      lockVersion: saved!.lockVersion,
      executiveSummary: 'Edited',
    });
    await expect(
      monthly.saveMonthlyReview(manager, {
        ...input,
        lockVersion: saved!.lockVersion,
      })
    ).rejects.toThrow('changed');
    await expect(
      monthly.saveMonthlyReview(manager, {
        ...input,
        status: 'submitted',
        confirmNarrative: true,
      })
    ).rejects.toThrow('daily report');
  });
  it('rejects unauthorized store scope and owner writes', async () => {
    const other = Number(
      (
        await client.query(
          "insert into stores(code,name) values('other','Other') returning id"
        )
      ).rows[0].id
    );
    await expect(
      monthly.getMonthlyReviewContext(manager, {
        storeId: other,
        month: '2026-08-01',
      })
    ).rejects.toThrow('not available');
    await expect(
      monthly.authorizeMonthlyScope(
        { ...manager, role: 'owner' },
        { storeId, month: '2026-08-01' },
        true
      )
    ).rejects.toThrow('Only store managers');
  });
  it('requires cross-month weekly reviews, preserves wording after corrections and carries actions by reference', async () => {
    const scope = { storeId, month: '2026-08-01' };
    const initial = await monthly.getMonthlyReviewContext(manager, scope);
    for (const date of tradingDaysBetween('2026-08-01', '2026-08-31'))
      await client.query(
        "insert into daily_reports(store_id,business_date,status,created_by_user_id,updated_by_user_id) values($1,$2,'submitted',$3,$3)",
        [storeId, date, Number(manager.id)]
      );
    for (const week of initial.weeks.slice(0, -1))
      await client.query(
        "insert into weekly_reviews(store_id,week_end,status,summary,submitted_by_user_id) values($1,$2,'submitted','Recorded explanation',$3)",
        [storeId, week.to, Number(manager.id)]
      );
    expect(
      (await monthly.getMonthlyReviewContext(manager, scope)).missing
    ).toHaveLength(1);
    await client.query(
      "insert into weekly_reviews(store_id,week_end,status,submitted_by_user_id) values($1,'2026-09-05','submitted',$2)",
      [storeId, Number(manager.id)]
    );
    const previous = await client.query(
      "insert into monthly_reviews(store_id,month,status,created_by_user_id,updated_by_user_id) values($1,'2026-07-01','submitted',$2,$2) returning id",
      [storeId, Number(manager.id)]
    );
    const actionId = randomUUID();
    await client.query(
      "insert into monthly_review_actions(id,monthly_review_id,action,outcome,owner_name,due_date,goal) values($1,$2,'Follow up','Visits','Manager','2026-08-31','10 visits')",
      [actionId, previous.rows[0].id]
    );
    let context = await monthly.getMonthlyReviewContext(manager, scope);
    const input = saveMonthlyReviewSchema.parse({
      scope,
      status: 'submitted',
      executiveSummary: 'My checked explanation',
      managementOutcomes: 'Reviewed outcomes',
      operationalAssessment: 'Safe and open',
      conclusion: 'Next month priorities agreed',
      sourceHash: context.sourceHash,
      confirmNarrative: true,
      advisors: [
        { storeId, name: 'Advisor', actualSales: '500.00', target: '1000.00' },
      ],
      carriedActions: [
        {
          id: actionId,
          status: 'completed',
          progress: '10 visits achieved',
          expectedStatus: 'open',
          expectedProgress: '',
        },
      ],
    });
    await monthly.saveMonthlyReview(manager, input);
    context = await monthly.getMonthlyReviewContext(manager, scope);
    expect(context.ready).toBe(true);
    expect(context.totalSales).toBe(0);
    await client.query(
      "update daily_reports set status='approved',lock_version=lock_version+1 where store_id=$1",
      [storeId]
    );
    await client.query(
      "update weekly_reviews set status='approved',lock_version=lock_version+1,updated_at=now() where store_id=$1",
      [storeId]
    );
    context = await monthly.getMonthlyReviewContext(manager, scope);
    expect(context.ready).toBe(true);
    expect(context.carriedActions).toHaveLength(1);
    expect(context.carriedActions[0].status).toBe('completed');
    expect(
      Number(
        (
          await client.query(
            'select count(*) from monthly_review_actions where id=$1',
            [actionId]
          )
        ).rows[0].count
      )
    ).toBe(1);
    await client.query(
      "update weekly_reviews set summary='Corrected evidence',updated_at=now() where store_id=$1 and week_end='2026-09-05'",
      [storeId]
    );
    context = await monthly.getMonthlyReviewContext(manager, scope);
    expect(context.ready).toBe(false);
    expect(context.narrativeCurrent).toBe(false);
    expect(context.review?.executiveSummary).toBe('My checked explanation');
    await monthly.reopenMonthlyReview(
      manager,
      scope,
      context.review!.lockVersion,
      'Recheck corrected weekly evidence'
    );
    context = await monthly.getMonthlyReviewContext(manager, scope);
    await monthly.saveMonthlyReview(manager, {
      ...input,
      sourceHash: context.sourceHash,
      lockVersion: context.review!.lockVersion,
      carriedActions: [
        {
          ...input.carriedActions[0],
          expectedStatus: 'completed',
          expectedProgress: '10 visits achieved',
        },
      ],
    });
    expect((await monthly.getMonthlyReviewContext(manager, scope)).ready).toBe(
      true
    );
    await client.query(
      "update monthly_review_actions set progress='Outcome corrected after checking attendance' where id=$1",
      [actionId]
    );
    const changedAction = await monthly.getMonthlyReviewContext(manager, scope);
    expect(changedAction.narrativeCurrent).toBe(false);
    expect(changedAction.review?.executiveSummary).toBe(
      'My checked explanation'
    );
  }, 60000);
  it('authorizes the whole cluster and retains individual store results', async () => {
    const second = Number(
      (
        await client.query(
          "insert into stores(code,name) values($1,'Second cluster store') returning id",
          [randomUUID()]
        )
      ).rows[0].id
    );
    const group = Number(
      (
        await client.query(
          "insert into store_groups(code,name) values($1,'Test cluster') returning id",
          [randomUUID()]
        )
      ).rows[0].id
    );
    await client.query(
      'insert into store_group_members(store_group_id,store_id) values($1,$2),($1,$3)',
      [group, storeId, second]
    );
    const scope = { groupId: group, month: '2026-08-01' };
    await expect(
      monthly.getMonthlyReviewContext(manager, scope)
    ).rejects.toThrow('not available');
    await client.query(
      'insert into user_stores(user_id,store_id) values($1,$2),($1,$3)',
      [Number(manager.id), storeId, second]
    );
    const context = await monthly.getMonthlyReviewContext(manager, scope);
    expect(context.stores.map((s) => s.store.id).sort()).toEqual(
      [storeId, second].sort()
    );
    expect(
      context.missing.some((s) => s.startsWith('Second cluster store'))
    ).toBe(true);
    await expect(
      monthly.authorizeMonthlyScope(
        manager,
        { storeId, month: scope.month },
        true
      )
    ).rejects.toThrow('combined monthly review');
    await monthly.saveMonthlyReview(
      manager,
      saveMonthlyReviewSchema.parse({
        scope,
        status: 'draft',
        sourceHash: context.sourceHash,
      })
    );
    expect((await monthly.readMonthlyRecord(scope))?.status).toBe('draft');
  });
  it('reviews and applies the opening baseline without changing balance or adding it twice', async () => {
    await client.query(
      'delete from stock_history_baselines where store_id=$1',
      [storeId]
    );
    const run = async (args: string[] = []) => {
      const result = await promisify(execFile)(
        process.execPath,
        ['scripts/initialize-stock-history.mjs', ...args],
        {
          cwd: process.cwd(),
          env: { ...process.env, DATABASE_URL: url },
          timeout: 60000,
        }
      );
      return JSON.parse(result.stdout.trim()) as {
        planHash: string;
        products: number;
        quantity: number;
      };
    };
    const plan = await run();
    expect(plan.products).toBe(1);
    expect(plan.quantity).toBe(100);
    await run(['--apply', `--expected-hash=${plan.planHash}`]);
    const baseline = (
      await client.query(
        'select quantity,lots from stock_history_baselines where store_id=$1',
        [storeId]
      )
    ).rows[0];
    expect(baseline.quantity).toBe(100);
    expect(baseline.lots).toEqual([
      { quantity: 100, receiptDate: '2026-07-01', assumed: true },
    ]);
    expect(
      Number(
        (
          await client.query(
            'select quantity from store_stock_levels where store_id=$1',
            [storeId]
          )
        ).rows[0].quantity
      )
    ).toBe(100);
    const repeated = await run();
    expect(repeated.products).toBe(0);
    await run(['--apply', `--expected-hash=${repeated.planHash}`]);
    expect(
      Number(
        (
          await client.query(
            "select count(*) from audit_events where entity_type='stock-history-baseline'"
          )
        ).rows[0].count
      )
    ).toBe(1);
  }, 120000);
  it('does not create stock when a short-stock sale is reopened', async () => {
    const report = await daily.createDailyReport(
      manager,
      storeId,
      saveDailyReportSchema.parse({
        businessDate: '2026-08-02',
        status: 'submitted',
        transactions: 1,
        footfall: 1,
        totalCustomers: 1,
        newCustomers: 1,
        returningCustomers: 0,
        sales: [
          {
            categoryId,
            unitsSold: 120,
            grossRevenue: '3000',
            cogs: '0',
            products: [{ productId, unitsSold: 120, lineValue: '3000' }],
          },
        ],
        payments: [{ paymentMethodId, amount: '3000' }],
      })
    );
    expect(
      Number(
        (
          await client.query(
            'select quantity from store_stock_levels where store_id=$1',
            [storeId]
          )
        ).rows[0].quantity
      )
    ).toBe(0);
    await client.query(
      "update daily_reports set status='draft',lock_version=lock_version+1 where id=$1",
      [report.id]
    );
    expect(
      Number(
        (
          await client.query(
            'select quantity from store_stock_levels where store_id=$1',
            [storeId]
          )
        ).rows[0].quantity
      )
    ).toBe(100);
  });
  it('separates reserved stock, collection, approved returns and replacement stock without duplicating revenue', async () => {
    const ledger = await import('./customer-transactions');
    const today = new Date().toISOString().slice(0, 10);
    const balance = async () =>
      Number(
        (
          await client.query(
            'select quantity from store_stock_levels where store_id=$1 and product_id=$2',
            [storeId, productId]
          )
        ).rows[0].quantity
      );
    const depositId = await ledger.createDeposit(manager, {
      type: 'deposit',
      businessDate: today,
      storeId,
      customerName: 'QA Customer',
      items: [{ productId, quantity: 2 }],
      initialPayment: '10.00',
      paymentMethodId,
    });
    expect(await balance()).toBe(100);
    const reserved = await products.getProductPerformance(
      [storeId],
      today,
      today
    );
    expect(reserved.rows[0]).toMatchObject({
      quantity: 100,
      reserved: 2,
      available: 98,
    });
    await ledger.addDepositPayment(manager, depositId, {
      type: 'deposit',
      action: 'payment',
      businessDate: today,
      amount: '40.00',
      paymentMethodId,
    });
    await ledger.collectDeposit(manager, depositId);
    expect(await balance()).toBe(98);
    await expect(ledger.collectDeposit(manager, depositId)).rejects.toThrow();
    expect(await balance()).toBe(98);
    const noteId = await ledger.createCreditNote(manager, {
      type: 'credit-note',
      businessDate: today,
      storeId,
      customerName: 'QA Customer',
      reason: 'Returned one unworn item',
      items: [
        {
          productId,
          productName: 'QA product',
          quantity: 1,
          originalValue: '25.00',
          unwornUnused: true,
          originalTagsAttached: true,
          originalPackaging: true,
          inspectedApproved: true,
        },
      ],
    });
    await ledger.decideCreditNote({ ...manager, role: 'finance' }, noteId, {
      type: 'credit-note',
      action: 'approve',
    });
    expect(await balance()).toBe(99);
    await expect(
      ledger.decideCreditNote({ ...manager, role: 'finance' }, noteId, {
        type: 'credit-note',
        action: 'approve',
      })
    ).rejects.toThrow();
    expect(await balance()).toBe(99);
    await ledger.redeemCreditNote(manager, noteId, {
      type: 'credit-note',
      action: 'redeem',
      businessDate: today,
      replacementProductId: productId,
      replacementValue: '25.00',
    });
    expect(await balance()).toBe(98);
    const summary = await ledger.getCustomerTransactionSummary(
      storeId,
      today,
      today
    );
    expect(summary).toMatchObject({
      depositReceived: 50,
      approvedCredits: 25,
      additionalPayments: 0,
      creditCollections: 0,
    });
  }, 120000);
});
