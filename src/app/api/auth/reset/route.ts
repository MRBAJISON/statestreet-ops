import { NextRequest, NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { verifyResetToken } from '@/lib/reset';
import { hashPassword } from '@/lib/password';
import { getOrgSettings } from '@/lib/org-server';

// Complete a password reset using a valid token.
export async function POST(req: NextRequest) {
  try {
    const { token, password } = (await req.json()) ?? {};
    const minPasswordLength = (await getOrgSettings()).security.minPasswordLen;
    if (!password || String(password).length < minPasswordLength) {
      return NextResponse.json(
        { error: `Password must be at least ${minPasswordLength} characters` },
        { status: 400 }
      );
    }
    const user = await verifyResetToken(token);
    if (!user) {
      return NextResponse.json({ error: 'This reset link is invalid or has expired' }, { status: 400 });
    }
    const passwordHash = await hashPassword(String(password));
    const [consumed] = await db
      .update(users)
      .set({
        passwordHash,
        sessionVersion: sql`${users.sessionVersion} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(users.id, user.id),
          eq(users.passwordHash, user.passwordHash),
          eq(users.sessionVersion, user.sessionVersion)
        )
      )
      .returning({ id: users.id });
    if (!consumed) {
      return NextResponse.json({ error: 'This reset link has already been used' }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
