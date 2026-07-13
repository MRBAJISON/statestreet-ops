import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  goodsReceiptSchema,
  inventoryDocumentSchema,
  replenishmentSchema,
  stockCountSchema,
  stockTransferSchema,
} from '@/lib/contracts/documents';
import { formatContractError } from '@/lib/contracts/shared';
import {
  createGoodsReceipt,
  createReplenishment,
  createStockCount,
  createStockTransfer,
} from '@/lib/inventory-documents';
import { listInventoryDocuments } from '@/lib/inventory-document-queries';
import { databaseErrorCode, HttpError } from '@/lib/server-errors';

export const runtime = 'nodejs';

const SCHEMAS = {
  'stock-transfer': stockTransferSchema,
  'goods-receipt': goodsReceiptSchema,
  'stock-count': stockCountSchema,
  replenishment: replenishmentSchema,
} as const;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ document: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const parsedDocument = inventoryDocumentSchema.safeParse((await params).document);
    if (!parsedDocument.success) return NextResponse.json({ error: 'Unknown inventory document' }, { status: 404 });
    const documents = await listInventoryDocuments(parsedDocument.data, session.user);
    return NextResponse.json(
      { documents },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Recent inventory documents could not be loaded' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ document: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const parsedDocument = inventoryDocumentSchema.safeParse((await params).document);
    if (!parsedDocument.success) return NextResponse.json({ error: 'Unknown inventory document' }, { status: 404 });
    const document = parsedDocument.data;
    const parsed = SCHEMAS[document].safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: formatContractError(parsed.error) }, { status: 400 });

    let record: Record<string, unknown>;
    if (document === 'stock-transfer') record = await createStockTransfer(session.user, parsed.data as never);
    else if (document === 'goods-receipt') record = await createGoodsReceipt(session.user, parsed.data as never);
    else if (document === 'stock-count') record = await createStockCount(session.user, parsed.data as never);
    else record = await createReplenishment(session.user, parsed.data as never);
    return NextResponse.json({ ok: true, record }, { status: 201 });
  } catch (error) {
    if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status });
    const code = databaseErrorCode(error);
    if (code === '23503') return NextResponse.json({ error: 'A selected reference does not exist' }, { status: 400 });
    if (code === '23505') return NextResponse.json({ error: 'A duplicate product or document was detected' }, { status: 409 });
    return NextResponse.json({ error: 'The inventory document could not be saved' }, { status: 500 });
  }
}
