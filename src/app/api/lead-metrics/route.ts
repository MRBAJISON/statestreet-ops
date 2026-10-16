import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { listLeadMetrics, updateLeadMetric } from '@/lib/lead-metrics';
import { HttpError } from '@/lib/server-errors';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const page = Number(req.nextUrl.searchParams.get('page') ?? 1);
    if (!Number.isSafeInteger(page) || page < 1 || page > 100000) throw new HttpError(400, 'Invalid page');
    return NextResponse.json(await listLeadMetrics(session.user, page), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof HttpError ? error.message : 'Summaries could not be loaded' }, { status: error instanceof HttpError ? error.status : 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const id = Number(req.nextUrl.searchParams.get('id'));
    if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(400, 'Invalid summary');
    const record = await updateLeadMetric(session.user, id, await req.json().catch(() => null));
    return NextResponse.json({ ok: true, record });
  } catch (error) {
    return NextResponse.json({ error: error instanceof HttpError ? error.message : 'Summary could not be saved' }, { status: error instanceof HttpError ? error.status : 500 });
  }
}
