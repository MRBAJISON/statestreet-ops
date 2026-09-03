import { sql } from 'drizzle-orm';
import type { TradingOverview } from '../contracts/analytics';
import { db } from '../db';
import type { AnalyticsScope } from './shared';
import { jsonResult } from './shared';
import { isTradingDay, targetIsEffectiveForDate, targetPerTradingDayForDate, targetWithinWindowForRecord } from './trading-days';

export async function getTradingOverview(scope: AnalyticsScope): Promise<TradingOverview> {
  const trendByMonth = scope.preset === 'ytd';
  const reportStore = scope.store ? sql`and report.store_id = ${scope.store.id}` : sql``;
  const targetStore = scope.store ? sql`and target.store_id = ${scope.store.id}` : sql``;
  const expenseStore = scope.store ? sql`and expense.store_id = ${scope.store.id}` : sql``;
  const inventoryStore = scope.store ? sql`and movement.store_id = ${scope.store.id}` : sql``;
  const feedbackStore = scope.store ? sql`and feedback.store_id = ${scope.store.id}` : sql``;
  const actionStore = scope.store ? sql`and action.store_id = ${scope.store.id}` : sql``;
  const eligibleStore = scope.store ? sql`and store.id = ${scope.store.id}` : sql``;
  const manualCashFilter = scope.store ? sql`and false` : sql``;

  const result = await db.execute(sql`
    with report_line_totals as (
      select
        report.id,
        report.store_id,
        report.business_date,
        report.transactions,
        report.footfall,
        sum(line.gross_revenue - line.discounts - line.returns) as revenue,
        sum(line.cogs) as cogs,
        sum(line.units_sold) as units,
        sum(line.opening_stock) as opening_stock
      from daily_reports report
      join stores store on store.id = report.store_id and store.type = 'store'
      join daily_sales_lines line on line.daily_report_id = report.id
      where report.status = 'approved'
        and report.business_date between ${scope.compareFrom}::date and ${scope.to}::date
        ${reportStore}
      group by report.id, report.store_id, report.business_date, report.transactions, report.footfall
    ), report_payment_totals as (
      select payment.daily_report_id, sum(payment.amount) as payments
      from daily_payment_lines payment
      join daily_reports report on report.id = payment.daily_report_id
      where report.status = 'approved'
        and report.business_date between ${scope.compareFrom}::date and ${scope.to}::date
        ${reportStore}
      group by payment.daily_report_id
    ), report_facts as (
      select line.*, coalesce(payment.payments, 0) as payments
      from report_line_totals line
      left join report_payment_totals payment on payment.daily_report_id = line.id
    ), current_trade as (
      select * from report_facts where business_date between ${scope.from}::date and ${scope.to}::date
    ), previous_trade as (
      select * from report_facts where business_date between ${scope.compareFrom}::date and ${scope.compareTo}::date
    ), current_expenses as (
      select
        coalesce(sum(expense.amount), 0) as value,
        coalesce(sum(expense.amount) filter (where category."group" = 'operating'), 0) as operating
      from expenses expense
      join expense_categories category on category.id = expense.expense_category_id
      where expense.business_date between ${scope.from}::date and ${scope.to}::date
        ${expenseStore}
    ), previous_expenses as (
      select
        coalesce(sum(expense.amount), 0) as value,
        coalesce(sum(expense.amount) filter (where category."group" = 'operating'), 0) as operating
      from expenses expense
      join expense_categories category on category.id = expense.expense_category_id
      where expense.business_date between ${scope.compareFrom}::date and ${scope.compareTo}::date
        ${expenseStore}
    ), current_manual_cash as (
      select
        coalesce(sum(transaction.amount) filter (where transaction.direction = 'inflow'), 0) as inflow,
        coalesce(sum(transaction.amount) filter (where transaction.direction = 'outflow'), 0) as outflow
      from cash_transactions transaction
      where transaction.business_date between ${scope.from}::date and ${scope.to}::date
        ${manualCashFilter}
    ), current_summary as (
      select
        coalesce(sum(revenue), 0) as revenue,
        coalesce(sum(cogs), 0) as cogs,
        coalesce(sum(revenue - cogs), 0) as gross_profit,
        coalesce(sum(units), 0) as units,
        coalesce(sum(opening_stock), 0) as opening_stock,
        coalesce(sum(transactions), 0) as transactions,
        coalesce(sum(footfall), 0) as footfall,
        coalesce(sum(payments), 0) as payments
      from current_trade
    ), previous_summary as (
      select
        coalesce(sum(revenue), 0) as revenue,
        coalesce(sum(cogs), 0) as cogs,
        coalesce(sum(revenue - cogs), 0) as gross_profit,
        coalesce(sum(units), 0) as units,
        coalesce(sum(opening_stock), 0) as opening_stock,
        coalesce(sum(transactions), 0) as transactions,
        coalesce(sum(footfall), 0) as footfall
      from previous_trade
    ), target_dates as (
      select generated.date::date
      from generate_series(${scope.from}::date, ${scope.to}::date, interval '1 day') generated(date)
      where ${isTradingDay(sql`generated.date`)}
    ), target_by_store as (
      select
        target.store_id,
        sum(
          ${targetWithinWindowForRecord(
            sql`target.value`,
            sql`target.period_type`,
            sql`target.recurring`,
            sql`target.period_start`,
            sql`target.period_end`,
            sql`${scope.from}::date`,
            sql`${scope.to}::date`
          )}
        ) as value
      from performance_targets target
      where target.metric = 'net-revenue'
        and target.scope_type = 'store'
        and target.period_start <= ${scope.to}::date
        and target.period_end >= ${scope.from}::date
        ${targetStore}
      group by target.store_id
    ), standard_scores as (
      select
        review.store_id,
        avg(review.operations_score) as operations,
        avg(review.vm_score) as vm
      from store_standard_reviews review
      where review.business_date between ${scope.from}::date and ${scope.to}::date
      group by review.store_id
    ), eligible_stores as (
      select store.id, store.code, store.name, assignment.brand_name
      from stores store
      left join lateral (
        select case when count(brand.id) = 1 then min(brand.name) else null end as brand_name
        from brand_stores brand_store
        join brands brand on brand.id = brand_store.brand_id and brand.active = true
        where brand_store.store_id = store.id
      ) assignment on true
      where store.active = true and store.type = 'store' ${eligibleStore}
    ), store_rows as (
      select
        store.id,
        store.code,
        store.name,
        store.brand_name,
        coalesce(sum(trade.revenue), 0) as revenue,
        coalesce(sum(trade.revenue - trade.cogs), 0) as gross_profit,
        coalesce(sum(trade.transactions), 0) as transactions,
        coalesce(sum(trade.footfall), 0) as footfall,
        coalesce(target.value, 0) as target,
        coalesce(standard.operations, 0) as operations,
        coalesce(standard.vm, 0) as vm
      from eligible_stores store
      left join current_trade trade on trade.store_id = store.id
      left join target_by_store target on target.store_id = store.id
      left join standard_scores standard on standard.store_id = store.id
      group by store.id, store.code, store.name, store.brand_name, target.value, standard.operations, standard.vm
    ), trend_range as (
      select coalesce(
        (
          select max(complete_day.business_date)
          from (
            select trade.business_date
            from current_trade trade
            group by trade.business_date
            having count(distinct trade.store_id) >= greatest(
              1,
              ceil((select count(*) from eligible_stores) * 0.8)::integer
            )
          ) complete_day
        ),
        (select max(trade.business_date) from current_trade trade)
      ) as end_date
    ), dates as (
      select generated.date::date
      from trend_range range
      cross join lateral generate_series(${scope.from}::date, range.end_date, interval '1 day') generated(date)
      where range.end_date is not null
    ), effective_daily_target as (
      select
        date.date,
        coalesce(
          case when ${scope.store === null}::boolean then
            sum(${targetPerTradingDayForDate(sql`target.value`, sql`target.period_type`, sql`target.recurring`, sql`date.date`, sql`target.period_start`, sql`target.period_end`)})
              filter (where target.scope_type = 'group')
          end,
          sum(${targetPerTradingDayForDate(sql`target.value`, sql`target.period_type`, sql`target.recurring`, sql`date.date`, sql`target.period_start`, sql`target.period_end`)})
            filter (where target.scope_type = 'store'),
          0
        ) as value
      from target_dates date
      left join performance_targets target
        on target.metric = 'net-revenue'
       and (
         (target.scope_type = 'group' and ${scope.store === null}::boolean)
         or (target.scope_type = 'store' ${targetStore})
       )
       and date.date between target.period_start and target.period_end
       and ${targetIsEffectiveForDate(sql`date.date`)}
      group by date.date
    ), effective_target as (
      select coalesce(sum(value), 0) as value from effective_daily_target
    ), daily_target as (
      select date.date, coalesce(target.value, 0) as value
      from dates date
      left join effective_daily_target target on target.date = date.date
    ), trend_rows as (
      select
        date.date,
        coalesce(sum(trade.revenue), 0) as revenue,
        coalesce(sum(trade.revenue - trade.cogs), 0) as gross_profit,
        coalesce(target.value, 0) as target
      from dates date
      left join current_trade trade on trade.business_date = date.date
      left join daily_target target on target.date = date.date
      group by date.date, target.value
    ), category_rows as (
      select
        category.id,
        category.name,
        coalesce(sum(line.gross_revenue - line.discounts - line.returns)
          filter (where report.business_date between ${scope.from}::date and ${scope.to}::date), 0) as revenue,
        coalesce(sum(line.gross_revenue - line.discounts - line.returns)
          filter (where report.business_date between ${scope.compareFrom}::date and ${scope.compareTo}::date), 0) as previous_revenue,
        coalesce(sum(line.units_sold)
          filter (where report.business_date between ${scope.from}::date and ${scope.to}::date), 0) as units,
        coalesce(sum(line.opening_stock)
          filter (where report.business_date between ${scope.from}::date and ${scope.to}::date), 0) as opening_stock
      from daily_sales_lines line
      join daily_reports report on report.id = line.daily_report_id and report.status = 'approved'
      join categories category on category.id = line.category_id
      where report.business_date between ${scope.compareFrom}::date and ${scope.to}::date
        ${reportStore}
      group by category.id, category.name
    ), payment_rows as (
      select method.name, sum(payment.amount) as value
      from daily_payment_lines payment
      join payment_methods method on method.id = payment.payment_method_id
      join daily_reports report on report.id = payment.daily_report_id and report.status = 'approved'
      where report.business_date between ${scope.from}::date and ${scope.to}::date
        ${reportStore}
      group by method.id, method.name
    ), brand_rows as (
      select coalesce(store.brand_name, 'Unassigned') as name, sum(store.revenue) as value
      from store_rows store
      group by coalesce(store.brand_name, 'Unassigned')
    ), inventory_value as (
      select coalesce(sum(balance.quantity * coalesce(product.unit_cost, 0)), 0) as value
      from (
        select movement.product_id, movement.store_id, sum(movement.quantity) as quantity
        from inventory_movements movement
        where movement.business_date <= ${scope.to}::date ${inventoryStore}
        group by movement.product_id, movement.store_id
      ) balance
      join products product on product.id = balance.product_id
    ), nps_value as (
      select case when count(feedback.nps_score) = 0 then null else
        round(
          100.0 * (
            count(*) filter (where feedback.nps_score >= 9) -
            count(*) filter (where feedback.nps_score <= 6)
          ) / count(feedback.nps_score),
          1
        )
      end as value
      from customer_feedback feedback
      where feedback.business_date between ${scope.from}::date and ${scope.to}::date
        and feedback.nps_score is not null
        ${feedbackStore}
    ), report_status as (
      select
        count(*) filter (where report.status = 'draft')::integer as draft,
        count(*) filter (where report.status = 'submitted')::integer as submitted,
        count(*) filter (where report.status = 'approved')::integer as approved
      from daily_reports report
      join stores store on store.id = report.store_id and store.type = 'store'
      where report.business_date between ${scope.from}::date and ${scope.to}::date ${reportStore}
    ), open_action_count as (
      select count(*)::integer as value
      from action_items action
      where action.status in ('open', 'in-progress', 'blocked') ${actionStore}
    )
    select jsonb_build_object(
      'summary', jsonb_build_object(
        'netRevenue', round(current.revenue, 2)::float8,
        'previousNetRevenue', round(previous.revenue, 2)::float8,
        'targetRevenue', round((select value from effective_target), 2)::float8,
        'cogs', round(current.cogs, 2)::float8,
        'grossProfit', round(current.gross_profit, 2)::float8,
        'previousGrossProfit', round(previous.gross_profit, 2)::float8,
        'operatingProfit', round(current.gross_profit - expense.operating, 2)::float8,
        'previousOperatingProfit', round(previous.gross_profit - previous_expense.operating, 2)::float8,
        'netProfit', round(current.gross_profit - expense.value, 2)::float8,
        'grossMargin', coalesce(round(100 * current.gross_profit / nullif(current.revenue, 0), 1), 0)::float8,
        'previousGrossMargin', coalesce(round(100 * previous.gross_profit / nullif(previous.revenue, 0), 1), 0)::float8,
        'operatingMargin', coalesce(round(100 * (current.gross_profit - expense.operating) / nullif(current.revenue, 0), 1), 0)::float8,
        'netMargin', coalesce(round(100 * (current.gross_profit - expense.value) / nullif(current.revenue, 0), 1), 0)::float8,
        'sellThrough', coalesce(round(100.0 * current.units / nullif(current.opening_stock, 0), 1), 0)::float8,
        'conversionRate', coalesce(round(100.0 * current.transactions / nullif(current.footfall, 0), 1), 0)::float8,
        'previousConversionRate', coalesce(round(100.0 * previous.transactions / nullif(previous.footfall, 0), 1), 0)::float8,
        'averageTransactionValue', coalesce(round(current.revenue / nullif(current.transactions, 0), 2), 0)::float8,
        'previousAverageTransactionValue', coalesce(round(previous.revenue / nullif(previous.transactions, 0), 2), 0)::float8,
        'unitsSold', current.units::integer,
        'transactions', current.transactions::integer,
        'footfall', current.footfall::integer,
        'expenses', round(expense.value, 2)::float8,
        'netCashFlow', round(current.payments + cash.inflow - cash.outflow - expense.value, 2)::float8,
        'inventoryValue', round(inventory.value, 2)::float8,
        'nps', (select value::float8 from nps_value),
        'openActions', actions.value
      ),
      'trend', coalesce((
        select jsonb_agg(jsonb_build_object(
          'date', trend.date,
          'revenue', round(trend.revenue, 2)::float8,
          'target', round(trend.target, 2)::float8,
          'grossProfit', round(trend.gross_profit, 2)::float8
        ) order by trend.date)
        from (${trendByMonth ? sql`
          select date_trunc('month', trend.date)::date as date,
            sum(trend.revenue) as revenue,
            sum(trend.target) as target,
            sum(trend.gross_profit) as gross_profit
          from trend_rows trend
          group by date_trunc('month', trend.date)::date
        ` : sql`
          select trend.date, trend.revenue, trend.target, trend.gross_profit
          from trend_rows trend
        `}) trend
      ), '[]'::jsonb),
      'stores', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', store.id,
          'code', store.code,
          'name', store.name,
          'brandName', store.brand_name,
          'revenue', round(store.revenue, 2)::float8,
          'target', round(store.target, 2)::float8,
          'attainment', round(100 * store.revenue / nullif(store.target, 0), 1)::float8,
          'grossMargin', round(100 * store.gross_profit / nullif(store.revenue, 0), 1)::float8,
          'conversionRate', round(100.0 * store.transactions / nullif(store.footfall, 0), 1)::float8,
          'transactions', store.transactions::integer,
          'operationsScore', round(store.operations, 1)::float8,
          'visualMerchandisingScore', round(store.vm, 1)::float8
        ) order by store.revenue desc, store.name)
        from store_rows store
      ), '[]'::jsonb),
      'categories', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', category.id,
          'name', category.name,
          'revenue', round(category.revenue, 2)::float8,
          'previousRevenue', round(category.previous_revenue, 2)::float8,
          'units', category.units::integer,
          'openingStock', category.opening_stock::integer,
          'sellThrough', coalesce(round(100.0 * category.units / nullif(category.opening_stock, 0), 1), 0)::float8,
          'share', round(100 * category.revenue / nullif(current.revenue, 0), 1)::float8
        ) order by category.revenue desc, category.name)
        from category_rows category
        where category.revenue > 0 or category.previous_revenue > 0
      ), '[]'::jsonb),
      'brands', coalesce((
        select jsonb_agg(jsonb_build_object(
          'name', brand.name,
          'value', round(brand.value, 2)::float8
        ) order by brand.value desc, brand.name)
        from brand_rows brand
        where brand.value > 0
      ), '[]'::jsonb),
      'payments', coalesce((
        select jsonb_agg(jsonb_build_object(
          'name', payment.name,
          'value', round(payment.value, 2)::float8
        ) order by payment.value desc, payment.name)
        from payment_rows payment
      ), '[]'::jsonb),
      'attention', coalesce((
        select jsonb_agg(to_jsonb(attention) order by attention.priority_rank, attention.due_date nulls last)
        from (
          select
            action.id,
            action.department,
            action.title,
            action.detail,
            action.priority,
            action.status,
            action.due_date as "dueDate",
            store.name as "storeName",
            coalesce(owner.name, action.owner_name, 'Unassigned') as "ownerName",
            case action.priority when 'critical' then 1 when 'high' then 2 when 'medium' then 3 else 4 end as priority_rank,
            action.due_date
          from action_items action
          left join stores store on store.id = action.store_id
          left join users owner on owner.id = action.owner_user_id
          where action.status in ('open', 'in-progress', 'blocked') ${actionStore}
          order by priority_rank, action.due_date nulls last
          limit 8
        ) attention
      ), '[]'::jsonb),
      'actions', coalesce((
        select jsonb_agg(to_jsonb(item) order by item.priority_rank, item.due_date nulls last)
        from (
          select
            action.id,
            action.department,
            action.title,
            action.detail,
            action.priority,
            action.status,
            action.due_date as "dueDate",
            store.name as "storeName",
            coalesce(owner.name, action.owner_name, 'Unassigned') as "ownerName",
            case action.priority when 'critical' then 1 when 'high' then 2 when 'medium' then 3 else 4 end as priority_rank,
            action.due_date
          from action_items action
          left join stores store on store.id = action.store_id
          left join users owner on owner.id = action.owner_user_id
          where action.status not in ('cancelled') ${actionStore}
          order by priority_rank, action.due_date nulls last
          limit 30
        ) item
      ), '[]'::jsonb),
      'reportStatus', jsonb_build_object(
        'draft', status.draft,
        'submitted', status.submitted,
        'approved', status.approved
      )
    ) as data
    from current_summary current
    cross join previous_summary previous
    cross join current_expenses expense
    cross join previous_expenses previous_expense
    cross join current_manual_cash cash
    cross join inventory_value inventory
    cross join report_status status
    cross join open_action_count actions
  `);

  return jsonResult<TradingOverview>(result);
}
