import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';
if (!process.env.DATABASE_URL) {
  const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
  const m = env.match(/^DATABASE_URL=(.*)$/m);
  if (m) process.env.DATABASE_URL = m[1].trim().replace(/^["']|["']$/g, '');
}
const sql = neon(process.env.DATABASE_URL);
await sql`UPDATE users SET store = 'east-legon-men' WHERE email = 'storemanager@statestreet.com'`;
const u = await sql`SELECT email, role, store FROM users ORDER BY id`;
console.table(u);
