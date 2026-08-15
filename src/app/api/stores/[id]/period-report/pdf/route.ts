import { NextRequest, NextResponse } from 'next/server';
import { pdf } from '@react-pdf/renderer';
import { eq } from 'drizzle-orm';
import { StorePeriodReportDocument } from '@/components/pdf/StorePeriodReportDocument';
import { getSession } from '@/lib/auth';
import { getDailyReportReferenceData } from '@/lib/daily-reports';
import { db } from '@/lib/db';
import { stores } from '@/lib/db/foundation-schema';
import { getOrgSettings } from '@/lib/org-server';
import { getStorePeriodReport, type StorePeriodType } from '@/lib/reporting/store-period-report';
import { HttpError } from '@/lib/server-errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PERIOD_REPORT_READERS = new Set(['owner', 'finance', 'commercial', 'operations', 'store-manager']);

function parseId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parsePeriod(value: string | null): StorePeriodType | null {
  return value === 'week' || value === 'month' ? value : null;
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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!PERIOD_REPORT_READERS.has(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const storeId = parseId((await params).id);
    if (!storeId) return NextResponse.json({ error: 'Invalid store id' }, { status: 400 });

    const periodType = parsePeriod(req.nextUrl.searchParams.get('period'));
    if (!periodType) return NextResponse.json({ error: 'period must be week or month' }, { status: 400 });

    const anchor = parseDate(req.nextUrl.searchParams.get('date'));
    if (!anchor) return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 });

    const [store] = await db
      .select({ id: stores.id, code: stores.code, name: stores.name })
      .from(stores)
      .where(eq(stores.id, storeId))
      .limit(1);
    if (!store) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    // Store managers only ever see their own store, same rule as the daily report.
    if (session.user.role === 'store-manager' && store.code !== session.user.store) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const report = await getStorePeriodReport(storeId, periodType, anchor);
    if (!report) {
      return NextResponse.json({ error: 'No reports were filed for this period' }, { status: 404 });
    }
    // The period is only a report once every trading day in it has been submitted.
    if (!report.ready) {
      const dates = report.outstanding.map((day) => day.date).join(', ');
      return NextResponse.json(
        { error: `Submit every day in this period first. Outstanding: ${dates}`, outstanding: report.outstanding },
        { status: 409 }
      );
    }

    const [references, org] = await Promise.all([getDailyReportReferenceData(storeId), getOrgSettings()]);
    const paymentMethodNames = new Map(references.paymentMethods.map((method) => [method.id, method.name]));
    const categoryNames = new Map(references.categories.map((category) => [category.id, category.name]));

    const instance = pdf(
      StorePeriodReportDocument({ report, currency: org.currency, paymentMethodNames, categoryNames })
    );
    const buffer = await streamToBuffer(await instance.toBuffer());
    const filename = `${periodType}-report-${store.code}-${report.range.from}.pdf`;

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
