import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import {
  buildCommitFinanceImportQuery,
  buildUndoFinanceImportQuery,
  planBudgetImport,
  type ExistingBudgetForImport,
  type ParseResult,
  type ParsedBudget,
  type ParsedExpense,
} from './import-finance';
import { testDatabaseUrl } from './test-database';

const databaseUrl = testDatabaseUrl(process.env.TEST_DATABASE_URL);
const describeWithDatabase = databaseUrl ? describe : describe.skip;
const dialect = new PgDialect();

describeWithDatabase('Finance import SQL integration', () => {
  const client = new Client({ connectionString: databaseUrl });
  let actorUserId: number;
  let storeId: number;
  let rentCategoryId: number;
  let marketingCategoryId: number;
  let paymentMethodId: number;
  let existingBudgetId: number;

  async function execute(query: SQL) {
    const compiled = dialect.sqlToQuery(query);
    return client.query(compiled.sql, compiled.params);
  }

  async function currentBudget(): Promise<ExistingBudgetForImport> {
    const row = (
      await client.query(
        `select
           id,
           year,
           expense_category_id,
           store_id,
           amount,
           notes,
           import_batch_id,
           import_source_row,
           created_by_user_id,
           updated_by_user_id,
           updated_at
         from budgets
         where id = $1`,
        [existingBudgetId]
      )
    ).rows[0];
    return {
      id: Number(row.id),
      year: row.year,
      expenseCategoryId: Number(row.expense_category_id),
      storeId: row.store_id == null ? null : Number(row.store_id),
      amount: row.amount,
      notes: row.notes,
      importBatchId: row.import_batch_id == null ? null : Number(row.import_batch_id),
      importSourceRow: row.import_source_row,
      createdByUserId: row.created_by_user_id,
      updatedByUserId: row.updated_by_user_id,
      updatedAt: row.updated_at,
    };
  }

  const parsed = (expenses: ParsedExpense[], budget: ParsedBudget[]): ParseResult => ({
    expenses: { valid: expenses, errors: [] },
    budget: { valid: budget, errors: [] },
  });

  beforeAll(async () => {
    await client.connect();
    await client.query(`
      truncate table
        audit_events, import_batch_rows, expenses, budgets, import_batches,
        payment_methods, expense_categories, stores, entries, users
      restart identity cascade
    `);
    actorUserId = Number(
      (
        await client.query(
          `insert into users (name, email, password_hash, role, department)
           values ('Finance Import Test', 'finance-import@example.com', 'not-used', 'finance', 'finance')
           returning id`
        )
      ).rows[0].id
    );
    storeId = Number(
      (await client.query(`insert into stores (code, name) values ('labone', 'Labone') returning id`)).rows[0].id
    );
    const categoryRows = await client.query(
      `insert into expense_categories (code, name, "group", sort_order)
       values ('rent', 'Rent', 'operating', 1), ('marketing-spend', 'Marketing Spend', 'operating', 2)
       returning id, code`
    );
    rentCategoryId = Number(categoryRows.rows.find((row) => row.code === 'rent')?.id);
    marketingCategoryId = Number(categoryRows.rows.find((row) => row.code === 'marketing-spend')?.id);
    paymentMethodId = Number(
      (
        await client.query(
          `insert into payment_methods (code, name, sort_order)
           values ('bank-transfer', 'Bank Transfer', 1)
           returning id`
        )
      ).rows[0].id
    );
    existingBudgetId = Number(
      (
        await client.query(
          `insert into budgets (
             year, expense_category_id, amount, notes, created_by_user_id, updated_by_user_id
           ) values (2026, $1, 100000, 'Original budget', $2, $2)
           returning id`,
          [rentCategoryId, actorUserId]
        )
      ).rows[0].id
    );
  });

  afterAll(async () => {
    await client.end();
  });

  it('commits typed rows and restores the exact prior budget during undo', async () => {
    const beforeBudget = await currentBudget();
    const importData = parsed(
      [
        {
          rowNum: 2,
          data: {
            date: '2026-07-10',
            category: 'rent',
            expenseCategoryId: rentCategoryId,
            store: 'labone',
            storeId,
            amount: 1250.5,
            amountDecimal: '1250.50',
            vendor: 'Property Co',
            invoice: 'INV-1',
            paymentMethod: 'bank-transfer',
            paymentMethodId,
            description: 'July rent',
            overspendReason: 'Store budget exception approved',
          },
        },
      ],
      [
        {
          rowNum: 2,
          data: {
            year: '2026',
            yearNumber: 2026,
            item: 'rent',
            expenseCategoryId: rentCategoryId,
            amount: 150000,
            amountDecimal: '150000.00',
            notes: 'Revised budget',
          },
        },
        {
          rowNum: 3,
          data: {
            year: '2026',
            yearNumber: 2026,
            item: 'marketing-spend',
            expenseCategoryId: marketingCategoryId,
            amount: 50000,
            amountDecimal: '50000.00',
            notes: 'Campaign budget',
          },
        },
      ]
    );
    const preview = planBudgetImport(importData.budget.valid, [beforeBudget]);
    const budgetPlan = planBudgetImport(importData.budget.valid, [beforeBudget], {
      [preview.conflicts[0].key]: 'allow',
    });
    const committed = await execute(
      buildCommitFinanceImportQuery({
        filename: 'finance.xlsx',
        actorUserId,
        actorName: 'Finance Import Test',
        parsed: importData,
        budgetWrites: budgetPlan.writes,
        budgetSkipped: budgetPlan.skipped,
      })
    );
    expect(committed.rows[0].issues).toEqual([]);
    expect(committed.rows[0]).toMatchObject({
      issue_count: 0,
      ledger_rows: 3,
      row_audit_rows: 3,
      batch_audit_rows: 1,
    });
    const batchId = Number(committed.rows[0].batch_id);
    expect(batchId).toBeGreaterThan(0);
    expect((await client.query('select count(*)::integer as count from entries')).rows[0].count).toBe(0);
    expect((await client.query('select count(*)::integer as count from expenses')).rows[0].count).toBe(1);
    expect((await client.query('select count(*)::integer as count from budgets')).rows[0].count).toBe(2);
    expect(
      (
        await client.query(
          `select amount, notes, import_batch_id, import_source_row
           from budgets where id = $1`,
          [existingBudgetId]
        )
      ).rows[0]
    ).toMatchObject({
      amount: '150000.00',
      notes: 'Revised budget',
      import_batch_id: String(batchId),
      import_source_row: 2,
    });
    expect(
      (
        await client.query(
          `select operation, count(*)::integer as count
           from import_batch_rows where import_batch_id = $1 group by operation order by operation`,
          [batchId]
        )
      ).rows
    ).toEqual([
      { operation: 'insert', count: 2 },
      { operation: 'update', count: 1 },
    ]);

    const undone = await execute(buildUndoFinanceImportQuery(batchId, actorUserId));
    expect(undone.rows[0]).toMatchObject({
      batch_found: true,
      status: 'completed',
      expected_rows: 3,
      unsafe_rows: 0,
      deleted_rows: 2,
      restored_rows: 1,
      updated_batches: 1,
      batch_audit_rows: 1,
    });
    expect((await client.query('select count(*)::integer as count from expenses')).rows[0].count).toBe(0);
    expect((await client.query('select count(*)::integer as count from budgets')).rows[0].count).toBe(1);
    const restoredBudget = await currentBudget();
    expect(restoredBudget).toMatchObject({
      id: beforeBudget.id,
      amount: beforeBudget.amount,
      notes: beforeBudget.notes,
      importBatchId: null,
      importSourceRow: null,
      createdByUserId: beforeBudget.createdByUserId,
      updatedByUserId: beforeBudget.updatedByUserId,
    });
    expect(timestamp(restoredBudget.updatedAt)).toBe(timestamp(beforeBudget.updatedAt));
    expect(
      (
        await client.query(
          `select status, undone_at is not null as undone
           from import_batches where id = $1`,
          [batchId]
        )
      ).rows[0]
    ).toEqual({ status: 'undone', undone: true });
    expect(
      (
        await client.query(
          `select action, count(*)::integer as count
           from audit_events group by action order by action`
        )
      ).rows
    ).toEqual([
      { action: 'import', count: 4 },
      { action: 'undo', count: 4 },
    ]);
  });

  it('requires and stores an overspend reason for imported expenses', async () => {
    const expense = (overspendReason: string): ParsedExpense => ({
      rowNum: 2,
      data: {
        date: '2026-07-11',
        category: 'rent',
        expenseCategoryId: rentCategoryId,
        store: '',
        storeId: null,
        amount: 100001,
        amountDecimal: '100001.00',
        vendor: 'Property Co',
        invoice: 'INV-OVER',
        paymentMethod: 'bank-transfer',
        paymentMethodId,
        description: 'Annual lease adjustment',
        overspendReason,
      },
    });
    const commit = (overspendReason: string) =>
      execute(
        buildCommitFinanceImportQuery({
          filename: 'overspend.xlsx',
          actorUserId,
          actorName: 'Finance Import Test',
          parsed: parsed([expense(overspendReason)], []),
          budgetWrites: [],
          budgetSkipped: 0,
        })
      );

    const refused = await commit('');
    expect(refused.rows[0]).toMatchObject({ issue_count: 1, batch_id: null });
    expect(refused.rows[0].issues).toEqual([
      { sheet: 'expenses', rowNum: 2, reason: 'overspend-reason-required' },
    ]);
    expect((await client.query('select count(*)::integer as count from expenses')).rows[0].count).toBe(0);

    const accepted = await commit('Lease increase approved by Finance');
    const batchId = Number(accepted.rows[0].batch_id);
    expect(accepted.rows[0]).toMatchObject({ issue_count: 0, ledger_rows: 1 });
    expect(
      (
        await client.query(
          'select overspend_reason from expenses where import_batch_id = $1 and import_source_row = 2',
          [batchId]
        )
      ).rows[0]
    ).toEqual({ overspend_reason: 'Lease increase approved by Finance' });

    const undone = await execute(buildUndoFinanceImportQuery(batchId, actorUserId));
    expect(undone.rows[0]).toMatchObject({ deleted_rows: 1, updated_batches: 1 });
  });

  it('refuses the entire undo after an imported row has been modified', async () => {
    const importData = parsed(
      [
        {
          rowNum: 2,
          data: {
            date: '2026-07-11',
            category: 'rent',
            expenseCategoryId: rentCategoryId,
            store: 'labone',
            storeId,
            amount: 75,
            amountDecimal: '75.00',
            vendor: '',
            invoice: '',
            paymentMethod: 'bank-transfer',
            paymentMethodId,
            description: 'Courier charge',
            overspendReason: 'No store-level budget has been set',
          },
        },
        {
          rowNum: 3,
          data: {
            date: '2026-07-11',
            category: 'marketing-spend',
            expenseCategoryId: marketingCategoryId,
            store: 'labone',
            storeId,
            amount: 125,
            amountDecimal: '125.00',
            vendor: '',
            invoice: '',
            paymentMethod: 'bank-transfer',
            paymentMethodId,
            description: 'Campaign delivery',
            overspendReason: 'No store-level budget has been set',
          },
        },
      ],
      []
    );
    const committed = await execute(
      buildCommitFinanceImportQuery({
        filename: 'expense-only.xlsx',
        actorUserId,
        actorName: 'Finance Import Test',
        parsed: importData,
        budgetWrites: [],
        budgetSkipped: 0,
      })
    );
    const batchId = Number(committed.rows[0].batch_id);
    await client.query(
      `update expenses
       set description = 'Corrected by a user', updated_at = statement_timestamp()
       where import_batch_id = $1 and import_source_row = 2`,
      [batchId]
    );

    const refused = await execute(buildUndoFinanceImportQuery(batchId, actorUserId));
    expect(refused.rows[0]).toMatchObject({
      batch_found: true,
      status: 'completed',
      expected_rows: 2,
      unsafe_rows: 1,
      deleted_rows: 0,
      restored_rows: 0,
      updated_batches: 0,
      batch_audit_rows: 0,
    });
    expect(refused.rows[0].conflicts).toEqual([
      expect.objectContaining({ sheet: 'expenses', rowNum: 2, reason: 'row-changed-after-import' }),
    ]);
    expect(
      (
        await client.query(
          `select count(*)::integer as count
           from expenses where import_batch_id = $1`,
          [batchId]
        )
      ).rows[0].count
    ).toBe(2);
    expect((await client.query('select status from import_batches where id = $1', [batchId])).rows[0].status).toBe(
      'completed'
    );
    expect(
      (
        await client.query(
          `select count(*)::integer as count
           from import_batch_rows where import_batch_id = $1 and undone_at is not null`,
          [batchId]
        )
      ).rows[0].count
    ).toBe(0);
  });
});

function timestamp(value: Date | string): string {
  return new Date(value).toISOString();
}
