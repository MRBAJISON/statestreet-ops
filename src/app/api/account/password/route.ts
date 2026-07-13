import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { createSessionToken, getSession } from '@/lib/auth';
import { verifyPassword, hashPassword } from '@/lib/password';
import { getOrgSettings } from '@/lib/org-server';
import { isDepartment, isUserRole, isValidRoleDepartment } from '@/lib/access';

// Self-service password change for the signed-in user.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const minLen = (await getOrgSettings()).security.minPasswordLen;
  const { currentPassword, newPassword } = (await req.json()) ?? {};
  if (!newPassword || String(newPassword).length < minLen) {
    return NextResponse.json({ error: `New password must be at least ${minLen} characters` }, { status: 400 });
  }

  const [u] = await db.select().from(users).where(eq(users.id, Number(session.user.id)));
  if (!u) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (!(await verifyPassword(String(currentPassword ?? ''), u.passwordHash))) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
  }

  const nextPasswordHash = await hashPassword(String(newPassword));
  const [row] = await db
    .update(users)
    .set({
      passwordHash: nextPasswordHash,
      sessionVersion: sql`${users.sessionVersion} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(users.id, u.id),
        eq(users.passwordHash, u.passwordHash),
        eq(users.sessionVersion, u.sessionVersion)
      )
    )
    .returning();
  if (!row) {
    return NextResponse.json({ error: 'Your password changed while this request was in progress. Sign in and try again.' }, { status: 409 });
  }
  if (!isUserRole(row.role) || !isDepartment(row.department) || !isValidRoleDepartment(row.role, row.department)) {
    return NextResponse.json({ error: 'Account access configuration is invalid' }, { status: 409 });
  }
  const token = await createSessionToken({
    id: String(row.id),
    name: row.name,
    email: row.email,
    role: row.role,
    department: row.department,
    store: row.store ?? '',
    sessionVersion: row.sessionVersion,
  });
  const cookieStore = await cookies();
  cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * (await getOrgSettings()).security.sessionDays,
    path: '/',
  });
  return NextResponse.json({ ok: true });
}
