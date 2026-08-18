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
  const apply = String(form?.get('apply') ?? '') === 'true';

  let parsed;
  try {
    const references = await loadCatalogImportReferences();
    parsed = await parseCatalogFile(Buffer.from(await file.arrayBuffer()), references);
  } catch (error) {
    if (error instanceof CatalogImportFileError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const summary = {
    products: parsed.products.length,
    stockRows: parsed.stock.length,
    totalRows: parsed.totalRows,
    errors: parsed.errors,
  };

  if (!apply) return NextResponse.json({ preview: true, ...summary });

  if (!parsed.products.length && !parsed.stock.length) {
    return NextResponse.json({ error: 'There is nothing to import in that file' }, { status: 400 });
  }

  const result = await db.execute(
    buildCommitCatalogImportQuery({
      filename: safeFilename(file.name),
      actorUserId: Number(session.user.id),
      asOfDate: new Date().toISOString().slice(0, 10),
      products: parsed.products,
      stock: parsed.stock,
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
    // Stock rows naming a SKU that is neither in the file nor already in the
    // catalogue are reported rather than dropped quietly.
    unmatchedStockRows: Number(row.unmatched_stock_rows ?? 0),
  });
}
