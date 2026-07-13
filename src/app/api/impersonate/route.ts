import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { getSession, getSessionFromToken } from '@/lib/auth';
import { signSession } from '@/lib/session';
import { getOrgSettings } from '@/lib/org-server';
import { isDepartment, isUserRole, isValidRoleDepartment } from '@/lib/access';

export const runtime = 'nodejs';

// Owner-only "open account as user" (impersonation). The owner's own session is
// stashed in `admin_session` so they can return. No passwords are involved or
// exposed — this mints a signed session for the target server-side.

function homeFor(role: string, department: string): string {
  if (role === 'store-manager') return '/dashboard/store-manager';
  if (role === 'owner') return '/dashboard/executive';
  if (department === 'brand') return '/dashboard/brand-health';
  return `/dashboard/${department}`;
}

async function cookieOpts() {
  const sessionDays = (await getOrgSettings()).security.sessionDays;
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * sessionDays,
    path: '/',
  };
}

// Start impersonating a user (owner only).
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (session?.user.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { userId } = (await req.json().catch(() => ({}))) as { userId?: number | string };
  const numId = Number(userId);
  if (!Number.isInteger(numId)) return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });

  const [target] = await db.select().from(users).where(eq(users.id, numId));
  if (!target || !target.active) return NextResponse.json({ error: 'Active user not found' }, { status: 404 });
  if (!isUserRole(target.role) || !isDepartment(target.department) || !isValidRoleDepartment(target.role, target.department)) {
    return NextResponse.json({ error: 'User access configuration is invalid' }, { status: 409 });
  }

  const cookieStore = await cookies();
  const opts = await cookieOpts();
  // Stash the owner's current session so they can return to it.
  const current = cookieStore.get('session');
  if (current) cookieStore.set('admin_session', current.value, opts);

  const token = await signSession({
    id: target.id,
    role: target.role,
    sessionVersion: target.sessionVersion,
  });
  cookieStore.set('session', token, opts);
  // Cosmetic flag for the banner (display name only — not security-bearing).
  cookieStore.set('impersonating', target.name, { ...opts, httpOnly: false });

  return NextResponse.json({ ok: true, redirect: homeFor(target.role, target.department) });
}

// Return to the owner account.
export async function DELETE() {
  const cookieStore = await cookies();
  const admin = cookieStore.get('admin_session');
  const session = admin ? await getSessionFromToken(admin.value) : null;
  if (!admin || session?.user.role !== 'owner') {
    return NextResponse.json({ error: 'No admin session to return to' }, { status: 400 });
  }
  const opts = await cookieOpts();
  cookieStore.set('session', admin.value, opts);
  cookieStore.delete('admin_session');
  cookieStore.delete('impersonating');
  return NextResponse.json({ ok: true, redirect: '/dashboard/admin' });
}
