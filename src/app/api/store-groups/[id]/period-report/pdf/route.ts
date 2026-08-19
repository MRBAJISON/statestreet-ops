import { NextRequest, NextResponse } from 'next/server';
import { pdf } from '@react-pdf/renderer';
import { and, eq } from 'drizzle-orm';
import { StoreGroupPeriodReportDocument } from '@/components/pdf/StoreGroupPeriodReportDocument';
import { getSession } from '@/lib/auth';
import { getDailyReportReferenceData } from '@/lib/daily-reports';
import { db } from '@/lib/db';
import { storeGroups } from '@/lib/db/foundation-schema';
import { getOrgSettings } from '@/lib/org-server';
import { getStoreGroupPeriodReport } from '@/lib/reporting/store-group-period-report';
import type { StorePeriodType } from '@/lib/reporting/store-period-report';
import { HttpError } from '@/lib/server-errors';
import { accessibleStores, storesInGroup } from '@/lib/store-access';

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

    const groupId = parseId((await params).id);
    if (!groupId) return NextResponse.json({ error: 'Invalid group id' }, { status: 400 });

    const periodType = parsePeriod(req.nextUrl.searchParams.get('period'));
    if (!periodType) return NextResponse.json({ error: 'period must be week or month' }, { status: 400 });

    const anchor = parseDate(req.nextUrl.searchParams.get('date'));
    if (!anchor) return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 });

    const [group] = await db
      .select({ id: storeGroups.id, code: storeGroups.code, name: storeGroups.name })
      .from(storeGroups)
      .where(and(eq(storeGroups.id, groupId), eq(storeGroups.active, true)))
      .limit(1);
    if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // A combined total is only honest when the reader can open every store in it,
    // so a manager covering one shop of a pair gets their own report, not a group
    // figure half of which is closed to them.
    if (session.user.role === 'store-manager') {
      const [members, allowed] = await Promise.all([
        storesInGroup(groupId),
        accessibleStores(session.user).then((stores) => stores.map((store) => store.id)),
      ]);
      if (!members.length || !members.every((storeId) => allowed.includes(storeId))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const report = await getStoreGroupPeriodReport(group, periodType, anchor);
    if (!report) {
      return NextResponse.json({ error: 'No reports were filed for this period' }, { status: 404 });
    }
    // The period is only a report once every trading day of every member is in.
    if (!report.ready) {
      const outstanding = report.outstanding
        .map((day) => `${day.storeName} ${day.date}`)
        .join(', ');
      return NextResponse.json(
        { error: `Submit every day for both stores first. Outstanding: ${outstanding}`, outstanding: report.outstanding },
        { status: 409 }
      );
    }

    const [references, org] = await Promise.all([
      getDailyReportReferenceData(report.stores[0]?.storeId),
      getOrgSettings(),
    ]);
    const paymentMethodNames = new Map(references.paymentMethods.map((method) => [method.id, method.name]));
    const categoryNames = new Map(references.categories.map((category) => [category.id, category.name]));

    const instance = pdf(
      StoreGroupPeriodReportDocument({ report, currency: org.currency, paymentMethodNames, categoryNames })
    );
    const buffer = await streamToBuffer(await instance.toBuffer());
    const filename = `${periodType}-cluster-report-${group.code}-${report.range.from}.pdf`;

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
