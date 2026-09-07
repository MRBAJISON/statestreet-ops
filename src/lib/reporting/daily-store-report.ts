import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { customerInteractions, products } from '../db/foundation-schema';
import { isTradingDay, targetPerTradingDayForDate } from './trading-days';

export interface DailyStoreReportCustomerRequest {
  id: number;
  interest: string;
  fulfillmentStatus: 'in_stock' | 'stock_gap' | null;
  stockGapQuantity: number | null;
  stockGapValue: number;
  stockGapCause: string | null;
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
  transactionSummary: {
    approvedCredits: number;
    creditRedemptions: number;
    depositReceived: number;
    depositRefunds: number;
    additionalPayments: number;
    netRevenueAdjustment: number;
    cashAdjustment: number;
  };
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
  const [targetResult, interactionRows, transactionResult] = await Promise.all([
    db.execute(sql`
      select coalesce(
        sum(${targetPerTradingDayForDate(sql`target.value`, sql`target.period_type`, sql`target.recurring`, sql`${businessDate}::date`, sql`target.period_start`, sql`target.period_end`)}),
        0
      ) as daily_target
      from performance_targets target
      where target.metric = 'net-revenue'
        and target.scope_type = 'store'
        and target.store_id = ${storeId}
        and ${businessDate}::date between target.period_start and target.period_end
        and ${isTradingDay(sql`${businessDate}::date`)}
    `),
    db
      .select({
        id: customerInteractions.id,
        productId: customerInteractions.productId,
        productName: products.name,
        interestText: customerInteractions.interestText,
        fulfillmentStatus: customerInteractions.fulfillmentStatus,
        stockGapQuantity: customerInteractions.stockGapQuantity,
        stockGapValue: customerInteractions.stockGapValue,
        stockGapCause: customerInteractions.stockGapCause,
        lifecycle: customerInteractions.lifecycle,
      })
      .from(customerInteractions)
      .leftJoin(products, eq(customerInteractions.productId, products.id))
      .where(and(eq(customerInteractions.storeId, storeId), eq(customerInteractions.businessDate, businessDate))),
    db.execute(sql`
      select
        coalesce((select sum(note.approved_value) from customer_credit_notes note where note.store_id = ${storeId} and note.business_date = ${businessDate}::date and note.status in ('approved', 'partially-redeemed', 'redeemed')), 0) as approved_credits,
        coalesce((select sum(redemption.credit_applied) from customer_credit_note_redemptions redemption where redemption.store_id = ${storeId} and redemption.business_date = ${businessDate}::date), 0) as credit_redemptions,
        coalesce((select sum(payment.amount) from customer_deposit_payments payment where payment.store_id = ${storeId} and payment.business_date = ${businessDate}::date and payment.payment_type in ('deposit', 'balance')), 0) as deposit_received,
        coalesce((select sum(payment.amount) from customer_deposit_payments payment where payment.store_id = ${storeId} and payment.business_date = ${businessDate}::date and payment.payment_type = 'refund'), 0) as deposit_refunds,
        coalesce((select sum(redemption.additional_payment) from customer_credit_note_redemptions redemption where redemption.store_id = ${storeId} and redemption.business_date = ${businessDate}::date), 0) as additional_payments
    `),
  ]);

  const dailyTarget = Number((targetResult.rows[0] as { daily_target: string } | undefined)?.daily_target ?? 0);
  const transactionRow = transactionResult.rows[0] as Record<string, unknown> | undefined;
  const transactionSummary = {
    approvedCredits: Number(transactionRow?.approved_credits ?? 0),
    creditRedemptions: Number(transactionRow?.credit_redemptions ?? 0),
    depositReceived: Number(transactionRow?.deposit_received ?? 0),
    depositRefunds: Number(transactionRow?.deposit_refunds ?? 0),
    additionalPayments: Number(transactionRow?.additional_payments ?? 0),
    netRevenueAdjustment: Number(transactionRow?.deposit_received ?? 0) + Number(transactionRow?.additional_payments ?? 0) - Number(transactionRow?.approved_credits ?? 0) - Number(transactionRow?.deposit_refunds ?? 0),
    cashAdjustment: Number(transactionRow?.deposit_received ?? 0) + Number(transactionRow?.additional_payments ?? 0) - Number(transactionRow?.deposit_refunds ?? 0),
  };
  const adjustedNetRevenue = netRevenue + transactionSummary.netRevenueAdjustment;
  const achievementPercent = dailyTarget > 0 ? (adjustedNetRevenue / dailyTarget) * 100 : 0;
  const surplus = adjustedNetRevenue - dailyTarget;
  const statusText =
    dailyTarget <= 0
      ? 'No target set'
      : achievementPercent >= 100
        ? `Target Exceeded (+${(achievementPercent - 100).toFixed(1)}%)`
        : `Below Target (${(achievementPercent - 100).toFixed(1)}%)`;
  const avgTicketValue = transactions > 0 ? adjustedNetRevenue / transactions : 0;

  const customerRequests = interactionRows
    .filter((row) => row.productId || row.interestText)
    .map((row) => ({
      id: row.id,
      interest: row.productName ?? row.interestText ?? '',
      fulfillmentStatus: row.fulfillmentStatus as 'in_stock' | 'stock_gap' | null,
      stockGapQuantity: row.stockGapQuantity,
      stockGapValue: Number(row.stockGapValue ?? 0),
      stockGapCause: row.stockGapCause,
    }));
  const leadsCount = interactionRows.filter((row) => row.lifecycle === 'lead').length;
  const followUpText =
    leadsCount > 0
      ? `${leadsCount} new lead${leadsCount === 1 ? '' : 's'} captured — personal outreach and post-purchase follow-up recommended.`
      : 'No new leads captured today.';

  return { dailyTarget, achievementPercent, surplus, statusText, avgTicketValue, leadsCount, followUpText, customerRequests, transactionSummary };
}
