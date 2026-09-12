import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import {
  monthlyScopeSchema,
  saveMonthlyReviewSchema,
} from '@/lib/contracts/monthly-review';
import { formatContractError } from '@/lib/contracts/shared';
import {
  getMonthlyReviewContext,
  monthlyScopeOptions,
  reopenMonthlyReview,
  saveMonthlyReview,
} from '@/lib/monthly-reviews';
import { HttpError } from '@/lib/server-errors';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
function parseMonthlyQuery(req: NextRequest) {
  return monthlyScopeSchema.parse({
    storeId: req.nextUrl.searchParams.has('storeId')
      ? Number(req.nextUrl.searchParams.get('storeId'))
      : undefined,
    groupId: req.nextUrl.searchParams.has('groupId')
      ? Number(req.nextUrl.searchParams.get('groupId'))
      : undefined,
    month: req.nextUrl.searchParams.get('month'),
  });
}
function failure(error: unknown) {
  if (error instanceof HttpError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status }
    );
  if (error instanceof z.ZodError)
    return NextResponse.json(
      { error: formatContractError(error) },
      { status: 400 }
    );
  return NextResponse.json(
    { error: 'The monthly review could not be processed' },
    { status: 500 }
  );
}
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const data =
      req.nextUrl.searchParams.get('options') === '1'
        ? await monthlyScopeOptions(session.user)
        : await getMonthlyReviewContext(session.user, parseMonthlyQuery(req));
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const input = saveMonthlyReviewSchema.parse(await req.json());
    const record = await saveMonthlyReview(session.user, input);
    return NextResponse.json({ record });
  } catch (error) {
    return failure(error);
  }
}
export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const input = z
      .object({
        scope: monthlyScopeSchema,
        lockVersion: z.number().int().positive(),
        reason: z.string().trim().min(1).max(2000),
      })
      .parse(await req.json());
    await reopenMonthlyReview(
      session.user,
      input.scope,
      input.lockVersion,
      input.reason
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
