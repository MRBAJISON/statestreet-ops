import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  createCreditSaleSchema,
  createCreditNoteSchema,
  createDepositSchema,
} from '@/lib/contracts/customer-transactions';
import { dateSchema, formatContractError } from '@/lib/contracts/shared';
import {
  createCreditSale,
  createCreditNote,
  createDeposit,
  listCustomerTransactions,
} from '@/lib/customer-transactions';
import { HttpError } from '@/lib/server-errors';

function optionalPositiveId(value: string | null) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const storeParam = req.nextUrl.searchParams.get('storeId');
    const storeId = optionalPositiveId(storeParam);
    if (storeId === null) return NextResponse.json({ error: 'storeId must be a positive integer' }, { status: 400 });
    const dateParam = req.nextUrl.searchParams.get('businessDate') ?? undefined;
    if (dateParam && !dateSchema.safeParse(dateParam).success) return NextResponse.json({ error: 'businessDate must be a valid YYYY-MM-DD date' }, { status: 400 });
    const includeOpenDeposits = req.nextUrl.searchParams.get('openDeposits') === 'true';
    const includeOpenCreditSales = req.nextUrl.searchParams.get('openCredits') === 'true';
    const transactions = await listCustomerTransactions(session.user, storeId, dateParam, includeOpenDeposits, includeOpenCreditSales);
    return NextResponse.json(transactions);
  } catch (error) {
    if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => null) as { type?: string } | null;
    const parsed = body?.type === 'credit-sale'
      ? createCreditSaleSchema.safeParse(body)
      : body?.type === 'credit-note'
        ? createCreditNoteSchema.safeParse(body)
        : createDepositSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: formatContractError(parsed.error) }, { status: 400 });
    const id = parsed.data.type === 'credit-sale'
      ? await createCreditSale(session.user, parsed.data)
      : parsed.data.type === 'credit-note'
        ? await createCreditNote(session.user, parsed.data)
        : await createDeposit(session.user, parsed.data);
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
