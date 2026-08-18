import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { buildCatalogTemplate, loadCatalogImportReferences } from '@/lib/import-catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CATALOG_IMPORTERS = new Set(['owner', 'inventory', 'commercial']);

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!CATALOG_IMPORTERS.has(session.user.role)) {
    return NextResponse.json({ error: 'Inventory access required' }, { status: 403 });
  }
  const references = await loadCatalogImportReferences();
  const buffer = await buildCatalogTemplate(references);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="product-catalog-template.xlsx"',
      'Cache-Control': 'no-store',
    },
  });
}
