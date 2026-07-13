#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import {
  LOCAL_ADMIN_DATABASE_URL,
  LOCAL_DATABASE_NAME,
  LOCAL_DATABASE_URL,
  assertLocalDatabaseUrl,
} from './local-config.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const command = process.argv[2] ?? 'status';

assertLocalDatabaseUrl(LOCAL_DATABASE_URL);

async function withClient(connectionString, callback) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    return await callback(client);
  } finally {
    await client.end();
  }
}

async function databaseExists() {
  return withClient(LOCAL_ADMIN_DATABASE_URL, async (client) => {
    const result = await client.query('select 1 from pg_database where datname = $1', [LOCAL_DATABASE_NAME]);
    return result.rowCount === 1;
  });
}

async function createDatabase() {
  if (await databaseExists()) return false;
  await withClient(LOCAL_ADMIN_DATABASE_URL, (client) =>
    client.query(`create database "${LOCAL_DATABASE_NAME}"`)
  );
  return true;
}

async function dropDatabase() {
  if (!(await databaseExists())) return false;
  await withClient(LOCAL_ADMIN_DATABASE_URL, async (client) => {
    await client.query(
      'select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()',
      [LOCAL_DATABASE_NAME]
    );
    await client.query(`drop database "${LOCAL_DATABASE_NAME}"`);
  });
  return true;
}

async function migrationFiles() {
  const names = await readdir(path.join(repoRoot, 'drizzle'));
  return names.filter((name) => /^\d+.*\.sql$/.test(name)).sort();
}

async function applyMigrations() {
  await withClient(LOCAL_DATABASE_URL, (client) =>
    client.query(`
      create table if not exists local_schema_migrations (
        filename text primary key,
        applied_at timestamptz not null default now()
      )
    `)
  );

  for (const filename of await migrationFiles()) {
    const applied = await withClient(LOCAL_DATABASE_URL, async (client) => {
      const result = await client.query('select 1 from local_schema_migrations where filename = $1', [filename]);
      return result.rowCount === 1;
    });
    if (applied) continue;

    const result = spawnSync(
      'psql',
      [LOCAL_DATABASE_URL, '--set', 'ON_ERROR_STOP=1', '--single-transaction', '--file', path.join(repoRoot, 'drizzle', filename)],
      { cwd: repoRoot, stdio: 'inherit' }
    );
    if (result.status !== 0) process.exit(result.status ?? 1);

    await withClient(LOCAL_DATABASE_URL, (client) =>
      client.query('insert into local_schema_migrations (filename) values ($1)', [filename])
    );
    console.log(`Applied ${filename}`);
  }
}

async function printStatus() {
  const exists = await databaseExists();
  if (!exists) {
    console.error(`${LOCAL_DATABASE_NAME}: not created`);
    process.exitCode = 1;
    return false;
  }
  const expectedMigrations = await migrationFiles();
  const summary = await withClient(LOCAL_DATABASE_URL, async (client) => {
    const tables = await client.query("select count(*)::int as count from information_schema.tables where table_schema = 'public'");
    const migrationTable = await client.query("select to_regclass('public.local_schema_migrations') as name");
    const migrations = migrationTable.rows[0].name
      ? await client.query('select filename from local_schema_migrations order by filename')
      : { rows: [] };
    return { tables: tables.rows[0].count, migrations: migrations.rows.map((row) => row.filename) };
  });
  const applied = new Set(summary.migrations);
  const expected = new Set(expectedMigrations);
  const missing = expectedMigrations.filter((filename) => !applied.has(filename));
  const unknown = summary.migrations.filter((filename) => !expected.has(filename));
  if (missing.length || unknown.length) {
    console.error(
      `${LOCAL_DATABASE_NAME}: not ready (${summary.tables} tables, ${summary.migrations.length}/${expectedMigrations.length} migrations)`
    );
    if (missing.length) console.error(`Missing migrations: ${missing.join(', ')}`);
    if (unknown.length) console.error(`Unknown migrations: ${unknown.join(', ')}`);
    process.exitCode = 1;
    return false;
  }
  console.log(`${LOCAL_DATABASE_NAME}: ready (${summary.tables} tables, ${summary.migrations.length} migrations)`);
  return true;
}

if (command === 'setup') {
  const created = await createDatabase();
  if (created) console.log(`Created ${LOCAL_DATABASE_NAME}`);
  await applyMigrations();
  await printStatus();
} else if (command === 'reset') {
  await dropDatabase();
  console.log(`Resetting ${LOCAL_DATABASE_NAME}`);
  await createDatabase();
  await applyMigrations();
  await printStatus();
} else if (command === 'status') {
  await printStatus();
} else {
  console.error('Usage: node scripts/local-db.mjs <setup|reset|status>');
  process.exit(2);
}
