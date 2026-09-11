import { NextResponse } from 'next/server';
import { pdf } from '@react-pdf/renderer';
import { getSession } from '@/lib/auth';
import { getOrgSettings } from '@/lib/org-server';
import { getCreditSalePaymentReceipt } from '@/lib/customer-transactions';
import { CustomerCreditPaymentReceiptDocument } from '@/components/pdf/CustomerCreditPaymentReceiptDocument';
import { HttpError } from '@/lib/server-errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function streamToBuffer(stream: NodeJS.ReadableStream) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const resolved = await params;
    const creditSaleId = parseId(resolved.id);
    const paymentId = parseId(resolved.paymentId);
    if (!creditSaleId || !paymentId) return NextResponse.json({ error: 'Invalid credit sale or payment id' }, { status: 400 });
    const receipt = await getCreditSalePaymentReceipt(session.user, creditSaleId, paymentId);
    if (!receipt) return NextResponse.json({ error: 'Payment receipt not found' }, { status: 404 });
    const org = await getOrgSettings();
    const rendered = await pdf(CustomerCreditPaymentReceiptDocument({ receipt, currency: org.currency })).toBuffer();
    const buffer = await streamToBuffer(rendered as unknown as NodeJS.ReadableStream);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${receipt.receiptNumber}.pdf"`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
