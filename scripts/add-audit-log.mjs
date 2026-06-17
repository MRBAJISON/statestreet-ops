// One-off: create the audit_log table. Idempotent.
//   node scripts/add-audit-log.mjs   (uses .env.local DATABASE_URL unless overridden)
import { neon } from '@neondatabase/serverless';
import './load-env.mjs';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL not set'); process.exit(1); }
const sql = neon(url);
await sql`
  CREATE TABLE IF NOT EXISTS audit_log (
    id serial PRIMARY KEY,
    entry_id integer NOT NULL,
    action text NOT NULL,
    user_id text,
    user_name text,
    changes jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  )
`;
await sql`CREATE INDEX IF NOT EXISTS audit_entry_idx ON audit_log (entry_id)`;
console.log('audit_log table ensured');
