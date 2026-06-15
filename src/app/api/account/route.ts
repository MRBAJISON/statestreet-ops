import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { getSession, createSessionToken } from '@/lib/auth';
import { getOrgSettings } from '@/lib/org-server';

// Update the signed-in user's own profile (display name).
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name } = (await req.json()) ?? {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const [row] = await db.update(users).set({ name: name.trim() }).where(eq(users.id, Number(session.user.id))).returning();
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Re-issue the session cookie so the new name shows immediately (it lives in the token).
  const token = await createSessionToken({
    id: String(row.id), name: row.name, email: row.email, role: row.role as never, department: row.department as never, store: row.store ?? '',
  });
  const sessionDays = (await getOrgSettings()).security.sessionDays;
  (await cookies()).set('session', token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 60 * 60 * 24 * sessionDays, path: '/',
  });

  return NextResponse.json({ ok: true, name: row.name });
}
