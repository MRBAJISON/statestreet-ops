#!/usr/bin/env node

import pg from 'pg';
import { buildFoundationBackfillPlan } from './lib/foundation-backfill-plan.mjs';

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

  const [identity, tableRows, entryRows, roleRows, orgResult, plannerEntries, migrationTable] =
    await Promise.all([
      client.query(`
        select current_database() as database, current_user as role,
          (select count(*)::integer from public.entries) as entry_count,
          (select count(*)::integer from public.users) as user_count
      `),
      client.query(`
        select tablename
        from pg_catalog.pg_tables
        where schemaname = 'public'
        order by tablename
      `),
      client.query(`
        select department, form_type, count(*)::integer as count,
          min(created_at) as first_created_at, max(created_at) as last_created_at
        from public.entries
        group by department, form_type
        order by department, form_type
      `),
      client.query(`
        select role, department, count(*)::integer as count
        from public.users
        group by role, department
        order by role, department
      `),
      client.query(`
        select payload
        from public.entries
        where department = 'admin' and form_type = 'org-settings'
        order by created_at desc, id desc
        limit 1
      `),
      client.query(`
        select id, department, form_type, payload, created_at
        from public.entries
        where (department = 'finance' and form_type in ('revenue', 'closing'))
           or (payload ? 'sku')
        order by id
      `),
      client.query(`
        select exists (
          select 1
          from information_schema.tables
          where table_schema = 'drizzle' and table_name = '__drizzle_migrations'
        ) as exists
      `),
    ]);

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

  console.log(
    JSON.stringify(
      {
        kind: 'statestreet-production-release-probe',
        identity: identity.rows[0],
        publicTables: tableRows.rows.map((row) => row.tablename),
        appliedMigrations: migrationCount,
        entryTypes: entryRows.rows,
        accountRoles: roleRows.rows,
        backfillPlan,
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
