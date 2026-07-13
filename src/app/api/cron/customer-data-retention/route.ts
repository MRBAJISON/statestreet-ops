import { NextRequest, NextResponse } from 'next/server';
import { redactExpiredSurveyContacts } from '@/lib/survey-retention';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Customer data retention is not configured' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const redacted = await redactExpiredSurveyContacts();
  return NextResponse.json(
    { ok: true, redacted },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
