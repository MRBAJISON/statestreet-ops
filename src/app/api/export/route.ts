import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { canReadUnitCost } from '@/lib/access';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { stores } from '@/lib/db/foundation-schema';
import {
  buildWorkbook,
  canExportScope,
  canIncludeCustomerContacts,
  exportFilename,
  getExportScopeConfig,
  loadTypedExportRows,
  parseExportDateRange,
  parseExportScope,
} from '@/lib/export';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const roleConfig = getExportScopeConfig(session.user.role);
  if (!roleConfig) return NextResponse.json({ error: 'No export scope is configured for this role' }, { status: 403 });

  const rawScope = req.nextUrl.searchParams.get('scope');
  const requestedScope = parseExportScope(rawScope);
  if (rawScope && !requestedScope) {
    return NextResponse.json({ error: 'Unknown export scope' }, { status: 400 });
  }
  const scope = requestedScope ?? roleConfig.scope;
  if (!canExportScope(session.user.role, scope)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const parsedRange = parseExportDateRange(req.nextUrl.searchParams);
  if ('error' in parsedRange) {
    return NextResponse.json({ error: parsedRange.error }, { status: 400 });
  }
  const range = parsedRange.range;

  let storeId: number | undefined;
  let storeLabel: string | undefined;
  if (scope === 'store') {
    if (!session.user.store) {
      return NextResponse.json({ error: 'No store is assigned to your account' }, { status: 403 });
    }
    const [assignedStore] = await db
      .select({ id: stores.id, name: stores.name })
      .from(stores)
      .where(
        and(
          eq(stores.code, session.user.store),
          eq(stores.type, 'store'),
          eq(stores.active, true)
        )
      )
      .limit(1);
    if (!assignedStore) {
      return NextResponse.json({ error: 'The assigned store was not found or is inactive' }, { status: 409 });
    }
    storeId = assignedStore.id;
    storeLabel = assignedStore.name;
  }

  const includeCustomerContacts = canIncludeCustomerContacts(session.user.role, scope);
  const includeUnitCost = canReadUnitCost(session.user.role);
  const rows = await loadTypedExportRows({
    scope,
    range,
    includeCustomerContacts,
    includeUnitCost,
    storeId,
  });
  const buffer = await buildWorkbook({
    scope,
    range,
    rows,
    includeCustomerContacts,
    includeUnitCost,
    storeLabel,
  });
  const filename = exportFilename(scope, range);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
