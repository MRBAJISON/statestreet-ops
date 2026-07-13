#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { LOCAL_DATABASE_NAME, LOCAL_DATABASE_URL, assertLocalDatabaseUrl } from './local-config.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
assertLocalDatabaseUrl(LOCAL_DATABASE_URL);

if (!process.env.AUTH_SECRET) {
  console.error('AUTH_SECRET is missing. Run this command through agent-secret as defined by npm run dev:local.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: LOCAL_DATABASE_URL });
try {
  await client.connect();
  await client.query('select 1 from users limit 1');
} catch {
  console.error(`${LOCAL_DATABASE_NAME} is not ready. Run npm run db:local:setup first.`);
  process.exit(1);
} finally {
  await client.end().catch(() => undefined);
}

const child = spawn(process.execPath, [path.join(repoRoot, 'node_modules/next/dist/bin/next'), 'dev', ...process.argv.slice(2)], {
  cwd: repoRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    DATABASE_DRIVER: 'node-postgres',
    DATABASE_URL: LOCAL_DATABASE_URL,
    ENABLE_TYPED_DAILY_REPORT_PREVIEW: 'true',
  },
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
