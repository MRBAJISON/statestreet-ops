import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { entries } from '@/lib/db/schema';
import { and, eq, or } from 'drizzle-orm';
import { computeMetrics, filterByPeriod, filterByStore, previousAnchor, type Period, type MetricLabels } from '@/lib/metrics';
import { getSession } from '@/lib/auth';
import { getOrgSettings } from '@/lib/org-server';
import { toLabelMap } from '@/lib/org';
import { canAccessDepartment, isDepartment } from '@/lib/access';
import { isLegacyDepartment } from '@/lib/entry-permissions';

// Live aggregated metrics for a department, computed from its entries for a period.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ department: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { department } = await params;
    if (!isDepartment(department) || !isLegacyDepartment(department)) {
      return NextResponse.json({ error: 'Unknown department' }, { status: 404 });
    }
    if (!canAccessDepartment(session.user.role, department)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const sp = req.nextUrl.searchParams;
    const p = sp.get('period');
    const period: Period = (['day', 'week', 'mtd', 'ytd', 'all', 'custom'] as const).includes(p as Period)
      ? (p as Period)
      : 'mtd';
    const date = sp.get('date') || undefined;
    const requestedStore = sp.get('store') || '';
    if (session.user.role === 'store-manager' && !session.user.store) {
      return NextResponse.json({ error: 'No store is assigned to this account' }, { status: 403 });
    }
    const store = session.user.role === 'store-manager' ? session.user.store ?? '' : requestedStore;
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
    // Live label maps from org settings so renamed/added stores, brands, categories
    // and expense items are reflected in the dashboard metrics (not the static defaults).
    const org = await getOrgSettings();
    const labels: MetricLabels = {
      store: toLabelMap(org.stores),
      brand: toLabelMap(org.brands),
      category: toLabelMap(org.categories),
      expense: toLabelMap(org.expenseItems),
    };
    const filtered = filterByStore(filterByPeriod(rows, period, date), store);
    const result = computeMetrics(department, filtered, labels) as Record<string, unknown>;
    // Attach the prior period's metrics for "vs last period" deltas on the dashboards.
    const prevA = previousAnchor(period, date);
    if (prevA !== null) {
      const prevFiltered = filterByStore(filterByPeriod(rows, period, prevA), store);
      result.prev = computeMetrics(department, prevFiltered, labels);
    }
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
