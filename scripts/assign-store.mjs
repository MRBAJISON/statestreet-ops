import { neon } from '@neondatabase/serverless';
import './load-env.mjs';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL not set'); process.exit(1); }
const sql = neon(url);
await sql`UPDATE users SET store = 'east-legon-men' WHERE email = 'storemanager@statestreet.com'`;
const u = await sql`SELECT email, role, store FROM users ORDER BY id`;
console.table(u);
