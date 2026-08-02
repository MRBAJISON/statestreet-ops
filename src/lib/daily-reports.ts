import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { AppUser } from './auth';
import type {
  DailyReportMutationRecord,
  DailyReportReferences,
  DailyReportRecord,
  SaveDailyReportInput,
} from './contracts/daily-report';
import { db } from './db';
import {
  auditEvents,
  brandCategories,
  brands,
  brandStores,
  categories,
  dailyPaymentLines,
  dailyReportProducts,
  dailyReports,
  dailySalesLines,
  paymentMethods,
  products,
  stores,
} from './db/foundation-schema';
import { users } from './db/schema';
import { HttpError, sessionUserId } from './server-errors';
import {
  buildCreateDailyReportQuery,
  buildDecideDailyReportQuery,
  buildReplaceDailyReportQuery,
} from './daily-report-queries';

export const submittedUsers = alias(users, 'daily_reports_submitted_users');
export const createdUsers = alias(users, 'daily_reports_created_users');
export const managerNameColumn = sql<string | null>`coalesce(${submittedUsers.name}, ${createdUsers.name})`;

const DAILY_REPORT_WRITERS = new Set(['store-manager', 'finance', 'operations']);

type DailyReportMutationResult = {
  id: number | string;
  lock_version: number;
  sales_count: number;
  payment_count: number;
};

function dailyReportMutationRecord(
  row: DailyReportMutationResult,
  status: 'draft' | 'submitted'
): DailyReportMutationRecord {
  return {
    id: Number(row.id),
    lockVersion: row.lock_version,
    status,
    salesCount: row.sales_count,
    paymentCount: row.payment_count,
  };
}

async function configuredCategoryIdsForStore(storeId: number): Promise<Set<number> | null> {
  const storeBrandRows = await db
    .select({ brandId: brandStores.brandId })
    .from(brandStores)
    .where(eq(brandStores.storeId, storeId));
  if (!storeBrandRows.length) return null;

  const brandIds = storeBrandRows.map((row) => row.brandId);
  const mappings = await db
    .select({ brandId: brandCategories.brandId, categoryId: brandCategories.categoryId })
    .from(brandCategories)
    .where(inArray(brandCategories.brandId, brandIds));
  const configuredBrands = new Set(mappings.map((row) => row.brandId));

  // An incomplete brand mapping should not silently hide valid categories.
  if (brandIds.some((brandId) => !configuredBrands.has(brandId))) return null;
  return new Set(mappings.map((row) => row.categoryId));
}

export async function getDailyReportReferenceData(storeId?: number): Promise<DailyReportReferences> {
  const [categoryRows, paymentRows, storeRows, configuredCategoryIds] = await Promise.all([
    db
      .select({ id: categories.id, code: categories.code, name: categories.name })
      .from(categories)
      .where(eq(categories.active, true))
      .orderBy(asc(categories.sortOrder), asc(categories.name)),
    db
      .select({ id: paymentMethods.id, code: paymentMethods.code, name: paymentMethods.name })
      .from(paymentMethods)
      .where(eq(paymentMethods.active, true))
      .orderBy(asc(paymentMethods.sortOrder), asc(paymentMethods.name)),
    storeId
      ? db
          .select({ id: stores.id, code: stores.code, name: stores.name })
          .from(stores)
          .where(and(eq(stores.id, storeId), eq(stores.active, true)))
          .limit(1)
      : Promise.resolve([]),
    storeId ? configuredCategoryIdsForStore(storeId) : Promise.resolve(null),
  ]);

  return {
    store: storeRows[0] ?? null,
    categories: (configuredCategoryIds
      ? categoryRows.filter((category) => configuredCategoryIds.has(category.id))
      : categoryRows
    ).map((category) => ({ ...category, available: true })),
    paymentMethods: paymentRows.map((method) => ({ ...method, available: true })),
  };
}

export async function resolveDailyReportStore(user: AppUser, requestedStoreId?: number): Promise<number> {
  if (!DAILY_REPORT_WRITERS.has(user.role)) throw new HttpError(403, 'Forbidden');
  if (user.role === 'store-manager') {
    if (!user.store) throw new HttpError(403, 'No store is assigned to this account');
    const [store] = await db
      .select({ id: stores.id })
      .from(stores)
      .where(and(eq(stores.code, user.store), eq(stores.type, 'store'), eq(stores.active, true)))
      .limit(1);
    if (!store) throw new HttpError(409, 'Assigned store is not available in the new store catalog');
    return store.id;
  }
  if (!requestedStoreId) throw new HttpError(400, 'storeId is required');
  const [store] = await db
    .select({ id: stores.id })
    .from(stores)
    .where(and(eq(stores.id, requestedStoreId), eq(stores.type, 'store'), eq(stores.active, true)))
    .limit(1);
  if (!store) throw new HttpError(400, 'Store was not found or is inactive');
  return store.id;
}

export async function validateDailyReportReferences(
  input: SaveDailyReportInput,
  storeId: number,
  existing?: { categoryIds: readonly number[]; paymentMethodIds: readonly number[] }
): Promise<void> {
  const categoryIds = input.sales.map((line) => line.categoryId);
  const paymentMethodIds = input.payments.map((line) => line.paymentMethodId);
  const existingCategoryIds = new Set(existing?.categoryIds ?? []);
  const existingPaymentMethodIds = new Set(existing?.paymentMethodIds ?? []);
  const categoryIdsToValidate = categoryIds.filter((categoryId) => !existingCategoryIds.has(categoryId));
  const paymentMethodIdsToValidate = paymentMethodIds.filter(
    (paymentMethodId) => !existingPaymentMethodIds.has(paymentMethodId)
  );
  const [categoryRows, paymentRows, configuredCategoryIds] = await Promise.all([
    categoryIdsToValidate.length
      ? db
          .select({ id: categories.id })
          .from(categories)
          .where(and(inArray(categories.id, categoryIdsToValidate), eq(categories.active, true)))
      : Promise.resolve([]),
    paymentMethodIdsToValidate.length
      ? db
          .select({ id: paymentMethods.id })
          .from(paymentMethods)
          .where(and(inArray(paymentMethods.id, paymentMethodIdsToValidate), eq(paymentMethods.active, true)))
      : Promise.resolve([]),
    configuredCategoryIdsForStore(storeId),
  ]);
  if (categoryRows.length !== categoryIdsToValidate.length) {
    throw new HttpError(400, 'One or more sales categories were not found or are inactive');
  }
  if (paymentRows.length !== paymentMethodIdsToValidate.length) {
    throw new HttpError(400, 'One or more payment methods were not found or are inactive');
  }
  if (
    configuredCategoryIds &&
    categoryIdsToValidate.some((categoryId) => !configuredCategoryIds.has(categoryId))
  ) {
    throw new HttpError(400, 'One or more sales categories are not configured for this store');
  }
}

export async function createDailyReport(
  user: AppUser,
  storeId: number,
  input: SaveDailyReportInput
): Promise<DailyReportMutationRecord> {
  const userId = sessionUserId(user.id);
  const result = await db.execute(buildCreateDailyReportQuery(userId, storeId, input));
  const row = (result.rows as DailyReportMutationResult[])[0];
  if (!row) throw new Error('Daily report was not created');
  return dailyReportMutationRecord(row, input.status);
}

export async function replaceDailyReport(
  user: AppUser,
  reportId: number,
  input: SaveDailyReportInput & { lockVersion: number }
): Promise<DailyReportMutationRecord> {
  const userId = sessionUserId(user.id);
  const result = await db.execute(buildReplaceDailyReportQuery(userId, reportId, input));
  const row = (result.rows as DailyReportMutationResult[])[0];
  if (!row) throw new HttpError(409, 'Report changed, is locked, or cannot move to the requested status');
  return dailyReportMutationRecord(row, input.status);
}

export async function decideDailyReport(
  user: AppUser,
  reportId: number,
  action: 'approve' | 'reopen',
  lockVersion: number,
  reason?: string
): Promise<{ id: number | string; lock_version: number; status: string }> {
  if (user.role !== 'finance') throw new HttpError(403, 'Only Finance can approve or reopen daily reports');
  const userId = sessionUserId(user.id);
  const result = await db.execute(buildDecideDailyReportQuery(userId, reportId, action, lockVersion, reason));
  const row = (result.rows as { id: number | string; lock_version: number; status: string }[])[0];
  if (!row) throw new HttpError(409, 'Report changed or is not in the required status');
  return row;
}

export async function getDailyReportForMutation(reportId: number) {
  const [reportRows, salesRows, paymentRows] = await Promise.all([
    db.select().from(dailyReports).where(eq(dailyReports.id, reportId)).limit(1),
    db
      .select({ categoryId: dailySalesLines.categoryId })
      .from(dailySalesLines)
      .where(eq(dailySalesLines.dailyReportId, reportId)),
    db
      .select({ paymentMethodId: dailyPaymentLines.paymentMethodId })
      .from(dailyPaymentLines)
      .where(eq(dailyPaymentLines.dailyReportId, reportId)),
  ]);
  const report = reportRows[0];
  return report
    ? {
        ...report,
        categoryIds: salesRows.map((row) => row.categoryId),
        paymentMethodIds: paymentRows.map((row) => row.paymentMethodId),
      }
    : undefined;
}

export type DailyReportBaseRow = Omit<DailyReportRecord, 'sales' | 'payments' | 'activity'>;

// Shared by the list endpoint and the single-report PDF fetch: joins sales, payments,
// products, and activity for a batch of report ids, keeping one code path for both.
export async function attachDailyReportDetails(baseReports: DailyReportBaseRow[]): Promise<DailyReportRecord[]> {
  const reportIds = baseReports.map((report) => report.id);
  if (!reportIds.length) return [];

  const [sales, payments, reportProducts, activity] = await Promise.all([
    db
      .select({
        dailyReportId: dailySalesLines.dailyReportId,
        categoryId: dailySalesLines.categoryId,
        openingStock: dailySalesLines.openingStock,
        unitsSold: dailySalesLines.unitsSold,
        grossRevenue: dailySalesLines.grossRevenue,
        cogs: dailySalesLines.cogs,
        discounts: dailySalesLines.discounts,
        returns: dailySalesLines.returns,
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
    db
      .select({
        dailyReportId: dailyReportProducts.dailyReportId,
        categoryId: dailyReportProducts.categoryId,
        productId: dailyReportProducts.productId,
        customName: dailyReportProducts.customName,
        productName: products.name,
        sku: products.sku,
        brandName: brands.name,
      })
      .from(dailyReportProducts)
      .leftJoin(products, eq(dailyReportProducts.productId, products.id))
      .leftJoin(brands, eq(products.brandId, brands.id))
      .where(inArray(dailyReportProducts.dailyReportId, reportIds))
      .orderBy(asc(dailyReportProducts.id)),
    db
      .select({
        id: auditEvents.id,
        dailyReportId: auditEvents.entityId,
        action: auditEvents.action,
        actorName: users.name,
        metadata: auditEvents.metadata,
        createdAt: auditEvents.createdAt,
      })
      .from(auditEvents)
      .leftJoin(users, eq(auditEvents.actorUserId, users.id))
      .where(and(eq(auditEvents.entityType, 'daily-report'), inArray(auditEvents.entityId, reportIds)))
      .orderBy(desc(auditEvents.createdAt)),
  ]);

  const salesByReport = new Map<number, typeof sales>();
  const paymentsByReport = new Map<number, typeof payments>();
  const productsByReportCategory = new Map<string, typeof reportProducts>();
  const activityByReport = new Map<number, typeof activity>();
  for (const line of sales) salesByReport.set(line.dailyReportId, [...(salesByReport.get(line.dailyReportId) ?? []), line]);
  for (const line of payments) {
    paymentsByReport.set(line.dailyReportId, [...(paymentsByReport.get(line.dailyReportId) ?? []), line]);
  }
  for (const line of reportProducts) {
    const key = `${line.dailyReportId}:${line.categoryId}`;
    productsByReportCategory.set(key, [...(productsByReportCategory.get(key) ?? []), line]);
  }
  for (const event of activity) {
    activityByReport.set(event.dailyReportId, [...(activityByReport.get(event.dailyReportId) ?? []), event]);
  }

  return baseReports.map((report) => ({
    ...report,
    sales: (salesByReport.get(report.id) ?? []).map((line) => ({
      ...line,
      products: (productsByReportCategory.get(`${report.id}:${line.categoryId}`) ?? []).map((item) => ({
        productId: item.productId,
        productName: item.productName ?? item.customName ?? '',
        sku: item.sku,
        brandName: item.brandName,
      })),
    })),
    payments: paymentsByReport.get(report.id) ?? [],
    activity: (activityByReport.get(report.id) ?? []).map((event) => ({
      id: event.id,
      action: event.action,
      actorName: event.actorName,
      reason: typeof event.metadata?.reason === 'string' ? event.metadata.reason : null,
      createdAt: event.createdAt.toISOString(),
    })),
  }));
}

export async function getDailyReportById(reportId: number): Promise<DailyReportRecord | null> {
  const baseReports = await db
    .select({
      id: dailyReports.id,
      storeId: dailyReports.storeId,
      storeCode: stores.code,
      storeName: stores.name,
      managerName: managerNameColumn,
      businessDate: dailyReports.businessDate,
      status: dailyReports.status,
      transactions: dailyReports.transactions,
      footfall: dailyReports.footfall,
      totalCustomers: dailyReports.totalCustomers,
      newCustomers: dailyReports.newCustomers,
      returningCustomers: dailyReports.returningCustomers,
      notes: dailyReports.notes,
      staffPerformanceNote: dailyReports.staffPerformanceNote,
      closingFacilityStatus: dailyReports.closingFacilityStatus,
      lockVersion: dailyReports.lockVersion,
      submittedAt: dailyReports.submittedAt,
      approvedAt: dailyReports.approvedAt,
      updatedAt: dailyReports.updatedAt,
    })
    .from(dailyReports)
    .innerJoin(stores, eq(dailyReports.storeId, stores.id))
    .leftJoin(submittedUsers, eq(dailyReports.submittedByUserId, submittedUsers.id))
    .leftJoin(createdUsers, eq(dailyReports.createdByUserId, createdUsers.id))
    .where(eq(dailyReports.id, reportId))
    .limit(1);
  if (!baseReports.length) return null;
  const [full] = await attachDailyReportDetails(baseReports as unknown as DailyReportBaseRow[]);
  return full ?? null;
}
