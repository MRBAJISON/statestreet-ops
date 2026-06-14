// Remove all demo/seed business data (entries + audit trail). Keeps users.
//   node scripts/clear-data.mjs
import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';

if (!process.env.DATABASE_URL) {
  const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
  const m = env.match(/^DATABASE_URL=(.*)$/m);
  if (m) process.env.DATABASE_URL = m[1].trim().replace(/^["']|["']$/g, '');
}
const sql = neon(process.env.DATABASE_URL);

const before = await sql`SELECT count(*)::int AS n FROM entries`;
await sql`DELETE FROM entries`;
try { await sql`DELETE FROM audit_log`; } catch { /* table may not exist */ }
const after = await sql`SELECT count(*)::int AS n FROM entries`;
const users = await sql`SELECT count(*)::int AS n FROM users`;
console.log(`entries: ${before[0].n} -> ${after[0].n}; users kept: ${users[0].n}`);
