// Stateless, single-use password-reset tokens.
// Signed with AUTH_SECRET + the user's current password hash, so a token stops
// working the moment the password changes (i.e. after it's used). 1-hour expiry.

import { db } from './db';
import { users, type DbUser } from './db/schema';
import { eq } from 'drizzle-orm';
import { authSecret } from './secret';

const TTL_MS = 60 * 60 * 1000; // 1 hour
const enc = new TextEncoder();

function toB64url(bytes: Uint8Array): string {
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(str: string): Uint8Array {
  const s = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function hmac(data: string, key: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, enc.encode(data));
  return toB64url(new Uint8Array(sig));
}

export async function signResetToken(u: { id: number | string; passwordHash: string }): Promise<string> {
  const payload = toB64url(enc.encode(JSON.stringify({ uid: String(u.id), exp: Date.now() + TTL_MS })));
  const sig = await hmac(payload, authSecret() + u.passwordHash);
  return `${payload}.${sig}`;
}

// Returns the user if the token is valid, unexpired, and matches their current hash.
export async function verifyResetToken(token: string | undefined | null): Promise<DbUser | null> {
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  let data: { uid?: string; exp?: number };
  try {
    data = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
  } catch {
    return null;
  }
  if (!data?.uid || !data.exp || Date.now() > data.exp) return null;
  const [u] = await db.select().from(users).where(eq(users.id, Number(data.uid)));
  if (!u || !u.active) return null;
  if ((await hmac(payload, authSecret() + u.passwordHash)) !== sig) return null;
  return u;
}
