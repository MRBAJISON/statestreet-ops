import { and, asc, eq, inArray } from 'drizzle-orm';
import type { AppUser } from './auth';
import type {
  DailyReportMutationRecord,
  DailyReportReferences,
  SaveDailyReportInput,
} from './contracts/daily-report';
import { db } from './db';
import {
  brandCategories,
  brandStores,
  categories,
  dailyPaymentLines,
  dailyReports,
  dailySalesLines,
  paymentMethods,
  stores,
} from './db/foundation-schema';
import { HttpError, sessionUserId } from './server-errors';
import {
  buildCreateDailyReportQuery,
  buildDecideDailyReportQuery,
  buildReplaceDailyReportQuery,
} from './daily-report-queries';

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
      .where(and(eq(stores.code, user.store), eq(stores.active, true)))
      .limit(1);
    if (!store) throw new HttpError(409, 'Assigned store is not available in the new store catalog');
    return store.id;
  }
  if (!requestedStoreId) throw new HttpError(400, 'storeId is required');
  const [store] = await db
    .select({ id: stores.id })
    .from(stores)
    .where(and(eq(stores.id, requestedStoreId), eq(stores.active, true)))
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
