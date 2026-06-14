import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { getSession } from '@/lib/auth';
import { verifyPassword, hashPassword } from '@/lib/password';

// Self-service password change for the signed-in user.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { currentPassword, newPassword } = (await req.json()) ?? {};
  if (!newPassword || String(newPassword).length < 6) {
    return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 });
  }

  const [u] = await db.select().from(users).where(eq(users.id, Number(session.user.id)));
  if (!u) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (!(await verifyPassword(String(currentPassword ?? ''), u.passwordHash))) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
  }

  await db.update(users).set({ passwordHash: await hashPassword(String(newPassword)) }).where(eq(users.id, u.id));
  return NextResponse.json({ ok: true });
}
