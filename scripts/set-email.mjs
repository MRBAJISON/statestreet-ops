// One-off: change a user's email.  node scripts/set-email.mjs <oldEmail> <newEmail>
import { neon } from '@neondatabase/serverless';
import './load-env.mjs';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL not set'); process.exit(1); }
const sql = neon(url);
const [, , oldEmail, newEmail] = process.argv;
if (!oldEmail || !newEmail) { console.error('usage: set-email <old> <new>'); process.exit(1); }
const rows = await sql`UPDATE users SET email = ${newEmail} WHERE email = ${oldEmail} RETURNING id, email`;
console.log(rows.length ? `updated -> ${rows[0].email}` : 'no user matched');
