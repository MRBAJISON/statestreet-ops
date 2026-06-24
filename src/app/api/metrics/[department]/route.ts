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
    const period: Period = (['day', 'week', 'mtd', 'ytd', 'all'] as const).includes(p as Period)
      ? (p as Period)
      : 'mtd';
    const date = sp.get('date') || undefined;
    const store = sp.get('store') || '';
    // Executive gate: when set, sales figures come ONLY from finance-reviewed daily
    // sales. Other dashboards omit this and see everything live.
    const reviewedOnly = sp.get('reviewed') === '1';
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
    // Share of daily sales that Finance has reviewed (computed before any gating,
    // so the executive indicator reflects true progress).
    const revRows = filtered.filter((r) => r.formType === 'revenue');
    const reviewedCount = revRows.filter((r) => (r.payload as Record<string, unknown>).reviewed).length;
    const reviewedPct = revRows.length ? Math.round((reviewedCount / revRows.length) * 100) : 0;
    // Gate: drop unreviewed daily-sales rows so the executive's sales figures are
    // finance-confirmed only. Non-revenue rows (commercial insights etc.) pass through.
    const scoped = reviewedOnly
      ? filtered.filter((r) => r.formType !== 'revenue' || (r.payload as Record<string, unknown>).reviewed)
      : filtered;
    const metrics = computeMetrics(department, scoped);
    return NextResponse.json({ ...metrics, reviewedPct, reviewedCount, revenueCount: revRows.length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
