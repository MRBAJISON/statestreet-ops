import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { entries } from '@/lib/db/schema';
import { and, eq, or } from 'drizzle-orm';
import { computeMetrics, filterByPeriod, filterByStore, type Period } from '@/lib/metrics';
import { getSession } from '@/lib/auth';

// Live aggregated metrics for a department, computed from its entries for a period.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ department: string }> }
) {
  try {
    if (!(await getSession())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { department } = await params;
    const sp = req.nextUrl.searchParams;
    const p = sp.get('period');
    const period: Period = (['day', 'week', 'mtd', 'ytd', 'all', 'custom'] as const).includes(p as Period)
      ? (p as Period)
      : 'mtd';
    const date = sp.get('date') || undefined;
    const store = sp.get('store') || '';
    // Commercial sales views are driven by the stores' Daily Sales (finance/revenue);
    // its New Arrivals & Deployment come from inventory goods-receipt + store-transfer.
    // Load all of those alongside the commercial rows.
    const where = department === 'commercial'
      ? or(
          eq(entries.department, 'commercial'),
          and(eq(entries.department, 'finance'), eq(entries.formType, 'revenue')),
          and(eq(entries.department, 'inventory'), or(eq(entries.formType, 'goods-receipt'), eq(entries.formType, 'store-transfer'))),
        )
      : eq(entries.department, department);
    const rows = await db.select().from(entries).where(where);
    const filtered = filterByStore(filterByPeriod(rows, period, date), store);
    return NextResponse.json(computeMetrics(department, filtered));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
