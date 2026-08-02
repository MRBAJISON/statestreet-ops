import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { customerInteractions, products } from '../db/foundation-schema';

export interface DailyStoreReportCustomerRequest {
  id: number;
  interest: string;
  fulfillmentStatus: 'in_stock' | 'stock_gap' | null;
}

export interface DailyStoreReportSupplement {
  dailyTarget: number;
  achievementPercent: number;
  surplus: number;
  statusText: string;
  avgTicketValue: number;
  leadsCount: number;
  followUpText: string;
  customerRequests: DailyStoreReportCustomerRequest[];
}

// Everything a daily-report PDF needs that isn't already on the fetched DailyReportRecord:
// the single-day prorated target/achievement (same formula as trading.ts's effective_daily_target,
// scoped to one store and one date), and customer requests/stock-gaps/leads for that store+date.
export async function getDailyStoreReportSupplement(
  storeId: number,
  businessDate: string,
  netRevenue: number,
  transactions: number
): Promise<DailyStoreReportSupplement> {
  const [targetResult, interactionRows] = await Promise.all([
    db.execute(sql`
      select coalesce(
        sum(target.value / ((target.period_end - target.period_start) + 1)::numeric),
        0
      ) as daily_target
      from performance_targets target
      where target.metric = 'net-revenue'
        and target.scope_type = 'store'
        and target.store_id = ${storeId}
        and ${businessDate}::date between target.period_start and target.period_end
    `),
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
      .where(and(eq(customerInteractions.storeId, storeId), eq(customerInteractions.businessDate, businessDate))),
  ]);

  const dailyTarget = Number((targetResult.rows[0] as { daily_target: string } | undefined)?.daily_target ?? 0);
  const achievementPercent = dailyTarget > 0 ? (netRevenue / dailyTarget) * 100 : 0;
  const surplus = netRevenue - dailyTarget;
  const statusText =
    dailyTarget <= 0
      ? 'No target set'
      : achievementPercent >= 100
        ? `Target Exceeded (+${(achievementPercent - 100).toFixed(1)}%)`
        : `Below Target (${(achievementPercent - 100).toFixed(1)}%)`;
  const avgTicketValue = transactions > 0 ? netRevenue / transactions : 0;

  const customerRequests = interactionRows
    .filter((row) => row.productId || row.interestText)
    .map((row) => ({
      id: row.id,
      interest: row.productName ?? row.interestText ?? '',
      fulfillmentStatus: row.fulfillmentStatus as 'in_stock' | 'stock_gap' | null,
    }));
  const leadsCount = interactionRows.filter((row) => row.lifecycle === 'lead').length;
  const followUpText =
    leadsCount > 0
      ? `${leadsCount} new lead${leadsCount === 1 ? '' : 's'} captured — personal outreach and post-purchase follow-up recommended.`
      : 'No new leads captured today.';

  return { dailyTarget, achievementPercent, surplus, statusText, avgTicketValue, leadsCount, followUpText, customerRequests };
}
