import { sql } from 'drizzle-orm';
import type { CommercialDomain } from '../contracts/analytics';
import { db } from '../db';
import type { AnalyticsScope } from './shared';
import { jsonResult } from './shared';

export async function getCommercialDomain(scope: AnalyticsScope): Promise<CommercialDomain> {
  const movementStore = scope.store ? sql`and movement.store_id = ${scope.store.id}` : sql``;
  const reviewStore = scope.store ? sql`and review.store_id = ${scope.store.id}` : sql``;
  const interactionStore = scope.store ? sql`and interaction.store_id = ${scope.store.id}` : sql``;
  const actionStore = scope.store ? sql`and action.store_id = ${scope.store.id}` : sql``;
  const receiptStore = scope.store ? sql`and receipt.receiving_store_id = ${scope.store.id}` : sql``;
  const useGroupInsights = scope.store ? sql`false` : sql`true`;

  const result = await db.execute(sql`
    with product_balance as (
      select movement.product_id, sum(movement.quantity) as units, max(movement.business_date) as last_movement
      from inventory_movements movement
      join stores store on store.id = movement.store_id and store.type = 'store'
      where movement.business_date <= ${scope.to}::date ${movementStore}
      group by movement.product_id
    ), product_sales as (
      select movement.product_id, -sum(movement.quantity) as units_sold
      from inventory_movements movement
      join stores store on store.id = movement.store_id and store.type = 'store'
      where movement.movement_type = 'sale'
        and movement.business_date between ${scope.from}::date and ${scope.to}::date
        ${movementStore}
      group by movement.product_id
    ), product_rows as (
      select
        product.id,
        product.sku,
        product.name,
        brand.name as brand_name,
        category.name as category_name,
        coalesce(sales.units_sold, insight_metrics.units_sold, 0) as units_sold,
        coalesce(balance.units, insight_metrics.current_stock, 0) as stock,
        coalesce(balance.units, insight_metrics.current_stock, 0) * coalesce(product.unit_cost, 0) as stock_value,
        coalesce((${scope.to}::date - balance.last_movement)::integer, insight_metrics.days_in_stock) as days_since_movement,
        insight.status,
        insight.performance,
        insight.campaign,
        insight.insight
      from products product
      join brands brand on brand.id = product.brand_id
      join categories category on category.id = product.category_id
      left join product_balance balance on balance.product_id = product.id
      left join product_sales sales on sales.product_id = product.id
      left join lateral (
        select product_insight.status, product_insight.performance, product_insight.campaign, product_insight.insight
        from product_insights product_insight
        where product_insight.product_id = product.id and product_insight.period_start <= ${scope.to}::date
        order by product_insight.period_end desc, product_insight.id desc
        limit 1
      ) insight on ${useGroupInsights}
      left join lateral (
        select product_insight.units_sold, product_insight.current_stock, product_insight.days_in_stock
        from product_insights product_insight
        where product_insight.product_id = product.id
          and product_insight.period_start <= ${scope.to}::date
          and product_insight.period_end >= ${scope.from}::date
        order by product_insight.period_end desc, product_insight.id desc
        limit 1
      ) insight_metrics on ${useGroupInsights}
      where product.active = true and (
        coalesce(sales.units_sold, insight_metrics.units_sold, 0) > 0 or
        coalesce(balance.units, insight_metrics.current_stock, 0) > 0 or insight.status is not null
      )
      order by coalesce(sales.units_sold, insight_metrics.units_sold, 0) desc, stock_value desc
      limit 15
    ), review_rows as (
      select
        review.id,
        review.lock_version,
        store.name as store_name,
        submitter.name as manager_name,
        review.week_end,
        review.status,
        review.summary,
        review.risks,
        review.opportunities,
        amplify.name as marketing_amplify,
        review.different_this_week,
        review.first_three_actions,
        count(action.id)::integer as action_count,
        coalesce(trading.actual_revenue, 0) as actual_revenue,
        coalesce(target.target_revenue, 0) as target_revenue,
        coalesce(risk.stock_at_risk, 0) as stock_at_risk,
        coalesce(risk.at_risk_categories, 0)::integer as at_risk_categories
      from weekly_reviews review
      join stores store on store.id = review.store_id
      join users submitter on submitter.id = review.submitted_by_user_id
      left join categories amplify on amplify.id = review.marketing_amplify_category_id
      left join weekly_review_actions action on action.weekly_review_id = review.id
      left join lateral (
        select sum(line.gross_revenue - line.discounts - line.returns) as actual_revenue
        from daily_reports report
        join daily_sales_lines line on line.daily_report_id = report.id
        where report.status = 'approved'
          and report.store_id = review.store_id
          and report.business_date between review.week_end - 6 and review.week_end
      ) trading on true
      left join lateral (
        select sum(
          target.value *
          ((least(target.period_end, review.week_end) - greatest(target.period_start, review.week_end - 6)) + 1)::numeric /
          ((target.period_end - target.period_start) + 1)::numeric
        ) as target_revenue
        from performance_targets target
        where target.metric = 'net-revenue'
          and target.scope_type = 'store'
          and target.store_id = review.store_id
          and target.period_start <= review.week_end
          and target.period_end >= review.week_end - 6
      ) target on true
      left join lateral (
        select sum(note.value_at_risk) as stock_at_risk,
          count(*) filter (where note.overstocked or note.slow_moving or coalesce(note.value_at_risk, 0) > 0) as at_risk_categories
        from weekly_review_category_notes note
        where note.weekly_review_id = review.id
      ) risk on true
      where review.week_end between ${scope.compareFrom}::date and ${scope.to}::date ${reviewStore}
      group by review.id, store.name, submitter.name, amplify.name, trading.actual_revenue, target.target_revenue, risk.stock_at_risk, risk.at_risk_categories
      order by review.week_end desc, store.name
      limit 16
    ), funnel as (
      select
        count(*) filter (where interaction.lifecycle = 'lead')::integer as leads,
        count(*) filter (where interaction.lifecycle = 'buyer')::integer as buyers
      from customer_interactions interaction
      where interaction.business_date between ${scope.from}::date and ${scope.to}::date ${interactionStore}
    ), source_rows as (
      select interaction.source as name, count(*)::integer as value
      from customer_interactions interaction
      where interaction.business_date between ${scope.from}::date and ${scope.to}::date ${interactionStore}
      group by interaction.source
    ), category_target_rows as (
      select
        category.id,
        category.name,
        coalesce(sum(target.value *
          ((least(target.period_end, ${scope.to}::date) - greatest(target.period_start, ${scope.from}::date)) + 1)::numeric /
          ((target.period_end - target.period_start) + 1)::numeric
        ), 0) as target_revenue,
        coalesce(actual.revenue, 0) as actual_revenue
      from categories category
      left join performance_targets target
        on target.category_id = category.id
       and target.metric = 'net-revenue'
       and target.scope_type = 'category'
       and target.period_start <= ${scope.to}::date
       and target.period_end >= ${scope.from}::date
      left join lateral (
        select sum(line.gross_revenue - line.discounts - line.returns) as revenue
        from daily_sales_lines line
        join daily_reports report on report.id = line.daily_report_id and report.status = 'approved'
        where line.category_id = category.id
          and report.business_date between ${scope.from}::date and ${scope.to}::date
          ${scope.store ? sql`and report.store_id = ${scope.store.id}` : sql``}
      ) actual on true
      where category.active = true
      group by category.id, category.name, actual.revenue
    ), action_rows as (
      select
        action.id,
        action.department,
        action.title,
        action.detail,
        action.priority,
        action.status,
        action.due_date,
        store.name as store_name,
        coalesce(owner.name, action.owner_name, 'Unassigned') as owner_name
      from action_items action
      left join stores store on store.id = action.store_id
      left join users owner on owner.id = action.owner_user_id
      where action.department = 'commercial' and action.status <> 'cancelled' ${actionStore}
      order by action.due_date nulls last, action.id desc
      limit 20
    ), arrival_rows as (
      select
        receipt.id,
        receipt.business_date,
        brand.name as brand_name,
        category.name as category_name,
        sum(line.quantity)::integer as units,
        sum(line.quantity * coalesce(line.unit_cost, product.unit_cost, 0)) as value,
        store.name as store_name,
        supplier.name as supplier_name
      from goods_receipts receipt
      join goods_receipt_lines line on line.goods_receipt_id = receipt.id
      join products product on product.id = line.product_id
      join brands brand on brand.id = product.brand_id
      join categories category on category.id = product.category_id
      join stores store on store.id = receipt.receiving_store_id
      join suppliers supplier on supplier.id = receipt.supplier_id
      where receipt.status = 'received'
        and receipt.business_date between ${scope.from}::date and ${scope.to}::date ${receiptStore}
      group by receipt.id, receipt.business_date, brand.name, category.name, store.name, supplier.name
      order by receipt.business_date desc, receipt.id desc
      limit 20
    ), deployment_rows as (
      select store.name, sum(movement.quantity)::integer as value
      from inventory_movements movement
      join stores store on store.id = movement.store_id
      where movement.movement_type in ('receipt', 'transfer-in')
        and movement.business_date between ${scope.from}::date and ${scope.to}::date ${movementStore}
      group by store.id, store.name
    ), customer_rows as (
      select
        interaction.id,
        interaction.business_date,
        customer.name,
        customer.phone,
        interaction.lifecycle,
        interaction.source,
        coalesce(product.name, interaction.interest_text) as interest,
        store.name as store_name,
        staff.name as staff_name
      from customer_interactions interaction
      join customers customer on customer.id = interaction.customer_id
      join stores store on store.id = interaction.store_id
      join users staff on staff.id = interaction.captured_by_user_id
      left join products product on product.id = interaction.product_id
      where interaction.business_date between ${scope.from}::date and ${scope.to}::date ${interactionStore}
      order by interaction.business_date desc, interaction.id desc
      limit 30
    )
    select jsonb_build_object(
      'customerFunnel', jsonb_build_object(
        'leads', funnel.leads,
        'buyers', funnel.buyers,
        'sources', coalesce((
          select jsonb_agg(jsonb_build_object('name', source.name, 'value', source.value) order by source.value desc, source.name)
          from source_rows source
        ), '[]'::jsonb)
      ),
      'productVelocity', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', product.id,
          'sku', product.sku,
          'name', product.name,
          'brandName', product.brand_name,
          'categoryName', product.category_name,
          'unitsSold', product.units_sold::integer,
          'stock', product.stock::integer,
          'stockValue', round(product.stock_value, 2)::float8,
          'daysSinceMovement', product.days_since_movement,
          'status', product.status,
          'performance', product.performance,
          'campaign', product.campaign,
          'insight', product.insight
        ) order by product.units_sold desc, product.stock_value desc)
        from product_rows product
      ), '[]'::jsonb),
      'weeklyReviews', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', review.id,
          'lockVersion', review.lock_version,
          'storeName', review.store_name,
          'managerName', review.manager_name,
          'weekEnd', review.week_end,
          'status', review.status,
          'summary', review.summary,
          'risks', review.risks,
          'opportunities', review.opportunities,
          'differentThisWeek', review.different_this_week,
          'firstThreeActions', review.first_three_actions,
          'actionCount', review.action_count,
          'actualRevenue', round(review.actual_revenue, 2)::float8,
          'targetRevenue', round(review.target_revenue, 2)::float8,
          'achievement', coalesce(round(100 * review.actual_revenue / nullif(review.target_revenue, 0), 1), 0)::float8,
          'stockAtRisk', round(review.stock_at_risk, 2)::float8,
          'atRiskCategories', review.at_risk_categories
        ) order by review.week_end desc, review.store_name)
        from review_rows review
      ), '[]'::jsonb),
      'managerVoices', coalesce((
        select jsonb_agg(jsonb_build_object(
          'reviewId', review.id,
          'storeName', review.store_name,
          'managerName', review.manager_name,
          'weekEnd', review.week_end,
          'marketingAmplify', review.marketing_amplify,
          'differentThisWeek', review.different_this_week,
          'firstThreeActions', review.first_three_actions
        ) order by review.week_end desc, review.store_name)
        from (
          select distinct on (store_name) * from review_rows
          order by store_name, week_end desc, id desc
        ) review
        where review.marketing_amplify is not null or review.different_this_week is not null or review.first_three_actions is not null
      ), '[]'::jsonb),
      'categoryTargets', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', item.id,
          'name', item.name,
          'targetRevenue', round(item.target_revenue, 2)::float8,
          'actualRevenue', round(item.actual_revenue, 2)::float8,
          'attainment', coalesce(round(100 * item.actual_revenue / nullif(item.target_revenue, 0), 1), 0)::float8
        ) order by item.target_revenue desc, item.name)
        from category_target_rows item
        where item.target_revenue > 0 or item.actual_revenue > 0
      ), '[]'::jsonb),
      'achievementTrend', coalesce((
        select jsonb_agg(jsonb_build_object(
          'weekEnd', item.week_end,
          'attainment', item.attainment
        ) order by item.week_end)
        from (
          select week.date as week_end,
            coalesce(round(100 * sum(review.actual_revenue) / nullif(sum(review.target_revenue), 0), 1), 0)::float8 as attainment
          from (
            select generate_series(${scope.compareFrom}::date, ${scope.to}::date, interval '1 week')::date as date
            where exists (select 1 from review_rows)
          ) week
          left join review_rows review on review.week_end = week.date
          group by week.date
        ) item
      ), '[]'::jsonb),
      'actions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', action.id,
          'department', action.department,
          'title', action.title,
          'detail', action.detail,
          'priority', action.priority,
          'status', action.status,
          'dueDate', action.due_date,
          'storeName', action.store_name,
          'ownerName', action.owner_name
        ) order by action.due_date nulls last, action.id desc)
        from action_rows action
      ), '[]'::jsonb),
      'newArrivals', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', item.id,
          'date', item.business_date,
          'brandName', item.brand_name,
          'categoryName', item.category_name,
          'units', item.units,
          'value', round(item.value, 2)::float8,
          'storeName', item.store_name,
          'supplierName', item.supplier_name
        ) order by item.business_date desc, item.id desc)
        from arrival_rows item
      ), '[]'::jsonb),
      'deploymentByStore', coalesce((
        select jsonb_agg(jsonb_build_object('name', item.name, 'value', item.value) order by item.value desc, item.name)
        from deployment_rows item
      ), '[]'::jsonb),
      'customers', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', customer.id,
          'date', customer.business_date,
          'name', customer.name,
          'phone', customer.phone,
          'lifecycle', customer.lifecycle,
          'source', customer.source,
          'interest', customer.interest,
          'storeName', customer.store_name,
          'staffName', customer.staff_name
        ) order by customer.business_date desc, customer.id desc)
        from customer_rows customer
      ), '[]'::jsonb)
    ) as data
    from funnel
  `);

  return jsonResult<CommercialDomain>(result);
}
