// One-off: add the nullable `store` column to users. Idempotent.
//   node scripts/add-store-column.mjs
import { neon } from '@neondatabase/serverless';
import './load-env.mjs';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL not set'); process.exit(1); }
const sql = neon(url);
await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS store text`;
console.log('users.store column ensured');
