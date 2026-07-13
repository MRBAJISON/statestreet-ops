#!/usr/bin/env node

import pg from 'pg';
import {
  buildFoundationBackfillPlan,
  buildFoundationCatalog,
} from './lib/foundation-backfill-plan.mjs';

const { Client } = pg;
const EXPECTED_PROBE = '2026-07-13-v1';

if (
  process.env.VERCEL_ENV !== 'preview' ||
  process.env.STATESTREET_RELEASE_PROBE !== EXPECTED_PROBE
) {
  console.log('StateStreet production release probe skipped.');
  process.exit(0);
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for the StateStreet release probe.');
}

const client = new Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  await client.query('set statement_timeout = 30000');
  await client.query('begin read only');

  const identity = await client.query(`
    select current_database() as database, current_user as role,
      (select count(*)::integer from public.entries) as entry_count,
      (select count(*)::integer from public.users) as user_count
  `);
  const tableRows = await client.query(`
    select tablename
    from pg_catalog.pg_tables
    where schemaname = 'public'
    order by tablename
  `);
  const entryRows = await client.query(`
    select department, form_type, count(*)::integer as count,
      min(created_at) as first_created_at, max(created_at) as last_created_at
    from public.entries
    group by department, form_type
    order by department, form_type
  `);
  const roleRows = await client.query(`
    select role, department, count(*)::integer as count
    from public.users
    group by role, department
    order by role, department
  `);
  const orgResult = await client.query(`
    select payload
    from public.entries
    where department = 'admin' and form_type = 'org-settings'
    order by created_at desc, id desc
    limit 1
  `);
  const plannerEntries = await client.query(`
    select id, department, form_type, payload, created_at
    from public.entries
    where (department = 'finance' and form_type in ('revenue', 'closing'))
       or (payload ? 'sku')
    order by id
  `);
  const migrationTable = await client.query(`
    select exists (
      select 1
      from information_schema.tables
      where table_schema = 'drizzle' and table_name = '__drizzle_migrations'
    ) as exists
  `);

  const organization = orgResult.rows[0]?.payload;
  const backfillPlan = organization
    ? buildFoundationBackfillPlan(organization, plannerEntries.rows)
    : { error: 'No organization settings row exists.' };

  let migrationCount = 0;
  if (migrationTable.rows[0]?.exists) {
    const result = await client.query(
      'select count(*)::integer as count from drizzle.__drizzle_migrations'
    );
    migrationCount = result.rows[0]?.count ?? 0;
  }

  const publicTables = tableRows.rows.map((row) => row.tablename);
  let typedData = null;
  let migrationLedger = null;
  if (publicTables.includes('legacy_migration_records')) {
    const typedResult = await client.query(`
      select
        (select count(*)::integer from stores) as stores,
        (select count(*)::integer from brands) as brands,
        (select count(*)::integer from categories) as categories,
        (select count(*)::integer from products) as products,
        (select count(*)::integer from daily_reports) as daily_reports,
        (select count(*)::integer from daily_sales_lines) as daily_sales_lines,
        (select count(*)::integer from daily_payment_lines) as daily_payment_lines,
        (select count(*)::integer from daily_report_legacy_entries) as daily_legacy_links,
        (select count(*)::integer from legacy_migration_records) as legacy_ledger_rows,
        (select count(*)::integer from entries source
          left join legacy_migration_records migration on migration.entry_id = source.id
          where migration.entry_id is null) as unresolved_legacy_entries,
        (select coalesce(sum(gross_revenue), 0)::numeric(18,2)::text from daily_sales_lines) as gross_revenue,
        (select coalesce(sum(cogs), 0)::numeric(18,2)::text from daily_sales_lines) as cogs,
        (select coalesce(sum(discounts), 0)::numeric(18,2)::text from daily_sales_lines) as discounts,
        (select coalesce(sum(credit_sales), 0)::numeric(18,2)::text from daily_sales_lines) as credit_sales,
        (select coalesce(sum(units_sold), 0)::integer from daily_sales_lines) as units_sold
    `);
    const ledgerResult = await client.query(`
      select disposition, target_type, count(*)::integer as count
      from legacy_migration_records
      group by disposition, target_type
      order by disposition, target_type nulls first
    `);
    typedData = typedResult.rows[0];
    migrationLedger = ledgerResult.rows;
  }

  console.log(
    JSON.stringify(
      {
        kind: 'statestreet-production-release-probe',
        identity: identity.rows[0],
        publicTables,
        appliedMigrations: migrationCount,
        entryTypes: entryRows.rows,
        accountRoles: roleRows.rows,
        catalog: organization ? buildFoundationCatalog(organization) : null,
        backfillPlan,
        typedData,
        migrationLedger,
      },
      null,
      2
    )
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message.replace(process.env.DATABASE_URL, '[DATABASE_URL]'));
  process.exitCode = 1;
} finally {
  await client.query('rollback').catch(() => undefined);
  await client.end().catch(() => undefined);
}
