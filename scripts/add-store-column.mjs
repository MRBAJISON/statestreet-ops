// One-off: add the nullable `store` column to users. Idempotent.
//   node scripts/add-store-column.mjs
import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';

if (!process.env.DATABASE_URL) {
  try {
    const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
    const m = env.match(/^DATABASE_URL=(.*)$/m);
    if (m) process.env.DATABASE_URL = m[1].trim().replace(/^["']|["']$/g, '');
  } catch {}
}
const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL not set'); process.exit(1); }
const sql = neon(url);
await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS store text`;
console.log('users.store column ensured');
