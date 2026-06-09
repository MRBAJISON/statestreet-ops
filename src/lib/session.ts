// Tamper-proof session tokens via HMAC-SHA256 (Web Crypto — works in edge + node).
// Token format: base64url(payload) + "." + base64url(hmac(payload))
// A forged/edited cookie fails signature verification.

const SECRET = process.env.AUTH_SECRET || 'dev-insecure-secret-change-me';
const enc = new TextEncoder();

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
  const key = await crypto.subtle.importKey('raw', enc.encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
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
    return JSON.parse(new TextDecoder().decode(fromB64url(payload))) as SessionData;
  } catch {
    return null;
  }
}
