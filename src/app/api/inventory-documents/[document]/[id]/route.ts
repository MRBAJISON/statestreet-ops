import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { inventoryDocumentDecisionSchema, inventoryDocumentSchema } from '@/lib/contracts/documents';
import { formatContractError } from '@/lib/contracts/shared';
import { decideReplenishment, decideStockCount, decideStockTransfer } from '@/lib/inventory-documents';
import { getInventoryDocument } from '@/lib/inventory-document-queries';
import { HttpError } from '@/lib/server-errors';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ document: string; id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const values = await params;
    const parsedDocument = inventoryDocumentSchema.safeParse(values.document);
    if (!parsedDocument.success) return NextResponse.json({ error: 'Unknown inventory document' }, { status: 404 });
    const id = Number(values.id);
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    const document = await getInventoryDocument(parsedDocument.data, id, session.user);
    return NextResponse.json(
      { document },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'The inventory document could not be loaded' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ document: string; id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const values = await params;
    const parsedDocument = inventoryDocumentSchema.safeParse(values.document);
    if (!parsedDocument.success) return NextResponse.json({ error: 'Unknown inventory document' }, { status: 404 });
    if (parsedDocument.data === 'goods-receipt') {
      return NextResponse.json({ error: 'Received goods documents are immutable' }, { status: 405 });
    }
    const id = Number(values.id);
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    const parsed = inventoryDocumentDecisionSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: formatContractError(parsed.error) }, { status: 400 });

    let record: Record<string, unknown>;
    if (parsedDocument.data === 'stock-transfer') record = await decideStockTransfer(session.user, id, parsed.data);
    else if (parsedDocument.data === 'stock-count') record = await decideStockCount(session.user, id, parsed.data);
    else record = await decideReplenishment(session.user, id, parsed.data);
    return NextResponse.json({ ok: true, record });
  } catch (error) {
    if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'The inventory document could not be updated' }, { status: 500 });
  }
}
