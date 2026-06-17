import { NextRequest, NextResponse } from 'next/server';
import { authenticate, createSessionToken } from '@/lib/auth';
import { getOrgSettings } from '@/lib/org-server';
import { cookies } from 'next/headers';

// Best-effort per-IP brute-force throttle (resets per serverless instance).
const ATTEMPTS = new Map<string, { count: number; ts: number }>();
const WINDOW_MS = 5 * 60_000; // 5 minutes
const MAX_ATTEMPTS = 10;

function loginThrottled(ip: string): boolean {
  const now = Date.now();
  const rec = ATTEMPTS.get(ip);
  if (!rec || now - rec.ts > WINDOW_MS) {
    ATTEMPTS.set(ip, { count: 1, ts: now });
    return false;
  }
  rec.count += 1;
  return rec.count > MAX_ATTEMPTS;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (loginThrottled(ip)) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 });
  }

  const { email, password } = await req.json();
  const user = await authenticate(email, password);

  if (!user) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const token = await createSessionToken(user);
  const sessionDays = (await getOrgSettings()).security.sessionDays;
  const cookieStore = await cookies();
  cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * sessionDays,
    path: '/',
  });

  return NextResponse.json({
    user: { id: user.id, name: user.name, role: user.role, department: user.department },
  });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete('session');
  cookieStore.delete('admin_session');
  cookieStore.delete('impersonating');
  return NextResponse.json({ ok: true });
}
