import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  buildCommitCatalogImportQuery,
  CatalogImportFileError,
  loadCatalogImportReferences,
  parseCatalogFile,
} from '@/lib/import-catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 5_000_000;
// Inventory owns the bulk load because it is stock data; Commercial keeps the
// single-product form for price changes because Commercial owns pricing.
const CATALOG_IMPORTERS = new Set(['owner', 'inventory', 'commercial']);

function safeFilename(value: unknown): string {
  const lastSegment = String(value ?? 'catalog.xlsx').split(/[\\/]/).pop()?.trim() || 'catalog.xlsx';
  return lastSegment.slice(0, 255);
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!CATALOG_IMPORTERS.has(session.user.role)) {
    return NextResponse.json({ error: 'Inventory access required' }, { status: 403 });
  }
  const references = await loadCatalogImportReferences();
  return NextResponse.json({
    stores: references.stores.map((store) => ({
      id: store.id,
      name: store.name,
      brandName: store.brandName,
      // A store with no brand, or with more than one, cannot be imported for
      // because the products would have no single brand to belong to.
      importable: store.brandId != null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!CATALOG_IMPORTERS.has(session.user.role)) {
    return NextResponse.json({ error: 'Inventory access required' }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Attach a spreadsheet to import' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'That file is larger than 5MB' }, { status: 400 });
  }

  const storeId = Number(form?.get('storeId') ?? 0);
  if (!Number.isSafeInteger(storeId) || storeId <= 0) {
    return NextResponse.json({ error: 'Choose the store this stock belongs to' }, { status: 400 });
  }
  const apply = String(form?.get('apply') ?? '') === 'true';

  const references = await loadCatalogImportReferences();
  const store = references.stores.find((candidate) => candidate.id === storeId);
  if (!store) return NextResponse.json({ error: 'Store was not found or is inactive' }, { status: 400 });
  if (store.brandId == null) {
    return NextResponse.json(
      { error: `${store.name} is not mapped to exactly one brand, so its products have no brand to belong to` },
      { status: 400 }
    );
  }

  let parsed;
  try {
    parsed = await parseCatalogFile(Buffer.from(await file.arrayBuffer()), references);
  } catch (error) {
    if (error instanceof CatalogImportFileError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const summary = {
    storeName: store.name,
    brandName: store.brandName,
    products: parsed.products.length,
    totalRows: parsed.totalRows,
    errors: parsed.errors,
  };

  if (!apply) return NextResponse.json({ preview: true, ...summary });

  if (!parsed.products.length) {
    return NextResponse.json({ error: 'There is nothing to import in that file' }, { status: 400 });
  }

  const result = await db.execute(
    buildCommitCatalogImportQuery({
      filename: safeFilename(file.name),
      actorUserId: Number(session.user.id),
      storeId: store.id,
      brandId: store.brandId,
      asOfDate: new Date().toISOString().slice(0, 10),
      products: parsed.products,
      totalRows: parsed.totalRows,
      errorRows: parsed.errors.length,
    })
  );
  const row = (result.rows?.[0] ?? {}) as Record<string, unknown>;

  return NextResponse.json({
    applied: true,
    ...summary,
    batchId: Number(row.batch_id ?? 0),
    productsWritten: Number(row.products_written ?? 0),
    stockWritten: Number(row.stock_written ?? 0),
  });
}
