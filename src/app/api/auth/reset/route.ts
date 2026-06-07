import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { verifyResetToken } from '@/lib/reset';
import { hashPassword } from '@/lib/password';

// Complete a password reset using a valid token.
export async function POST(req: NextRequest) {
  try {
    const { token, password } = (await req.json()) ?? {};
    if (!password || String(password).length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }
    const user = await verifyResetToken(token);
    if (!user) {
      return NextResponse.json({ error: 'This reset link is invalid or has expired' }, { status: 400 });
    }
    const passwordHash = await hashPassword(String(password));
    await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
