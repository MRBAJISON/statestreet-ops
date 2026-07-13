#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const RELEASE_APPROVAL = 'prod-data-migration-2026-07-13';
const RELEASE_BRANCH = 'eyacquah/local-rebuild-v1';
const stages = new Map([
  ['2026-07-13-v1-foundation', [
    ['npm', ['run', 'db:migrate']],
    ['npm', ['run', 'db:seed:foundation']],
    ['npm', ['run', 'db:seed:foundation:apply']],
  ]],
  ['2026-07-13-v1-daily', [
    ['npm', ['run', 'db:backfill:daily']],
    ['npm', ['run', 'db:backfill:daily', '--', '--apply']],
  ]],
  ['2026-07-13-v1-legacy-preview', [
    ['npm', ['run', 'db:backfill:legacy']],
  ]],
  ['2026-07-13-v1-legacy-apply', [
    ['npm', ['run', 'db:backfill:legacy']],
    ['npm', ['run', 'db:backfill:legacy', '--', '--apply']],
  ]],
]);

const stage = process.env.STATESTREET_RELEASE_STAGE;
if (!stage) {
  console.log('StateStreet release runner skipped.');
  process.exit(0);
}

if (
  process.env.VERCEL_ENV !== 'preview' ||
  process.env.STATESTREET_RELEASE_APPROVAL !== RELEASE_APPROVAL ||
  process.env.VERCEL_GIT_COMMIT_REF !== RELEASE_BRANCH
) {
  throw new Error('StateStreet release runner refused an unapproved environment or branch.');
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for the StateStreet release runner.');

const commands = stages.get(stage);
if (!commands) throw new Error(`Unknown StateStreet release stage: ${stage}`);

console.log(`Running StateStreet release stage: ${stage}`);
for (const [command, args] of commands) {
  const result = spawnSync(command, args, { env: process.env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
