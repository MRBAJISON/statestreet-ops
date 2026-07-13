import { sql } from 'drizzle-orm';
import type { StoreDomain } from '../contracts/analytics';
import { db } from '../db';
import type { AnalyticsScope } from './shared';
import { jsonResult } from './shared';

export async function getStoreDomain(scope: AnalyticsScope): Promise<StoreDomain> {
  if (!scope.store) throw new Error('Store reporting requires a store scope');

  const result = await db.execute(sql`
    with recent_reports as (
      select
        report.id,
        report.business_date,
        report.status,
        coalesce(sum(line.gross_revenue - line.discounts - line.returns), 0) as revenue,
        coalesce((select sum(payment.amount) from daily_payment_lines payment where payment.daily_report_id = report.id), 0) -
          coalesce(sum(line.gross_revenue - line.discounts - line.returns - line.credit_sales), 0) as payment_variance
      from daily_reports report
      left join daily_sales_lines line on line.daily_report_id = report.id
      where report.store_id = ${scope.store.id} and report.business_date <= ${scope.to}::date
      group by report.id, report.business_date, report.status
      order by report.business_date desc, report.id desc
      limit 10
    ), latest_review as (
      select review.*
      from weekly_reviews review
      where review.store_id = ${scope.store.id} and review.week_end <= ${scope.to}::date
      order by review.week_end desc, review.id desc
      limit 1
    ), review_actions as (
      select action.*
      from weekly_review_actions action
      join latest_review review on review.id = action.weekly_review_id
      order by action.due_date nulls last, action.id
    ), balances as (
      select movement.product_id, sum(movement.quantity)::integer as units
      from inventory_movements movement
      where movement.store_id = ${scope.store.id} and movement.business_date <= ${scope.to}::date
      group by movement.product_id
    ), low_stock as (
      select product.id, product.sku, product.name, balance.units
      from balances balance
      join products product on product.id = balance.product_id and product.active = true
      where balance.units <= 40
      order by balance.units, product.name
      limit 12
    ), customer_sources as (
      select interaction.source as name, count(*)::integer as value
      from customer_interactions interaction
      where interaction.store_id = ${scope.store.id}
        and interaction.business_date between ${scope.from}::date and ${scope.to}::date
      group by interaction.source
    ), customer_health as (
      select
        coalesce(sum(report.total_customers), 0)::integer as total,
        coalesce(sum(report.new_customers), 0)::integer as new_customers,
        coalesce(sum(report.returning_customers), 0)::integer as returning_customers
      from daily_reports report
      where report.store_id = ${scope.store.id}
        and report.status = 'approved'
        and report.business_date between ${scope.from}::date and ${scope.to}::date
    ), transfer_rows as (
      select
        transfer.id,
        transfer.business_date,
        case when transfer.from_store_id = ${scope.store.id} then 'outgoing' else 'incoming' end as direction,
        case when transfer.from_store_id = ${scope.store.id} then destination.name else source.name end as other_store,
        coalesce(sum(line.quantity), 0)::integer as units,
        transfer.status
      from stock_transfers transfer
      join stores source on source.id = transfer.from_store_id
      join stores destination on destination.id = transfer.to_store_id
      left join stock_transfer_lines line on line.stock_transfer_id = transfer.id
      where (transfer.from_store_id = ${scope.store.id} or transfer.to_store_id = ${scope.store.id})
        and transfer.business_date between ${scope.from}::date and ${scope.to}::date
      group by transfer.id, transfer.business_date, source.name, destination.name, transfer.status
      order by transfer.business_date desc, transfer.id desc
      limit 20
    )
    select jsonb_build_object(
      'recentReports', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', report.id,
          'businessDate', report.business_date,
          'status', report.status,
          'revenue', round(report.revenue, 2)::float8,
          'paymentVariance', round(report.payment_variance, 2)::float8
        ) order by report.business_date desc, report.id desc)
        from recent_reports report
      ), '[]'::jsonb),
      'weeklyReview', (
        select jsonb_build_object(
          'id', review.id,
          'weekEnd', review.week_end,
          'status', review.status,
          'risks', review.risks,
          'opportunities', review.opportunities,
          'differentThisWeek', review.different_this_week,
          'actions', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', action.id,
              'action', action.action,
              'owner', coalesce(owner.name, action.owner_name, 'Unassigned'),
              'dueDate', action.due_date,
              'status', action.status
            ) order by action.due_date nulls last, action.id)
            from review_actions action
            left join users owner on owner.id = action.owner_user_id
          ), '[]'::jsonb)
        )
        from latest_review review
      ),
      'lowStock', coalesce((
        select jsonb_agg(jsonb_build_object(
          'productId', item.id,
          'sku', item.sku,
          'name', item.name,
          'units', item.units
        ) order by item.units, item.name)
        from low_stock item
      ), '[]'::jsonb),
      'customerSources', coalesce((
        select jsonb_agg(jsonb_build_object('name', source.name, 'value', source.value) order by source.value desc, source.name)
        from customer_sources source
      ), '[]'::jsonb),
      'customerHealth', jsonb_build_object(
        'total', customer.total,
        'new', customer.new_customers,
        'returning', customer.returning_customers,
        'repeatRate', coalesce(round(100.0 * customer.returning_customers / nullif(customer.total, 0), 1), 0)::float8
      ),
      'transfers', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', item.id,
          'date', item.business_date,
          'direction', item.direction,
          'otherStore', item.other_store,
          'units', item.units,
          'status', item.status
        ) order by item.business_date desc, item.id desc)
        from transfer_rows item
      ), '[]'::jsonb)
    ) as data
    from customer_health customer
  `);

  return jsonResult<StoreDomain>(result);
}
