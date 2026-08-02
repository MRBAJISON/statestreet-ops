import { NextRequest, NextResponse } from 'next/server';
import { pdf } from '@react-pdf/renderer';
import { DailyStoreReportDocument } from '@/components/pdf/DailyStoreReportDocument';
import { getSession } from '@/lib/auth';
import { getDailyReportById, getDailyReportReferenceData } from '@/lib/daily-reports';
import { getOrgSettings } from '@/lib/org-server';
import { getDailyStoreReportSupplement } from '@/lib/reporting/daily-store-report';
import { HttpError } from '@/lib/server-errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DAILY_REPORT_READERS = new Set(['owner', 'finance', 'commercial', 'operations', 'store-manager']);

function parseId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
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
    const reportId = parseId((await params).id);
    if (!reportId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const report = await getDailyReportById(reportId);
    if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (session.user.role === 'store-manager' && report.storeCode !== session.user.store) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const netRevenue = report.sales.reduce(
      (sum, line) => sum + Number(line.grossRevenue) - Number(line.discounts) - Number(line.returns),
      0
    );
    const [supplement, references, org] = await Promise.all([
      getDailyStoreReportSupplement(report.storeId, report.businessDate, netRevenue, report.transactions),
      getDailyReportReferenceData(report.storeId),
      getOrgSettings(),
    ]);
    const paymentMethodNames = new Map(references.paymentMethods.map((method) => [method.id, method.name]));
    const categoryNames = new Map(references.categories.map((category) => [category.id, category.name]));

    const instance = pdf(
      DailyStoreReportDocument({ report, supplement, currency: org.currency, paymentMethodNames, categoryNames })
    );
    const buffer = await streamToBuffer(await instance.toBuffer());
    const filename = `daily-report-${report.storeCode}-${report.businessDate}.pdf`;

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
