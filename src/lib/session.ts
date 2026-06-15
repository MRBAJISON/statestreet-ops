// Tamper-proof session tokens via HMAC-SHA256 (Web Crypto — works in edge + node).
// Token format: base64url(payload) + "." + base64url(hmac(payload))
// A forged/edited cookie fails signature verification.

import { authSecret } from './secret';

const enc = new TextEncoder();
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000; // backstop self-expiry; the cookie maxAge (org sessionDays) is the real control

function toB64url(bytes: Uint8Array): string {
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(str: string): Uint8Array {
  const s = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(authSecret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return toB64url(new Uint8Array(sig));
}

export interface SessionData {
  userId: string;
  name: string;
  role: string;
  department: string;
  store?: string;
  ts: number;
}

export async function signSession(user: {
  id: string | number;
  name: string;
  role: string;
  department: string;
  store?: string | null;
}): Promise<string> {
  const payload = toB64url(
    enc.encode(
      JSON.stringify({ userId: String(user.id), name: user.name, role: user.role, department: user.department, store: user.store ?? '', ts: Date.now() })
    )
  );
  const sig = await hmac(payload);
  return `${payload}.${sig}`;
}

export async function verifySession(token: string | undefined | null): Promise<SessionData | null> {
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  if ((await hmac(payload)) !== sig) return null; // signature mismatch -> reject
  try {
    const data = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as SessionData;
    // Reject stale tokens even if the cookie somehow outlives its maxAge.
    if (!data.ts || Date.now() - data.ts > MAX_AGE_MS) return null;
    return data;
  } catch {
    return null;
  }
}
