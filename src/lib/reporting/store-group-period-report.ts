import { getStorePeriodReport, type StorePeriodCategory, type StorePeriodDay, type StorePeriodReport } from './store-period-report';
import { resolveStorePeriod, tradingDaysBetween, type StorePeriodRange, type StorePeriodType } from './store-period';
import { storeNames, storesInGroup } from '../store-access';

// A combined report for stores that trade as one unit.
//
// Built by running the per-store report for each member and merging, rather than
// re-deriving the same figures in new SQL. The per-store numbers are already
// trusted and covered by tests, and a second implementation would be free to
// disagree with them — which on a combined report is the one thing nobody could
// spot from the document itself.

export interface StoreGroupStoreSplit {
  storeId: number;
  storeName: string;
  netRevenue: number;
  transactions: number;
  target: number;
  achievementPercent: number;
}

export interface StoreGroupOutstandingDay {
  storeName: string;
  date: string;
  reason: 'missing' | 'draft';
}

export interface StoreGroupPeriodReport {
  periodType: StorePeriodType;
  range: StorePeriodRange;
  previousRange: StorePeriodRange;
  tradingDays: number;
  ready: boolean;
  outstanding: StoreGroupOutstandingDay[];
  group: { id: number; code: string; name: string };
  managerName: string | null;
  /** Per-store rows. This is what makes it a cluster report rather than a merge. */
  stores: StoreGroupStoreSplit[];
  totals: StorePeriodReport['totals'];
  target: number;
  achievementPercent: number;
  surplus: number;
  statusText: string;
  avgTicketValue: number;
  days: StorePeriodDay[];
  categories: StorePeriodCategory[];
  payments: { paymentMethodId: number; amount: number }[];
  productsSold: { name: string; occurrences: number }[];
  customerRequests: { storeName: string; interest: string; fulfillmentStatus: 'in_stock' | 'stock_gap' | null }[];
  leadsCount: number;
  notes: { storeName: string; date: string; notes: string | null; staffPerformanceNote: string | null; closingFacilityStatus: string | null }[];
  previous: { netRevenue: number; transactions: number; avgTicketValue: number };
}

function statusTextFor(achievementPercent: number): string {
  const difference = achievementPercent - 100;
  return difference >= 0
    ? `Target Exceeded (+${difference.toFixed(1)}%)`
    : `Below Target (${difference.toFixed(1)}%)`;
}

export async function getStoreGroupPeriodReport(
  group: { id: number; code: string; name: string },
  periodType: StorePeriodType,
  anchorIso: string
): Promise<StoreGroupPeriodReport | null> {
  const memberIds = await storesInGroup(group.id);
  if (!memberIds.length) return null;

  const names = await storeNames(memberIds);
  const reports = await Promise.all(
    memberIds.map(async (storeId) => ({
      storeId,
      storeName: names.get(storeId) ?? `Store ${storeId}`,
      report: await getStorePeriodReport(storeId, periodType, anchorIso),
    }))
  );

  // Nothing filed anywhere in the period is not a report worth producing.
  if (reports.every((member) => member.report === null)) return null;

  const { range, previousRange } = resolveStorePeriod(periodType, anchorIso);
  const expectedDays = tradingDaysBetween(range.from, range.to);

  const totals: StorePeriodReport['totals'] = {
    grossRevenue: 0, discounts: 0, returns: 0, netRevenue: 0, cogs: 0,
    unitsSold: 0, transactions: 0, footfall: 0, creditSales: 0,
  };
  let target = 0;
  let leadsCount = 0;
  const previous = { netRevenue: 0, transactions: 0, avgTicketValue: 0 };

  const stores: StoreGroupStoreSplit[] = [];
  const outstanding: StoreGroupOutstandingDay[] = [];
  const dayTotals = new Map<string, StorePeriodDay>();
  // A day belongs to the group only once every member has filed it, so it is
  // counted rather than inferred from whichever member happened to be read last.
  const filedByDate = new Map<string, number>();
  const categoryTotals = new Map<number, StorePeriodCategory>();
  const paymentTotals = new Map<number, number>();
  const productCounts = new Map<string, number>();
  const customerRequests: StoreGroupPeriodReport['customerRequests'] = [];
  const notes: StoreGroupPeriodReport['notes'] = [];

  for (const date of expectedDays) {
    dayTotals.set(date, { date, status: null, netRevenue: 0, transactions: 0, target: 0 });
  }

  for (const member of reports) {
    // A member with nothing filed still owes every trading day, so the group stays
    // locked and names the days rather than quietly reporting a partial total.
    if (!member.report) {
      for (const date of expectedDays) {
        outstanding.push({ storeName: member.storeName, date, reason: 'missing' });
      }
      stores.push({
        storeId: member.storeId,
        storeName: member.storeName,
        netRevenue: 0,
        transactions: 0,
        target: 0,
        achievementPercent: 0,
      });
      continue;
    }
    const report = member.report;

    for (const key of Object.keys(totals) as (keyof typeof totals)[]) totals[key] += report.totals[key];
    target += report.target;
    leadsCount += report.leadsCount;
    previous.netRevenue += report.previous.netRevenue;
    previous.transactions += report.previous.transactions;

    stores.push({
      storeId: member.storeId,
      storeName: member.storeName,
      netRevenue: report.totals.netRevenue,
      transactions: report.totals.transactions,
      target: report.target,
      achievementPercent: report.achievementPercent,
    });

    for (const day of report.outstanding) {
      outstanding.push({ storeName: member.storeName, date: day.date, reason: day.reason });
    }

    for (const day of report.days) {
      const row = dayTotals.get(day.date);
      if (!row) continue;
      row.netRevenue += day.netRevenue;
      row.transactions += day.transactions;
      row.target += day.target;
      filedByDate.set(day.date, (filedByDate.get(day.date) ?? 0) + (day.status === null ? 0 : 1));
    }

    for (const category of report.categories) {
      const row = categoryTotals.get(category.categoryId) ?? {
        categoryId: category.categoryId, unitsSold: 0, grossRevenue: 0,
        discounts: 0, returns: 0, netRevenue: 0, cogs: 0,
      };
      row.unitsSold += category.unitsSold;
      row.grossRevenue += category.grossRevenue;
      row.discounts += category.discounts;
      row.returns += category.returns;
      row.netRevenue += category.netRevenue;
      row.cogs += category.cogs;
      categoryTotals.set(category.categoryId, row);
    }

    for (const payment of report.payments) {
      paymentTotals.set(payment.paymentMethodId, (paymentTotals.get(payment.paymentMethodId) ?? 0) + payment.amount);
    }

    for (const product of report.productsSold) {
      productCounts.set(product.name, (productCounts.get(product.name) ?? 0) + product.occurrences);
    }

    for (const request of report.customerRequests) {
      customerRequests.push({
        storeName: member.storeName,
        interest: request.interest,
        fulfillmentStatus: request.fulfillmentStatus,
      });
    }

    for (const note of report.notes) {
      notes.push({
        storeName: member.storeName,
        date: note.date,
        notes: note.notes,
        staffPerformanceNote: note.staffPerformanceNote,
        closingFacilityStatus: note.closingFacilityStatus,
      });
    }
  }

  const achievementPercent = target > 0 ? (totals.netRevenue / target) * 100 : 0;
  const avgTicketValue = totals.transactions > 0 ? totals.netRevenue / totals.transactions : 0;
  previous.avgTicketValue = previous.transactions > 0 ? previous.netRevenue / previous.transactions : 0;

  const managerName = reports.find((member) => member.report?.managerName)?.report?.managerName ?? null;

  return {
    periodType,
    range,
    previousRange,
    tradingDays: expectedDays.length,
    ready: outstanding.length === 0,
    outstanding: outstanding.sort((left, right) => left.date.localeCompare(right.date)),
    group,
    managerName,
    stores: stores.sort((left, right) => left.storeName.localeCompare(right.storeName)),
    totals,
    target,
    achievementPercent,
    surplus: totals.netRevenue - target,
    statusText: statusTextFor(achievementPercent),
    avgTicketValue,
    days: expectedDays.map((date) => {
      const row = dayTotals.get(date)!;
      return { ...row, status: filedByDate.get(date) === memberIds.length ? row.status ?? 'submitted' : null };
    }),
    categories: [...categoryTotals.values()].sort((left, right) => right.netRevenue - left.netRevenue),
    payments: [...paymentTotals.entries()].map(([paymentMethodId, amount]) => ({ paymentMethodId, amount })),
    productsSold: [...productCounts.entries()]
      .map(([name, occurrences]) => ({ name, occurrences }))
      .sort((left, right) => right.occurrences - left.occurrences),
    customerRequests,
    leadsCount,
    notes: notes.sort((left, right) => left.date.localeCompare(right.date)),
    previous,
  };
}
