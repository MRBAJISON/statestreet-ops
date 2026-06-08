// Add a Store Manager user (idempotent upsert by email). Run with .env.local loaded.
//   node scripts/seed-store-manager.mjs
import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';

if (!process.env.DATABASE_URL) {
  try {
    const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
    const m = env.match(/^DATABASE_URL=(.*)$/m);
    if (m) process.env.DATABASE_URL = m[1].trim().replace(/^["']|["']$/g, '');
  } catch {}
}
const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL not set'); process.exit(1); }
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

const u = { name: 'Store Manager', email: 'storemanager@statestreet.com', pw: 'storemanager123', role: 'store-manager', department: 'commercial' };
const h = await hash(u.pw);
await sql`
  INSERT INTO users (name, email, password_hash, role, department)
  VALUES (${u.name}, ${u.email}, ${h}, ${u.role}, ${u.department})
  ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash, name = EXCLUDED.name,
    role = EXCLUDED.role, department = EXCLUDED.department
`;
console.log(`seeded store manager: ${u.email} / ${u.pw}`);
