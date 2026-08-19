import type { DailyReportRecord } from '../contracts/daily-report';
import { getDailyReportsForStorePeriod } from '../daily-reports';
import { getDailyStoreReportSupplement, type DailyStoreReportCustomerRequest } from './daily-store-report';
import { storeNames, storesInGroup } from '../store-access';

// The combined report for a single trading day across the stores in a group.
//
// Same construction as the weekly and monthly cluster reports: each member's own
// day is read first and then merged, so a combined figure can never disagree with
// the single-store report the same manager can download beside it.

export interface StoreGroupDailyStoreSplit {
  storeId: number;
  storeName: string;
  status: DailyReportRecord['status'] | null;
  netRevenue: number;
  transactions: number;
  target: number;
  achievementPercent: number;
}

export interface StoreGroupDailyCategory {
  categoryId: number;
  unitsSold: number;
  grossRevenue: number;
  discounts: number;
  returns: number;
  netRevenue: number;
}

export interface StoreGroupDailyReport {
  businessDate: string;
  group: { id: number; code: string; name: string };
  managerName: string | null;
  /** Which stores have filed, and which have not. */
  ready: boolean;
  outstanding: { storeName: string; reason: 'missing' | 'draft' }[];
  stores: StoreGroupDailyStoreSplit[];
  totals: {
    grossRevenue: number;
    discounts: number;
    returns: number;
    netRevenue: number;
    unitsSold: number;
    transactions: number;
    footfall: number;
    creditSales: number;
  };
  target: number;
  achievementPercent: number;
  surplus: number;
  statusText: string;
  avgTicketValue: number;
  categories: StoreGroupDailyCategory[];
  payments: { paymentMethodId: number; amount: number }[];
  productsSold: { storeName: string; name: string; unitsSold: number }[];
  customerRequests: (DailyStoreReportCustomerRequest & { storeName: string })[];
  leadsCount: number;
  notes: { storeName: string; notes: string | null; staffPerformanceNote: string | null; closingFacilityStatus: string | null }[];
}

const money = (value: string | number | null | undefined) => Number(value ?? 0);

function netOf(report: DailyReportRecord): number {
  return report.sales.reduce(
    (sum, line) => sum + money(line.grossRevenue) - money(line.discounts) - money(line.returns),
    0
  );
}

/**
 * @param storeIds  The stores to combine, defaulting to the group's members. The
 *   group-wide report Commercial takes passes every active store, so it does not
 *   need a store_groups row for a set that is not a real trading unit.
 */
export async function getStoreGroupDailyReport(
  group: { id: number; code: string; name: string },
  businessDate: string,
  storeIds?: number[]
): Promise<StoreGroupDailyReport | null> {
  const memberIds = storeIds ?? (await storesInGroup(group.id));
  if (!memberIds.length) return null;

  const names = await storeNames(memberIds);
  const members = await Promise.all(
    memberIds.map(async (storeId) => {
      const [report] = await getDailyReportsForStorePeriod(storeId, businessDate, businessDate);
      return { storeId, storeName: names.get(storeId) ?? `Store ${storeId}`, report: report ?? null };
    })
  );

  if (members.every((member) => member.report === null)) return null;

  const totals = {
    grossRevenue: 0, discounts: 0, returns: 0, netRevenue: 0,
    unitsSold: 0, transactions: 0, footfall: 0, creditSales: 0,
  };
  let target = 0;
  let leadsCount = 0;

  const stores: StoreGroupDailyStoreSplit[] = [];
  const outstanding: StoreGroupDailyReport['outstanding'] = [];
  const categoryTotals = new Map<number, StoreGroupDailyCategory>();
  const paymentTotals = new Map<number, number>();
  const productsSold: StoreGroupDailyReport['productsSold'] = [];
  const customerRequests: StoreGroupDailyReport['customerRequests'] = [];
  const notes: StoreGroupDailyReport['notes'] = [];
  let managerName: string | null = null;

  for (const member of members) {
    const report = member.report;
    // A store that has not filed, or is still drafting, keeps the day locked and
    // is named — rather than the combined total quietly counting one shop.
    if (!report || report.status === 'draft') {
      outstanding.push({ storeName: member.storeName, reason: report ? 'draft' : 'missing' });
    }
    if (!report) {
      stores.push({
        storeId: member.storeId,
        storeName: member.storeName,
        status: null,
        netRevenue: 0,
        transactions: 0,
        target: 0,
        achievementPercent: 0,
      });
      continue;
    }

    managerName = managerName ?? report.managerName;
    const counted = report.status !== 'draft';
    const netRevenue = counted ? netOf(report) : 0;
    const transactions = counted ? report.transactions : 0;

    const supplement = await getDailyStoreReportSupplement(
      member.storeId,
      businessDate,
      netRevenue,
      transactions
    );

    stores.push({
      storeId: member.storeId,
      storeName: member.storeName,
      status: report.status,
      netRevenue,
      transactions,
      target: supplement.dailyTarget,
      achievementPercent: supplement.achievementPercent,
    });
    target += supplement.dailyTarget;
    leadsCount += supplement.leadsCount;

    for (const request of supplement.customerRequests) {
      customerRequests.push({ ...request, storeName: member.storeName });
    }

    if (!counted) continue;

    totals.transactions += transactions;
    totals.footfall += report.footfall;
    for (const line of report.sales) {
      totals.grossRevenue += money(line.grossRevenue);
      totals.discounts += money(line.discounts);
      totals.returns += money(line.returns);
      totals.creditSales += money(line.creditSales);
      totals.unitsSold += line.unitsSold;

      const row = categoryTotals.get(line.categoryId) ?? {
        categoryId: line.categoryId, unitsSold: 0, grossRevenue: 0, discounts: 0, returns: 0, netRevenue: 0,
      };
      row.unitsSold += line.unitsSold;
      row.grossRevenue += money(line.grossRevenue);
      row.discounts += money(line.discounts);
      row.returns += money(line.returns);
      row.netRevenue += money(line.grossRevenue) - money(line.discounts) - money(line.returns);
      categoryTotals.set(line.categoryId, row);

      for (const product of line.products) {
        if (!product.productName) continue;
        productsSold.push({ storeName: member.storeName, name: product.productName, unitsSold: product.unitsSold });
      }
    }

    for (const payment of report.payments) {
      paymentTotals.set(
        payment.paymentMethodId,
        (paymentTotals.get(payment.paymentMethodId) ?? 0) + money(payment.amount)
      );
    }

    if (report.notes || report.staffPerformanceNote || report.closingFacilityStatus) {
      notes.push({
        storeName: member.storeName,
        notes: report.notes,
        staffPerformanceNote: report.staffPerformanceNote,
        closingFacilityStatus: report.closingFacilityStatus,
      });
    }
  }

  totals.netRevenue = totals.grossRevenue - totals.discounts - totals.returns;
  const achievementPercent = target > 0 ? (totals.netRevenue / target) * 100 : 0;
  const difference = achievementPercent - 100;

  return {
    businessDate,
    group,
    managerName,
    ready: outstanding.length === 0,
    outstanding,
    stores: stores.sort((left, right) => left.storeName.localeCompare(right.storeName)),
    totals,
    target,
    achievementPercent,
    surplus: totals.netRevenue - target,
    statusText:
      difference >= 0 ? `Target Exceeded (+${difference.toFixed(1)}%)` : `Below Target (${difference.toFixed(1)}%)`,
    avgTicketValue: totals.transactions > 0 ? totals.netRevenue / totals.transactions : 0,
    categories: [...categoryTotals.values()].sort((left, right) => right.netRevenue - left.netRevenue),
    payments: [...paymentTotals.entries()].map(([paymentMethodId, amount]) => ({ paymentMethodId, amount })),
    productsSold: productsSold.sort((left, right) => right.unitsSold - left.unitsSold),
    customerRequests,
    leadsCount,
    notes,
  };
}
