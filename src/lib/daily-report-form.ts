import {
  saveDailyReportSchema,
  type DailyReportMutationRecord,
  type DailyReportRecord,
  type DailyReportReferences,
  type DailyReportsResponse,
  type SaveDailyReportInput,
} from './contracts/daily-report';
import { formatContractError } from './contracts/shared';

export interface DailyProductDraftRow {
  // Stable across re-renders so React keeps focus while a row is being typed into.
  key: string;
  productId: number | null;
  name: string;
  sku: string | null;
  unitsSold: string;
  lineValue: string;
  valueOverridden: boolean;
  // Catalogue selling price, held so the line value can be recalculated when the
  // units change. Null for a free-typed line, which has no price to work from.
  unitPrice: string | null;
}

export interface DailySalesDraftRow {
  categoryId: number;
  openingStock: string;
  unitsSold: string;
  grossRevenue: string;
  cogs: string;
  discounts: string;
  returns: string;
  creditSales: string;
  products: DailyProductDraftRow[];
  // Category units and gross normally track the sum of the product lines. Once the
  // manager corrects a total by hand they stop tracking, so adding another product
  // cannot silently overwrite a figure someone entered deliberately.
  totalsOverridden: boolean;
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
  noSales: boolean;
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
  products: [],
  totalsOverridden: false,
});

let productKeySeed = 0;
export const nextProductKey = () => `product-${(productKeySeed += 1)}`;

const toCents = (value: string) => Math.round((Number(value) || 0) * 100);
const fromCents = (cents: number) => (cents / 100).toFixed(2);

/** Units x the catalogue price. Returns null when the line has no price to work from. */
export function derivedLineValue(units: string, unitPrice: string | null): string | null {
  if (unitPrice === null || unitPrice.trim() === '') return null;
  return fromCents(toCents(unitPrice) * (Number(units) || 0));
}

export function sumProductUnits(products: DailyProductDraftRow[]): number {
  return products.reduce((total, product) => total + (Number(product.unitsSold) || 0), 0);
}

export function sumProductValue(products: DailyProductDraftRow[]): string {
  return fromCents(products.reduce((total, product) => total + toCents(product.lineValue), 0));
}

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
    noSales: report?.noSales ?? false,
    sales: categoryIds.map((categoryId) => {
      const line = existingSales.get(categoryId);
      if (!line) return emptySalesRow(categoryId);
      const products: DailyProductDraftRow[] = line.products.map((item) => ({
        key: nextProductKey(),
        productId: item.productId,
        name: item.productName,
        sku: item.sku,
        unitsSold: String(item.unitsSold),
        lineValue: item.lineValue,
        valueOverridden: item.valueOverridden,
        // The catalogue price is not stored on the saved line. Recovering it from
        // the saved value keeps recalculation working after a reload without
        // re-fetching every product.
        unitPrice: item.unitsSold > 0 ? fromCents(Math.round(toCents(item.lineValue) / item.unitsSold)) : null,
      }));
      // A saved report carries no override flag for the category totals, so infer
      // it: totals that already disagree with the lines were set deliberately.
      const totalsOverridden =
        line.unitsSold !== sumProductUnits(products) || toCents(line.grossRevenue) !== toCents(sumProductValue(products));
      return {
        categoryId,
        openingStock: String(line.openingStock),
        unitsSold: String(line.unitsSold),
        grossRevenue: line.grossRevenue,
        cogs: line.cogs,
        discounts: line.discounts,
        returns: line.returns,
        creditSales: line.creditSales,
        products,
        totalsOverridden,
      };
    }),
    payments: paymentMethodIds.map((paymentMethodId) => ({
      paymentMethodId,
      amount: existingPayments.get(paymentMethodId)?.amount ?? '',
    })),
  };
}

const productRowHasValue = (row: DailyProductDraftRow) => row.productId !== null || row.name.trim() !== '';

const salesRowHasValue = (row: DailySalesDraftRow) =>
  row.products.some(productRowHasValue) ||
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
    noSales: draft.noSales,
    lockVersion,
    // A no-sales day sends no lines at all. Anything half-typed before the toggle
    // was flipped is dropped rather than saved as a zero row, which is the phantom
    // category the flag exists to avoid.
    sales: (draft.noSales ? [] : draft.sales.filter(salesRowHasValue)).map((row) => ({
      categoryId: row.categoryId,
      openingStock: Number(row.openingStock || 0),
      unitsSold: Number(row.unitsSold || 0),
      grossRevenue: row.grossRevenue.trim() || '0',
      cogs: row.cogs.trim() || '0',
      discounts: row.discounts.trim() || '0',
      returns: row.returns.trim() || '0',
      creditSales: row.creditSales.trim() || '0',
      products: row.products.filter(productRowHasValue).map((product) => ({
        ...(product.productId ? { productId: product.productId } : { customName: product.name.trim() }),
        unitsSold: Number(product.unitsSold || 0),
        lineValue: product.lineValue.trim() || '0',
        valueOverridden: product.valueOverridden,
      })),
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
    noSales: input.noSales,
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
        unitsSold: item.unitsSold,
        lineValue: item.lineValue,
        valueOverridden: item.valueOverridden,
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
