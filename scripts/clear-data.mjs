// Remove all demo/seed business data (entries + audit trail). Keeps users.
//   node scripts/clear-data.mjs
import { neon } from '@neondatabase/serverless';
import './load-env.mjs';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL not set'); process.exit(1); }
const sql = neon(url);

const before = await sql`SELECT count(*)::int AS n FROM entries`;
await sql`DELETE FROM entries`;
try { await sql`DELETE FROM audit_log`; } catch { /* table may not exist */ }
const after = await sql`SELECT count(*)::int AS n FROM entries`;
const users = await sql`SELECT count(*)::int AS n FROM users`;
console.log(`entries: ${before[0].n} -> ${after[0].n}; users kept: ${users[0].n}`);
