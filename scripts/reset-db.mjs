// One-off: clear all entries. Run with DATABASE_URL set.
//   node scripts/reset-db.mjs
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}
const sql = neon(url);
await sql`TRUNCATE TABLE entries RESTART IDENTITY`;
console.log('entries table cleared');
