import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { entries } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { computeMetrics, filterByPeriod, type Period } from '@/lib/metrics';

// Live aggregated metrics for a department, computed from its entries for a period.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ department: string }> }
) {
  try {
    const { department } = await params;
    const sp = req.nextUrl.searchParams;
    const p = sp.get('period');
    const period: Period = (['day', 'week', 'mtd', 'ytd', 'all'] as const).includes(p as Period)
      ? (p as Period)
      : 'mtd';
    const date = sp.get('date') || undefined;
    const rows = await db.select().from(entries).where(eq(entries.department, department));
    return NextResponse.json(computeMetrics(department, filterByPeriod(rows, period, date)));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
