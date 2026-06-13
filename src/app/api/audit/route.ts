import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auditLog } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { getSession } from '@/lib/auth';

// Audit trail rows (finance + owner only).
export async function GET() {
  const session = await getSession();
  if (!session || !['finance', 'owner'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const rows = await db.select().from(auditLog).orderBy(desc(auditLog.createdAt));
  return NextResponse.json({ audit: rows });
}
