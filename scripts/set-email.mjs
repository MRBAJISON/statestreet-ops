// One-off: change a user's email.  node scripts/set-email.mjs <oldEmail> <newEmail>
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
const [, , oldEmail, newEmail] = process.argv;
if (!oldEmail || !newEmail) { console.error('usage: set-email <old> <new>'); process.exit(1); }
const rows = await sql`UPDATE users SET email = ${newEmail} WHERE email = ${oldEmail} RETURNING id, email`;
console.log(rows.length ? `updated -> ${rows[0].email}` : 'no user matched');
