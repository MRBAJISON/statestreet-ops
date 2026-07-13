import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { formatContractError } from '@/lib/contracts/shared';
import { HttpError } from '@/lib/server-errors';
import { decideWeeklyReview } from '@/lib/weekly-reviews';

const decisionSchema = z
  .object({
    action: z.enum(['approve', 'reopen']),
    lockVersion: z.number().int().positive(),
    reason: z.string().trim().max(1000).optional(),
  })
  .refine((value) => value.action !== 'reopen' || Boolean(value.reason), {
    path: ['reason'],
    message: 'A reason is required to reopen a review',
  });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    const parsed = decisionSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: formatContractError(parsed.error) }, { status: 400 });
    const record = await decideWeeklyReview(session.user, id, parsed.data);
    return NextResponse.json({ ok: true, record });
  } catch (error) {
    if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'The weekly review could not be updated' }, { status: 500 });
  }
}
