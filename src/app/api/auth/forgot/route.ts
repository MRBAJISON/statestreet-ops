import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { signResetToken } from '@/lib/reset';
import { sendEmail } from '@/lib/email';

// Request a password-reset link. Always responds generically (no account enumeration).
export async function POST(req: NextRequest) {
  try {
    const { email } = (await req.json()) ?? {};
    if (email && typeof email === 'string') {
      const [u] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim()));
      if (u) {
        const token = await signResetToken(u);
        const link = `${req.nextUrl.origin}/reset-password?token=${encodeURIComponent(token)}`;
        await sendEmail({
          to: u.email,
          subject: 'Reset your StateStreet Ops password',
          html: `<p>Hi ${u.name},</p><p>Click the link below to set a new password. It expires in 1 hour.</p><p><a href="${link}">${link}</a></p><p>If you didn't request this, you can ignore this email.</p>`,
        });
      }
    }
  } catch {
    /* ignore — still respond generically */
  }
  return NextResponse.json({ ok: true });
}
