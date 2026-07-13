import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { analyticsQuerySchema, analyticsViewSchema } from '@/lib/contracts/analytics';
import { formatContractError } from '@/lib/contracts/shared';
import { getAnalyticsResponse } from '@/lib/reporting';
import { getLegacyBackfillStatus } from '@/lib/reporting/readiness';
import { resolveAnalyticsScope } from '@/lib/reporting/shared';
import { HttpError } from '@/lib/server-errors';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ view: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const parsedView = analyticsViewSchema.safeParse((await params).view);
    if (!parsedView.success) return NextResponse.json({ error: 'Unknown analytics view' }, { status: 404 });
    const parsedQuery = analyticsQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsedQuery.success) {
      return NextResponse.json({ error: formatContractError(parsedQuery.error) }, { status: 400 });
    }
    const scope = await resolveAnalyticsScope(session.user, parsedView.data, parsedQuery.data);
    const backfill = await getLegacyBackfillStatus();
    if (!backfill.ready) {
      return NextResponse.json(
        {
          error: 'Historical data must be reconciled before typed analytics can be enabled.',
          code: 'LEGACY_BACKFILL_REQUIRED',
          remainingEntries: backfill.remainingEntries,
        },
        { status: 503, headers: { 'Cache-Control': 'private, no-store' } }
      );
    }
    const response = await getAnalyticsResponse(parsedView.data, scope);
    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
