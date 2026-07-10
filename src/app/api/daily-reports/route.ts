import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { saveDailyReportSchema } from '@/lib/contracts/daily-report';
import { dateSchema, formatContractError } from '@/lib/contracts/shared';
import { createDailyReport, resolveDailyReportStore, validateDailyReportReferences } from '@/lib/daily-reports';
import { db } from '@/lib/db';
import {
  dailyPaymentLines,
  dailyReports,
  dailySalesLines,
  stores,
} from '@/lib/db/foundation-schema';
import { databaseErrorCode, HttpError } from '@/lib/server-errors';

const DAILY_REPORT_READERS = new Set(['owner', 'finance', 'commercial', 'operations', 'store-manager']);

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => null);
    const parsed = saveDailyReportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: formatContractError(parsed.error) }, { status: 400 });
    }
    const storeId = await resolveDailyReportStore(session.user, parsed.data.storeId);
    await validateDailyReportReferences(parsed.data, storeId);
    const report = await createDailyReport(session.user, storeId, parsed.data);
    return NextResponse.json({ ok: true, report }, { status: 201 });
  } catch (error) {
    if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (databaseErrorCode(error) === '23505') {
      return NextResponse.json({ error: 'A daily report already exists for this store and date' }, { status: 409 });
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!DAILY_REPORT_READERS.has(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const sp = req.nextUrl.searchParams;
    const from = sp.get('from');
    const to = sp.get('to');
    if (from && !dateSchema.safeParse(from).success) {
      return NextResponse.json({ error: 'from must be a valid YYYY-MM-DD date' }, { status: 400 });
    }
    if (to && !dateSchema.safeParse(to).success) {
      return NextResponse.json({ error: 'to must be a valid YYYY-MM-DD date' }, { status: 400 });
    }
    const storeIdParam = sp.get('storeId');
    const requestedStoreId = Number(storeIdParam ?? 0);
    if (storeIdParam && (!Number.isInteger(requestedStoreId) || requestedStoreId <= 0)) {
      return NextResponse.json({ error: 'storeId must be a positive integer' }, { status: 400 });
    }
    if (from && to && from > to) {
      return NextResponse.json({ error: 'from cannot be after to' }, { status: 400 });
    }
    let storeId = storeIdParam ? requestedStoreId : undefined;
    if (session.user.role === 'store-manager') {
      storeId = await resolveDailyReportStore(session.user);
    }
    const status = sp.get('status');
    if (status && !['draft', 'submitted', 'approved'].includes(status)) {
      return NextResponse.json({ error: 'Unknown report status' }, { status: 400 });
    }
    const conditions = [];
    if (storeId) conditions.push(eq(dailyReports.storeId, storeId));
    if (from) conditions.push(gte(dailyReports.businessDate, from));
    if (to) conditions.push(lte(dailyReports.businessDate, to));
    if (status) conditions.push(eq(dailyReports.status, status));
    const reports = await db
      .select({
        id: dailyReports.id,
        storeId: dailyReports.storeId,
        storeCode: stores.code,
        storeName: stores.name,
        businessDate: dailyReports.businessDate,
        status: dailyReports.status,
        transactions: dailyReports.transactions,
        footfall: dailyReports.footfall,
        totalCustomers: dailyReports.totalCustomers,
        newCustomers: dailyReports.newCustomers,
        returningCustomers: dailyReports.returningCustomers,
        notes: dailyReports.notes,
        lockVersion: dailyReports.lockVersion,
        submittedAt: dailyReports.submittedAt,
        approvedAt: dailyReports.approvedAt,
        updatedAt: dailyReports.updatedAt,
      })
      .from(dailyReports)
      .innerJoin(stores, eq(dailyReports.storeId, stores.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(dailyReports.businessDate), desc(dailyReports.updatedAt))
      .limit(366);
    const reportIds = reports.map((report) => report.id);
    const [sales, payments] = reportIds.length
      ? await Promise.all([
          db.select().from(dailySalesLines).where(inArray(dailySalesLines.dailyReportId, reportIds)),
          db.select().from(dailyPaymentLines).where(inArray(dailyPaymentLines.dailyReportId, reportIds)),
        ])
      : [[], []];
    const salesByReport = new Map<number, typeof sales>();
    const paymentsByReport = new Map<number, typeof payments>();
    for (const line of sales) salesByReport.set(line.dailyReportId, [...(salesByReport.get(line.dailyReportId) ?? []), line]);
    for (const line of payments) {
      paymentsByReport.set(line.dailyReportId, [...(paymentsByReport.get(line.dailyReportId) ?? []), line]);
    }
    return NextResponse.json({
      reports: reports.map((report) => ({
        ...report,
        sales: salesByReport.get(report.id) ?? [],
        payments: paymentsByReport.get(report.id) ?? [],
      })),
    });
  } catch (error) {
    if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
