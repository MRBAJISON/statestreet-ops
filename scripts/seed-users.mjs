// Seed initial users with hashed passwords. Idempotent (upsert by email).
//   node scripts/seed-users.mjs
import { neon } from '@neondatabase/serverless';
import './load-env.mjs';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}
const sql = neon(url);
const enc = new TextEncoder();
const toHex = (b) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

async function hash(pw) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256)
  );
  return `${toHex(salt)}:${toHex(bits)}`;
}

const USERS = [
  { name: 'CEO / Owner', email: 'owner@statestreet.com', pw: 'owner123', role: 'owner', department: 'executive' },
  { name: 'Finance Manager', email: 'finance@statestreet.com', pw: 'finance123', role: 'finance', department: 'finance' },
  { name: 'Commercial Director', email: 'commercial@statestreet.com', pw: 'commercial123', role: 'commercial', department: 'commercial' },
  { name: 'Marketing Director', email: 'marketing@statestreet.com', pw: 'marketing123', role: 'marketing', department: 'marketing' },
  { name: 'Operations Manager', email: 'operations@statestreet.com', pw: 'operations123', role: 'operations', department: 'operations' },
  { name: 'Inventory Manager', email: 'inventory@statestreet.com', pw: 'inventory123', role: 'inventory', department: 'inventory' },
  { name: 'Brand Manager', email: 'brand@statestreet.com', pw: 'brand123', role: 'brand', department: 'brand' },
];

for (const u of USERS) {
  const h = await hash(u.pw);
  await sql`
    INSERT INTO users (name, email, password_hash, role, department)
    VALUES (${u.name}, ${u.email}, ${h}, ${u.role}, ${u.department})
    ON CONFLICT (email) DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      name = EXCLUDED.name,
      role = EXCLUDED.role,
      department = EXCLUDED.department
  `;
}
console.log(`seeded ${USERS.length} users`);
