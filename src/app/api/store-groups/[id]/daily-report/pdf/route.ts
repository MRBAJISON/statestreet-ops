import { NextRequest, NextResponse } from 'next/server';
import { pdf } from '@react-pdf/renderer';
import { and, eq } from 'drizzle-orm';
import { StoreGroupDailyReportDocument } from '@/components/pdf/StoreGroupDailyReportDocument';
import { getSession } from '@/lib/auth';
import { getDailyReportReferenceData } from '@/lib/daily-reports';
import { db } from '@/lib/db';
import { storeGroups } from '@/lib/db/foundation-schema';
import { getOrgSettings } from '@/lib/org-server';
import { getStoreGroupDailyReport } from '@/lib/reporting/store-group-daily-report';
import { HttpError } from '@/lib/server-errors';
import { accessibleStores, storesInGroup } from '@/lib/store-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DAILY_REPORT_READERS = new Set(['owner', 'finance', 'commercial', 'operations', 'store-manager']);

function parseId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
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
    if (!DAILY_REPORT_READERS.has(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const groupId = parseId((await params).id);
    if (!groupId) return NextResponse.json({ error: 'Invalid group id' }, { status: 400 });

    const businessDate = parseDate(req.nextUrl.searchParams.get('date'));
    if (!businessDate) return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 });

    const [group] = await db
      .select({ id: storeGroups.id, code: storeGroups.code, name: storeGroups.name })
      .from(storeGroups)
      .where(and(eq(storeGroups.id, groupId), eq(storeGroups.active, true)))
      .limit(1);
    if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // A combined total is only honest when the reader can open every store in it.
    if (session.user.role === 'store-manager') {
      const [members, allowed] = await Promise.all([
        storesInGroup(groupId),
        accessibleStores(session.user).then((stores) => stores.map((store) => store.id)),
      ]);
      if (!members.length || !members.every((storeId) => allowed.includes(storeId))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const report = await getStoreGroupDailyReport(group, businessDate);
    if (!report) return NextResponse.json({ error: 'No reports were filed for this day' }, { status: 404 });
    // Same rule as the single-store daily PDF: a draft is still being worked on,
    // and here a store that has not filed would silently halve the combined total.
    if (!report.ready) {
      const outstanding = report.outstanding
        .map((store) => `${store.storeName} (${store.reason === 'draft' ? 'still a draft' : 'not filed'})`)
        .join(', ');
      return NextResponse.json(
        { error: `Both stores must submit this day first. Outstanding: ${outstanding}`, outstanding: report.outstanding },
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
      StoreGroupDailyReportDocument({ report, currency: org.currency, paymentMethodNames, categoryNames })
    );
    const buffer = await streamToBuffer(await instance.toBuffer());
    const filename = `daily-cluster-report-${group.code}-${businessDate}.pdf`;

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
