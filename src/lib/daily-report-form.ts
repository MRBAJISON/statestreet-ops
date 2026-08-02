import {
  saveDailyReportSchema,
  type DailyReportMutationRecord,
  type DailyReportRecord,
  type DailyReportReferences,
  type DailyReportsResponse,
  type SaveDailyReportInput,
} from './contracts/daily-report';
import { formatContractError } from './contracts/shared';

export interface DailySalesDraftRow {
  categoryId: number;
  openingStock: string;
  unitsSold: string;
  grossRevenue: string;
  cogs: string;
  discounts: string;
  returns: string;
  creditSales: string;
  productNames: string;
}

export interface DailyPaymentDraftRow {
  paymentMethodId: number;
  amount: string;
}

export interface DailyReportDraft {
  businessDate: string;
  transactions: string;
  footfall: string;
  totalCustomers: string;
  newCustomers: string;
  returningCustomers: string;
  notes: string;
  staffPerformanceNote: string;
  closingFacilityStatus: string;
  sales: DailySalesDraftRow[];
  payments: DailyPaymentDraftRow[];
}

const emptySalesRow = (categoryId: number): DailySalesDraftRow => ({
  categoryId,
  openingStock: '',
  unitsSold: '',
  grossRevenue: '',
  cogs: '',
  discounts: '',
  returns: '',
  creditSales: '',
  productNames: '',
});

const countValue = (value: number | undefined) => (value === undefined ? '' : String(value));

export function createDailyReportDraft(
  businessDate: string,
  references: DailyReportReferences,
  report?: DailyReportRecord
): DailyReportDraft {
  const existingSales = new Map(report?.sales.map((line) => [line.categoryId, line]) ?? []);
  const categoryIds = references.categories.filter((category) => category.available).map((category) => category.id);
  for (const categoryId of existingSales.keys()) {
    if (!categoryIds.includes(categoryId)) categoryIds.push(categoryId);
  }
  const existingPayments = new Map(report?.payments.map((line) => [line.paymentMethodId, line]) ?? []);
  const paymentMethodIds = references.paymentMethods.filter((method) => method.available).map((method) => method.id);
  for (const paymentMethodId of existingPayments.keys()) {
    if (!paymentMethodIds.includes(paymentMethodId)) paymentMethodIds.push(paymentMethodId);
  }

  return {
    businessDate,
    transactions: countValue(report?.transactions),
    footfall: countValue(report?.footfall),
    totalCustomers: countValue(report?.totalCustomers),
    newCustomers: countValue(report?.newCustomers),
    returningCustomers: countValue(report?.returningCustomers),
    notes: report?.notes ?? '',
    staffPerformanceNote: report?.staffPerformanceNote ?? '',
    closingFacilityStatus: report?.closingFacilityStatus ?? '',
    sales: categoryIds.map((categoryId) => {
      const line = existingSales.get(categoryId);
      return line
        ? {
            categoryId,
            openingStock: String(line.openingStock),
            unitsSold: String(line.unitsSold),
            grossRevenue: line.grossRevenue,
            cogs: line.cogs,
            discounts: line.discounts,
            returns: line.returns,
            creditSales: line.creditSales,
            productNames: line.products.map((item) => item.productName).join('\n'),
          }
        : emptySalesRow(categoryId);
    }),
    payments: paymentMethodIds.map((paymentMethodId) => ({
      paymentMethodId,
      amount: existingPayments.get(paymentMethodId)?.amount ?? '',
    })),
  };
}

const parseProductNames = (value: string) =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');

const salesRowHasValue = (row: DailySalesDraftRow) =>
  parseProductNames(row.productNames).length > 0 ||
  [row.openingStock, row.unitsSold, row.grossRevenue, row.cogs, row.discounts, row.returns, row.creditSales].some(
    (value) => value.trim() !== ''
  );

export function buildDailyReportInput(
  draft: DailyReportDraft,
  status: 'draft' | 'submitted',
  lockVersion?: number
): SaveDailyReportInput {
  const parsed = saveDailyReportSchema.safeParse({
    businessDate: draft.businessDate,
    status,
    transactions: Number(draft.transactions || 0),
    footfall: Number(draft.footfall || 0),
    totalCustomers: Number(draft.totalCustomers || 0),
    newCustomers: Number(draft.newCustomers || 0),
    returningCustomers: Number(draft.returningCustomers || 0),
    notes: draft.notes.trim() || null,
    staffPerformanceNote: draft.staffPerformanceNote.trim() || null,
    closingFacilityStatus: draft.closingFacilityStatus.trim() || null,
    lockVersion,
    sales: draft.sales.filter(salesRowHasValue).map((row) => ({
      categoryId: row.categoryId,
      openingStock: Number(row.openingStock || 0),
      unitsSold: Number(row.unitsSold || 0),
      grossRevenue: row.grossRevenue.trim() || '0',
      cogs: row.cogs.trim() || '0',
      discounts: row.discounts.trim() || '0',
      returns: row.returns.trim() || '0',
      creditSales: row.creditSales.trim() || '0',
      products: parseProductNames(row.productNames).map((customName) => ({ customName })),
    })),
    payments: draft.payments
      .filter((row) => row.amount.trim() !== '')
      .map((row) => ({ paymentMethodId: row.paymentMethodId, amount: row.amount.trim() })),
  });
  if (!parsed.success) throw new Error(formatContractError(parsed.error));
  return parsed.data;
}

export function createSavedDailyReportRecord(
  input: SaveDailyReportInput,
  mutation: DailyReportMutationRecord,
  references: DailyReportReferences,
  existing?: DailyReportRecord,
  savedAt = new Date().toISOString()
): DailyReportRecord {
  const store = references.store ??
    (existing
      ? { id: existing.storeId, code: existing.storeCode, name: existing.storeName }
      : null);
  if (!store) throw new Error('The saved report store is unavailable');

  return {
    id: mutation.id,
    storeId: store.id,
    storeCode: store.code,
    storeName: store.name,
    managerName: existing?.managerName ?? null,
    businessDate: input.businessDate,
    status: mutation.status,
    transactions: input.transactions,
    footfall: input.footfall,
    totalCustomers: input.totalCustomers,
    newCustomers: input.newCustomers,
    returningCustomers: input.returningCustomers,
    notes: input.notes ?? null,
    staffPerformanceNote: input.staffPerformanceNote ?? null,
    closingFacilityStatus: input.closingFacilityStatus ?? null,
    lockVersion: mutation.lockVersion,
    submittedAt:
      mutation.status === 'submitted' ? existing?.submittedAt ?? savedAt : null,
    approvedAt: null,
    updatedAt: savedAt,
    sales: input.sales.map((line) => ({
      ...line,
      products: line.products.map((item) => ({
        productId: item.productId ?? null,
        productName: item.customName ?? '',
        sku: null,
        brandName: null,
      })),
    })),
    payments: input.payments.map((line) => ({ ...line })),
    activity: existing?.activity ?? [],
  };
}

export function upsertDailyReport(
  reports: readonly DailyReportRecord[],
  saved: DailyReportRecord
): DailyReportRecord[] {
  return [
    saved,
    ...reports.filter(
      (report) =>
        report.id !== saved.id &&
        (report.storeId !== saved.storeId || report.businessDate !== saved.businessDate)
    ),
  ].sort(
    (left, right) =>
      right.businessDate.localeCompare(left.businessDate) ||
      right.updatedAt.localeCompare(left.updatedAt)
  );
}

function mergeDailyReportOptions(
  primary: DailyReportReferences['categories'],
  secondary: DailyReportReferences['categories']
) {
  const options = new Map(primary.map((option) => [option.id, option]));
  for (const option of secondary) {
    const existing = options.get(option.id);
    options.set(option.id, {
      ...existing,
      ...option,
      available: Boolean(existing?.available || option.available),
    });
  }
  return [...options.values()];
}

export function mergeDailyReportsResponses(
  recent: DailyReportsResponse,
  selected: DailyReportsResponse
): DailyReportsResponse {
  let reports = recent.reports;
  for (const report of selected.reports) reports = upsertDailyReport(reports, report);

  return {
    reports,
    references: {
      store: selected.references.store ?? recent.references.store,
      categories: mergeDailyReportOptions(
        recent.references.categories,
        selected.references.categories
      ),
      paymentMethods: mergeDailyReportOptions(
        recent.references.paymentMethods,
        selected.references.paymentMethods
      ),
    },
  };
}

function draftMoneyToCents(value: string): number {
  const normalized = value.trim();
  if (!/^\d{1,12}(?:\.\d{0,2})?$/.test(normalized)) return 0;
  const [whole, fraction = ''] = normalized.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

export function calculateDailyReportTotals(draft: DailyReportDraft) {
  let grossCents = 0;
  let cogsCents = 0;
  let discountCents = 0;
  let returnCents = 0;
  let creditCents = 0;
  let unitsSold = 0;
  for (const line of draft.sales) {
    grossCents += draftMoneyToCents(line.grossRevenue);
    cogsCents += draftMoneyToCents(line.cogs);
    discountCents += draftMoneyToCents(line.discounts);
    returnCents += draftMoneyToCents(line.returns);
    creditCents += draftMoneyToCents(line.creditSales);
    unitsSold += Number(line.unitsSold) || 0;
  }
  const paymentsCents = draft.payments.reduce((sum, line) => sum + draftMoneyToCents(line.amount), 0);
  const netCents = grossCents - discountCents - returnCents;
  const expectedPaymentsCents = netCents - creditCents;

  return {
    grossCents,
    cogsCents,
    discountCents,
    returnCents,
    creditCents,
    netCents,
    expectedPaymentsCents,
    paymentsCents,
    paymentVarianceCents: paymentsCents - expectedPaymentsCents,
    unitsSold,
  };
}
