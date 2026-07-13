#!/usr/bin/env node
import nextEnv from '@next/env';
import { Client } from 'pg';
import { buildFoundationBackfillPlan } from './lib/foundation-backfill-plan.mjs';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd(), true);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is required. Run this only against the database you intend to inspect.');
  process.exit(1);
}

const client = new Client({ connectionString: databaseUrl });
try {
  await client.connect();
  await client.query('set statement_timeout = 30000');
  await client.query('begin read only');
  const orgResult = await client.query(
    `select payload
     from entries
     where department = 'admin' and form_type = 'org-settings'
     order by created_at desc
     limit 1`
  );
  if (!orgResult.rows[0]?.payload) {
    throw new Error('No stored organization settings row was found; the planner will not invent master data.');
  }
  const entriesResult = await client.query(
    `select id, department, form_type, payload, created_at
     from entries
     where (department = 'finance' and form_type in ('revenue', 'closing'))
        or (payload ? 'sku')
     order by id`
  );
  const plan = buildFoundationBackfillPlan(orgResult.rows[0].payload, entriesResult.rows);
  console.log(JSON.stringify(plan, null, 2));
  const blockerCount = Object.values(plan.blockers).reduce((sum, values) => sum + values.length, 0);
  if (blockerCount || plan.products.conflicting) process.exitCode = 2;
} catch (error) {
  console.error((error instanceof Error ? error.message : String(error)).replace(databaseUrl, '[DATABASE_URL]'));
  process.exitCode = 1;
} finally {
  await client.query('rollback').catch(() => undefined);
  await client.end().catch(() => undefined);
}
