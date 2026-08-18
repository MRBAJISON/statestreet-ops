import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { buildCatalogTemplate, categoriesForStore, loadCatalogImportReferences } from '@/lib/import-catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CATALOG_IMPORTERS = new Set(['owner', 'inventory', 'commercial']);

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!CATALOG_IMPORTERS.has(session.user.role)) {
    return NextResponse.json({ error: 'Inventory access required' }, { status: 403 });
  }

  const storeIdParam = Number(req.nextUrl.searchParams.get('storeId') ?? '');
  const storeId = Number.isSafeInteger(storeIdParam) && storeIdParam > 0 ? storeIdParam : null;

  const references = await loadCatalogImportReferences();
  // With a store chosen the template lists only the categories that store sells,
  // so nobody fills in one it has no mapping for and gets the row rejected.
  const categories = storeId ? await categoriesForStore(storeId) : references.categories;
  const buffer = await buildCatalogTemplate(references, categories);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="product-catalog-template.xlsx"',
      'Cache-Control': 'no-store',
    },
  });
}
