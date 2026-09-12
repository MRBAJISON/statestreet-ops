import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { dateSchema } from '@/lib/contracts/shared';
import { resolveActingStore } from '@/lib/store-access';
import { getStorePeriodReport } from '@/lib/reporting/store-period-report';
import { getProductPerformance } from '@/lib/reporting/product-performance';
import { resolveStorePeriod } from '@/lib/reporting/store-period';
import { HttpError } from '@/lib/server-errors';
import { getOrgSettings } from '@/lib/org-server';
import { getDailyReportReferenceData } from '@/lib/daily-reports';
export const runtime = 'nodejs';
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'store-manager')
      throw new HttpError(403, 'Forbidden');
    const date = dateSchema.parse(req.nextUrl.searchParams.get('weekEnd'));
    const store = await resolveActingStore(session.user),
      range = resolveStorePeriod('week', date).range;
    const [report, performance, org, references] = await Promise.all([
      getStorePeriodReport(store.id, 'week', date),
      getProductPerformance([store.id], range.from, range.to),
      getOrgSettings(),
      getDailyReportReferenceData(store.id),
    ]);
    return NextResponse.json(
      {
        report,
        performance,
        categories: references.categories.map((c) => ({
          id: c.id,
          name: c.name,
        })),
        currency: org.currency,
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof HttpError
            ? error.message
            : 'Weekly evidence could not be loaded',
      },
      { status: error instanceof HttpError ? error.status : 400 }
    );
  }
}
