import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { entries } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { buildWorkbook, type ExportScope } from '@/lib/export';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Which roles may pull which scope. Owner can do everything.
const ALLOWED: Record<ExportScope, string[]> = {
  all: ['operations', 'owner'],
  finance: ['finance', 'owner'],
};

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const scope: ExportScope = req.nextUrl.searchParams.get('scope') === 'finance' ? 'finance' : 'all';
  if (!ALLOWED[scope].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rows = await db.select().from(entries).orderBy(desc(entries.createdAt));
  const buffer = await buildWorkbook(scope, rows);

  const date = new Date().toISOString().slice(0, 10);
  const filename = `statestreet-${scope === 'all' ? 'all-departments' : 'finance-stores'}-${date}.xlsx`;
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
