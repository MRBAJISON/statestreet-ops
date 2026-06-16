import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { entries } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { buildWorkbook, type ExportScope } from '@/lib/export';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Which roles may pull which scope. Each department exports its own data; store
// managers export their own store; operations gets everything.
const ALLOWED: Record<ExportScope, string[]> = {
  all: ['operations'],
  finance: ['finance'],
  commercial: ['commercial'],
  marketing: ['marketing'],
  inventory: ['inventory'],
  brand: ['brand'],
  store: ['store-manager'],
};

const VALID_SCOPES = Object.keys(ALLOWED) as ExportScope[];
const FILE_SLUG: Record<ExportScope, string> = {
  all: 'all-departments', finance: 'finance-stores', commercial: 'commercial',
  marketing: 'marketing', inventory: 'inventory', brand: 'brand', store: 'my-store',
};

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const raw = req.nextUrl.searchParams.get('scope') ?? '';
  const scope = (VALID_SCOPES.includes(raw as ExportScope) ? raw : 'all') as ExportScope;
  if (!ALLOWED[scope].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (scope === 'store' && !session.user.store) {
    return NextResponse.json({ error: 'No store assigned to your account' }, { status: 403 });
  }

  const rows = await db.select().from(entries).orderBy(desc(entries.createdAt));
  const buffer = await buildWorkbook(scope, rows, { store: session.user.store });

  const date = new Date().toISOString().slice(0, 10);
  const filename = `statestreet-${FILE_SLUG[scope]}-${date}.xlsx`;
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
