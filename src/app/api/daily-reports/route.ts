import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { saveDailyReportSchema } from '@/lib/contracts/daily-report';
import { dateSchema, formatContractError } from '@/lib/contracts/shared';
import {
  createDailyReport,
  getDailyReportReferenceData,
  resolveDailyReportStore,
  validateDailyReportReferences,
} from '@/lib/daily-reports';
import { db } from '@/lib/db';
import {
  categories,
  dailyPaymentLines,
  dailyReports,
  dailySalesLines,
  paymentMethods,
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
    const [reports, references] = await Promise.all([
      db
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
        .limit(366),
      getDailyReportReferenceData(storeId),
    ]);
    const reportIds = reports.map((report) => report.id);
    const [sales, payments] = reportIds.length
      ? await Promise.all([
          db
            .select({
              dailyReportId: dailySalesLines.dailyReportId,
              categoryId: dailySalesLines.categoryId,
              openingStock: dailySalesLines.openingStock,
              unitsSold: dailySalesLines.unitsSold,
              grossRevenue: dailySalesLines.grossRevenue,
              cogs: dailySalesLines.cogs,
              discounts: dailySalesLines.discounts,
              creditSales: dailySalesLines.creditSales,
            })
            .from(dailySalesLines)
            .where(inArray(dailySalesLines.dailyReportId, reportIds)),
          db
            .select({
              dailyReportId: dailyPaymentLines.dailyReportId,
              paymentMethodId: dailyPaymentLines.paymentMethodId,
              amount: dailyPaymentLines.amount,
            })
            .from(dailyPaymentLines)
            .where(inArray(dailyPaymentLines.dailyReportId, reportIds)),
        ])
      : [[], []];
    const salesByReport = new Map<number, typeof sales>();
    const paymentsByReport = new Map<number, typeof payments>();
    for (const line of sales) salesByReport.set(line.dailyReportId, [...(salesByReport.get(line.dailyReportId) ?? []), line]);
    for (const line of payments) {
      paymentsByReport.set(line.dailyReportId, [...(paymentsByReport.get(line.dailyReportId) ?? []), line]);
    }
    const knownCategoryIds = new Set(references.categories.map((category) => category.id));
    const knownPaymentMethodIds = new Set(references.paymentMethods.map((method) => method.id));
    const historicalCategoryIds = [
      ...new Set(sales.map((line) => line.categoryId).filter((categoryId) => !knownCategoryIds.has(categoryId))),
    ];
    const historicalPaymentMethodIds = [
      ...new Set(
        payments
          .map((line) => line.paymentMethodId)
          .filter((paymentMethodId) => !knownPaymentMethodIds.has(paymentMethodId))
      ),
    ];
    const [historicalCategories, historicalPaymentMethods] = await Promise.all([
      historicalCategoryIds.length
        ? db
            .select({ id: categories.id, code: categories.code, name: categories.name })
            .from(categories)
            .where(inArray(categories.id, historicalCategoryIds))
        : Promise.resolve([]),
      historicalPaymentMethodIds.length
        ? db
            .select({ id: paymentMethods.id, code: paymentMethods.code, name: paymentMethods.name })
            .from(paymentMethods)
            .where(inArray(paymentMethods.id, historicalPaymentMethodIds))
        : Promise.resolve([]),
    ]);
    return NextResponse.json({
      references: {
        ...references,
        categories: [
          ...references.categories,
          ...historicalCategories.map((category) => ({ ...category, available: false })),
        ],
        paymentMethods: [
          ...references.paymentMethods,
          ...historicalPaymentMethods.map((method) => ({ ...method, available: false })),
        ],
      },
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
