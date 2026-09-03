import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { weeklyReviewSchema } from '@/lib/contracts/documents';
import { dateSchema } from '@/lib/contracts/shared';
import { formatContractError } from '@/lib/contracts/shared';
import { databaseErrorCode, HttpError } from '@/lib/server-errors';
import { getWeeklyReview, getWeeklyReviewCategories, saveWeeklyReview } from '@/lib/weekly-reviews';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const rawWeekEnd = req.nextUrl.searchParams.get('weekEnd');
    const parsedWeekEnd = rawWeekEnd ? dateSchema.safeParse(rawWeekEnd) : null;
    if (parsedWeekEnd && !parsedWeekEnd.success) {
      return NextResponse.json({ error: formatContractError(parsedWeekEnd.error) }, { status: 400 });
    }
    const [review, categories] = await Promise.all([
      getWeeklyReview(session.user, parsedWeekEnd?.data),
      getWeeklyReviewCategories(session.user),
    ]);
    return NextResponse.json({ review, categories }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'The weekly review could not be loaded' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const parsed = weeklyReviewSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: formatContractError(parsed.error) }, { status: 400 });
    const record = await saveWeeklyReview(session.user, parsed.data);
    return NextResponse.json({ ok: true, record }, { status: 201 });
  } catch (error) {
    if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status });
    const code = databaseErrorCode(error);
    if (code === '23503') return NextResponse.json({ error: 'A selected category, product, or owner does not exist' }, { status: 400 });
    return NextResponse.json({ error: 'The weekly review could not be saved' }, { status: 500 });
  }
}
