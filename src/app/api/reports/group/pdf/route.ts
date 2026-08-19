import { NextRequest, NextResponse } from 'next/server';
import { pdf } from '@react-pdf/renderer';
import { StoreGroupDailyReportDocument } from '@/components/pdf/StoreGroupDailyReportDocument';
import { StoreGroupPeriodReportDocument } from '@/components/pdf/StoreGroupPeriodReportDocument';
import { getSession } from '@/lib/auth';
import { getDailyReportReferenceData } from '@/lib/daily-reports';
import { getOrgSettings } from '@/lib/org-server';
import { getStoreGroupDailyReport } from '@/lib/reporting/store-group-daily-report';
import { getStoreGroupPeriodReport } from '@/lib/reporting/store-group-period-report';
import type { StorePeriodType } from '@/lib/reporting/store-period-report';
import { HttpError } from '@/lib/server-errors';
import { allTradingStores } from '@/lib/store-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The whole business combined, in the same shape as a cluster report: group
// totals with a per-store split. Deliberately not offered to a store manager —
// they read their own shop, and a group total is not theirs to take.
const GROUP_REPORT_READERS = new Set(['owner', 'finance', 'commercial', 'operations']);

// Not a store_groups row: this is every store rather than a trading unit, so it
// carries a label instead of an identity.
const GROUP_WIDE = { id: 0, code: 'all-stores', name: 'All Stores' };

function parsePeriod(value: string | null): StorePeriodType | 'day' | null {
  if (value === 'day' || value === 'week' || value === 'month') return value;
  return null;
}

function parseDate(value: string | null): string | null {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) ? value : null;
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!GROUP_REPORT_READERS.has(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const period = parsePeriod(req.nextUrl.searchParams.get('period'));
    if (!period) return NextResponse.json({ error: 'period must be day, week or month' }, { status: 400 });

    const date = parseDate(req.nextUrl.searchParams.get('date'));
    if (!date) return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 });

    const stores = await allTradingStores();
    if (!stores.length) return NextResponse.json({ error: 'There are no active stores' }, { status: 404 });
    const storeIds = stores.map((store) => store.id);

    const [org] = await Promise.all([getOrgSettings()]);
    const references = await getDailyReportReferenceData(storeIds[0]);
    const paymentMethodNames = new Map(references.paymentMethods.map((method) => [method.id, method.name]));
    const categoryNames = new Map(references.categories.map((category) => [category.id, category.name]));

    let element;
    let filename: string;

    if (period === 'day') {
      const report = await getStoreGroupDailyReport(GROUP_WIDE, date, storeIds);
      if (!report) return NextResponse.json({ error: 'No reports were filed for this day' }, { status: 404 });
      if (!report.ready) {
        const outstanding = report.outstanding
          .map((store) => `${store.storeName} (${store.reason === 'draft' ? 'still a draft' : 'not filed'})`)
          .join(', ');
        return NextResponse.json(
          { error: `Every store must submit this day first. Outstanding: ${outstanding}`, outstanding: report.outstanding },
          { status: 409 }
        );
      }
      element = StoreGroupDailyReportDocument({ report, currency: org.currency, paymentMethodNames, categoryNames });
      filename = `group-daily-report-${date}.pdf`;
    } else {
      const report = await getStoreGroupPeriodReport(GROUP_WIDE, period, date, storeIds);
      if (!report) return NextResponse.json({ error: 'No reports were filed for this period' }, { status: 404 });
      if (!report.ready) {
        const outstanding = report.outstanding.map((day) => `${day.storeName} ${day.date}`).join(', ');
        return NextResponse.json(
          { error: `Every store must submit every day first. Outstanding: ${outstanding}`, outstanding: report.outstanding },
          { status: 409 }
        );
      }
      element = StoreGroupPeriodReportDocument({ report, currency: org.currency, paymentMethodNames, categoryNames });
      filename = `group-${period}-report-${report.range.from}.pdf`;
    }

    const buffer = await streamToBuffer(await pdf(element).toBuffer());

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
