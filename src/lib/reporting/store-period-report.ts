import { and, eq, gte, lte, sql } from 'drizzle-orm';
import type { DailyReportRecord, DailyReportStatus } from '../contracts/daily-report';
import { db } from '../db';
import { customerInteractions, products } from '../db/foundation-schema';
import { getDailyReportsForStorePeriod } from '../daily-reports';
import { targetWithinWindow } from './trading-days';
import { resolveStorePeriod, tradingDaysBetween, type StorePeriodRange, type StorePeriodType } from './store-period';

export { resolveStorePeriod, tradingDaysBetween };
export type { StorePeriodRange, StorePeriodType };

export interface StorePeriodOutstandingDay {
  date: string;
  reason: 'missing' | 'draft';
}

export interface StorePeriodDay {
  date: string;
  status: DailyReportStatus | null;
  netRevenue: number;
  transactions: number;
  target: number;
}

export interface StorePeriodCategory {
  categoryId: number;
  unitsSold: number;
  grossRevenue: number;
  discounts: number;
  returns: number;
  netRevenue: number;
  cogs: number;
}

export interface StorePeriodNote {
  date: string;
  notes: string | null;
  staffPerformanceNote: string | null;
  closingFacilityStatus: string | null;
}

export interface StorePeriodReport {
  periodType: StorePeriodType;
  range: StorePeriodRange;
  previousRange: StorePeriodRange;
  tradingDays: number;
  /** True once every trading day in the range has been submitted. */
  ready: boolean;
  outstanding: StorePeriodOutstandingDay[];
  store: { id: number; code: string; name: string };
  managerName: string | null;
  totals: {
    grossRevenue: number;
    discounts: number;
    returns: number;
    netRevenue: number;
    cogs: number;
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
  days: StorePeriodDay[];
  categories: StorePeriodCategory[];
  payments: { paymentMethodId: number; amount: number }[];
  productsSold: { name: string; occurrences: number }[];
  customerRequests: { id: number; interest: string; fulfillmentStatus: 'in_stock' | 'stock_gap' | null }[];
  leadsCount: number;
  notes: StorePeriodNote[];
  previous: { netRevenue: number; transactions: number; avgTicketValue: number };
}

const money = (value: string | number | null | undefined) => Number(value ?? 0);

function sumReports(reports: DailyReportRecord[]) {
  const totals = {
    grossRevenue: 0, discounts: 0, returns: 0, netRevenue: 0, cogs: 0,
    unitsSold: 0, transactions: 0, footfall: 0, creditSales: 0,
  };
  for (const report of reports) {
    totals.transactions += report.transactions;
    totals.footfall += report.footfall;
    for (const line of report.sales) {
      totals.grossRevenue += money(line.grossRevenue);
      totals.discounts += money(line.discounts);
      totals.returns += money(line.returns);
      totals.cogs += money(line.cogs);
      totals.creditSales += money(line.creditSales);
      totals.unitsSold += line.unitsSold;
    }
  }
  totals.netRevenue = totals.grossRevenue - totals.discounts - totals.returns;
  return totals;
}

function netOf(report: DailyReportRecord): number {
  return report.sales.reduce(
    (sum, line) => sum + money(line.grossRevenue) - money(line.discounts) - money(line.returns),
    0
  );
}

async function targetForRange(storeId: number, from: string, to: string): Promise<number> {
  const result = await db.execute(sql`
    select coalesce(sum(${targetWithinWindow(
      sql`target.value`,
      sql`target.period_start`,
      sql`target.period_end`,
      sql`${from}::date`,
      sql`${to}::date`
    )}), 0) as value
    from performance_targets target
    where target.metric = 'net-revenue'
      and target.scope_type = 'store'
      and target.store_id = ${storeId}
      and target.period_start <= ${to}::date
      and target.period_end >= ${from}::date
  `);
  return Number((result.rows[0] as { value: string } | undefined)?.value ?? 0);
}

/**
 * Everything a weekly or monthly store report needs. The report is only `ready` once
 * every trading day in the range has been submitted — a draft or a missing day keeps
 * it locked and is listed in `outstanding`.
 */
export async function getStorePeriodReport(
  storeId: number,
  periodType: StorePeriodType,
  anchorIso: string
): Promise<StorePeriodReport | null> {
  const { range, previousRange } = resolveStorePeriod(periodType, anchorIso);
  const expectedDays = tradingDaysBetween(range.from, range.to);

  const [reports, previousReports, target, interactionRows] = await Promise.all([
    getDailyReportsForStorePeriod(storeId, range.from, range.to),
    getDailyReportsForStorePeriod(storeId, previousRange.from, previousRange.to),
    targetForRange(storeId, range.from, range.to),
    db
      .select({
        id: customerInteractions.id,
        productId: customerInteractions.productId,
        productName: products.name,
        interestText: customerInteractions.interestText,
        fulfillmentStatus: customerInteractions.fulfillmentStatus,
        lifecycle: customerInteractions.lifecycle,
      })
      .from(customerInteractions)
      .leftJoin(products, eq(customerInteractions.productId, products.id))
      .where(
        and(
          eq(customerInteractions.storeId, storeId),
          gte(customerInteractions.businessDate, range.from),
          lte(customerInteractions.businessDate, range.to)
        )
      ),
  ]);

  const first = reports[0];
  if (!first) return null;

  const byDate = new Map(reports.map((report) => [report.businessDate, report]));
  const counted = reports.filter((report) => report.status !== 'draft');

  const outstanding: StorePeriodOutstandingDay[] = expectedDays
    .filter((date) => byDate.get(date)?.status !== 'submitted' && byDate.get(date)?.status !== 'approved')
    .map((date) => ({ date, reason: byDate.has(date) ? ('draft' as const) : ('missing' as const) }));

  const totals = sumReports(counted);
  const perTradingDayTarget = expectedDays.length ? target / expectedDays.length : 0;
  const achievementPercent = target > 0 ? (totals.netRevenue / target) * 100 : 0;
  const avgTicketValue = totals.transactions > 0 ? totals.netRevenue / totals.transactions : 0;

  const days: StorePeriodDay[] = expectedDays.map((date) => {
    const report = byDate.get(date);
    const counts = report && report.status !== 'draft';
    return {
      date,
      status: report?.status ?? null,
      netRevenue: counts ? netOf(report) : 0,
      transactions: counts ? report.transactions : 0,
      target: perTradingDayTarget,
    };
  });

  const categoryTotals = new Map<number, StorePeriodCategory>();
  const paymentTotals = new Map<number, number>();
  const productCounts = new Map<string, number>();
  for (const report of counted) {
    for (const line of report.sales) {
      const row = categoryTotals.get(line.categoryId) ?? {
        categoryId: line.categoryId, unitsSold: 0, grossRevenue: 0,
        discounts: 0, returns: 0, netRevenue: 0, cogs: 0,
      };
      row.unitsSold += line.unitsSold;
      row.grossRevenue += money(line.grossRevenue);
      row.discounts += money(line.discounts);
      row.returns += money(line.returns);
      row.cogs += money(line.cogs);
      row.netRevenue = row.grossRevenue - row.discounts - row.returns;
      categoryTotals.set(line.categoryId, row);
      for (const product of line.products) {
        const name = product.productName.trim();
        if (name) productCounts.set(name, (productCounts.get(name) ?? 0) + 1);
      }
    }
    for (const line of report.payments) {
      paymentTotals.set(line.paymentMethodId, (paymentTotals.get(line.paymentMethodId) ?? 0) + money(line.amount));
    }
  }

  const previousTotals = sumReports(previousReports.filter((report) => report.status !== 'draft'));

  return {
    periodType,
    range,
    previousRange,
    tradingDays: expectedDays.length,
    ready: outstanding.length === 0,
    outstanding,
    store: { id: first.storeId, code: first.storeCode, name: first.storeName },
    managerName: first.managerName,
    totals,
    target,
    achievementPercent,
    surplus: totals.netRevenue - target,
    statusText:
      target <= 0
        ? 'No target set'
        : achievementPercent >= 100
          ? `Target Exceeded (+${(achievementPercent - 100).toFixed(1)}%)`
          : `Below Target (${(achievementPercent - 100).toFixed(1)}%)`,
    avgTicketValue,
    days,
    categories: [...categoryTotals.values()].sort((a, b) => b.netRevenue - a.netRevenue),
    payments: [...paymentTotals.entries()]
      .map(([paymentMethodId, amount]) => ({ paymentMethodId, amount }))
      .sort((a, b) => b.amount - a.amount),
    productsSold: [...productCounts.entries()]
      .map(([name, occurrences]) => ({ name, occurrences }))
      .sort((a, b) => b.occurrences - a.occurrences || a.name.localeCompare(b.name)),
    customerRequests: interactionRows
      .filter((row) => row.productId || row.interestText)
      .map((row) => ({
        id: row.id,
        interest: row.productName ?? row.interestText ?? '',
        fulfillmentStatus: row.fulfillmentStatus as 'in_stock' | 'stock_gap' | null,
      })),
    leadsCount: interactionRows.filter((row) => row.lifecycle === 'lead').length,
    notes: counted
      .filter((report) => report.notes || report.staffPerformanceNote || report.closingFacilityStatus)
      .map((report) => ({
        date: report.businessDate,
        notes: report.notes,
        staffPerformanceNote: report.staffPerformanceNote,
        closingFacilityStatus: report.closingFacilityStatus,
      })),
    previous: {
      netRevenue: previousTotals.netRevenue,
      transactions: previousTotals.transactions,
      avgTicketValue: previousTotals.transactions > 0 ? previousTotals.netRevenue / previousTotals.transactions : 0,
    },
  };
}
