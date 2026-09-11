import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  creditSalePaymentSchema,
  decideCreditNoteSchema,
  decideDepositCancellationSchema,
  depositPaymentSchema,
  collectDepositSchema,
  inventoryCreditDecisionSchema,
  redeemCreditNoteSchema,
  requestDepositCancellationSchema,
} from '@/lib/contracts/customer-transactions';
import { formatContractError } from '@/lib/contracts/shared';
import {
  addCreditSalePayment,
  addDepositPayment,
  collectDeposit,
  decideCreditNote,
  decideCreditNoteInventory,
  decideDepositCancellation,
  redeemCreditNote,
  requestDepositCancellation,
} from '@/lib/customer-transactions';
import { HttpError } from '@/lib/server-errors';

function parseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const id = parseId((await params).id);
    if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    const body = await req.json().catch(() => null) as { type?: string; action?: string } | null;
    let parsed;
    if (body?.type === 'credit-sale' && body.action === 'payment') parsed = creditSalePaymentSchema.safeParse(body);
    else if (body?.type === 'credit-note' && (body.action === 'approve' || body.action === 'reject')) parsed = decideCreditNoteSchema.safeParse(body);
    else if (body?.type === 'credit-note' && body.action === 'redeem') parsed = redeemCreditNoteSchema.safeParse(body);
    else if (body?.type === 'credit-note' && body.action === 'inventory-decision') parsed = inventoryCreditDecisionSchema.safeParse(body);
    else if (body?.type === 'deposit' && body.action === 'payment') parsed = depositPaymentSchema.safeParse(body);
    else if (body?.type === 'deposit' && body.action === 'collect') parsed = collectDepositSchema.safeParse(body);
    else if (body?.type === 'deposit' && body.action === 'request-cancellation') parsed = requestDepositCancellationSchema.safeParse(body);
    else if (body?.type === 'deposit' && body.action === 'decide-cancellation') parsed = decideDepositCancellationSchema.safeParse(body);
    else return NextResponse.json({ error: 'Unknown transaction action' }, { status: 400 });
    if (!parsed.success) return NextResponse.json({ error: formatContractError(parsed.error) }, { status: 400 });

    const input = parsed.data;
    if (input.type === 'credit-sale' && input.action === 'payment') {
      const result = await addCreditSalePayment(session.user, id, input);
      return NextResponse.json({ ok: true, id, paymentId: result.paymentId, status: result.status, openValue: result.openValue });
    }
    if (input.type === 'credit-note' && (input.action === 'approve' || input.action === 'reject')) await decideCreditNote(session.user, id, input);
    else if (input.type === 'credit-note' && input.action === 'redeem') await redeemCreditNote(session.user, id, input);
    else if (input.type === 'credit-note' && input.action === 'inventory-decision') await decideCreditNoteInventory(session.user, id, input);
    else if (input.type === 'deposit' && input.action === 'payment') await addDepositPayment(session.user, id, input);
    else if (input.type === 'deposit' && input.action === 'collect') await collectDeposit(session.user, id);
    else if (input.type === 'deposit' && input.action === 'request-cancellation') await requestDepositCancellation(session.user, id, input.reason);
    else if (input.type === 'deposit' && input.action === 'decide-cancellation') await decideDepositCancellation(session.user, id, input);
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
