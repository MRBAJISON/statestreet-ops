import { sql } from 'drizzle-orm';
import type { FinanceDomain } from '../contracts/analytics';
import { db } from '../db';
import type { AnalyticsScope } from './shared';
import { jsonResult } from './shared';

export async function getFinanceDomain(scope: AnalyticsScope): Promise<FinanceDomain> {
  const expenseStore = scope.store ? sql`and expense.store_id = ${scope.store.id}` : sql``;
  const reportStore = scope.store ? sql`and report.store_id = ${scope.store.id}` : sql``;
  const budgetScope = scope.store
    ? sql`and budget.store_id = ${scope.store.id}`
    : sql`and (
        budget.store_id is null
        or not exists (
          select 1 from budgets group_budget
          where group_budget.year = budget.year
            and group_budget.expense_category_id = budget.expense_category_id
            and group_budget.store_id is null
        )
      )`;
  const manualCashFilter = scope.store ? sql`and false` : sql``;

  const result = await db.execute(sql`
    with expense_actuals as (
      select expense.expense_category_id, sum(expense.amount) as actual
      from expenses expense
      where expense.business_date between ${scope.from}::date and ${scope.to}::date ${expenseStore}
      group by expense.expense_category_id
    ), prorated_budgets as (
      select
        budget.expense_category_id,
        sum(
          budget.amount *
          greatest(
            0,
            (least(${scope.to}::date, make_date(budget.year, 12, 31)) -
             greatest(${scope.from}::date, make_date(budget.year, 1, 1))) + 1
          )::numeric /
          ((make_date(budget.year, 12, 31) - make_date(budget.year, 1, 1)) + 1)::numeric
        ) as budget
      from budgets budget
      where budget.year between extract(year from ${scope.from}::date)::integer and extract(year from ${scope.to}::date)::integer
        ${budgetScope}
      group by budget.expense_category_id
    ), category_rows as (
      select
        category.id,
        category.name,
        category."group",
        coalesce(budget.budget, 0) as budget,
        coalesce(actual.actual, 0) as actual
      from expense_categories category
      left join prorated_budgets budget on budget.expense_category_id = category.id
      left join expense_actuals actual on actual.expense_category_id = category.id
      where category.active = true
        and (coalesce(budget.budget, 0) > 0 or coalesce(actual.actual, 0) > 0)
    ), dates as (
      select generate_series(${scope.from}::date, ${scope.to}::date, interval '1 day')::date as date
    ), payment_cash as (
      select report.business_date as date, sum(payment.amount) as value
      from daily_payment_lines payment
      join daily_reports report on report.id = payment.daily_report_id and report.status = 'approved'
      where report.business_date between ${scope.from}::date and ${scope.to}::date ${reportStore}
      group by report.business_date
    ), expense_cash as (
      select expense.business_date as date, sum(expense.amount) as value
      from expenses expense
      where expense.business_date between ${scope.from}::date and ${scope.to}::date ${expenseStore}
      group by expense.business_date
    ), manual_cash as (
      select
        transaction.business_date as date,
        sum(transaction.amount) filter (where transaction.direction = 'inflow') as inflow,
        sum(transaction.amount) filter (where transaction.direction = 'outflow') as outflow
      from cash_transactions transaction
      where transaction.business_date between ${scope.from}::date and ${scope.to}::date ${manualCashFilter}
      group by transaction.business_date
    ), cash_rows as (
      select
        date.date,
        coalesce(payment.value, 0) + coalesce(manual.inflow, 0) as inflow,
        coalesce(expense.value, 0) + coalesce(manual.outflow, 0) as outflow
      from dates date
      left join payment_cash payment on payment.date = date.date
      left join expense_cash expense on expense.date = date.date
      left join manual_cash manual on manual.date = date.date
    ), account_rows as (
      select
        account.id,
        account.name,
        account.type,
        coalesce(sum(case when transaction.direction = 'inflow' then transaction.amount else -transaction.amount end), 0) as balance
      from cash_accounts account
      left join cash_transactions transaction
        on transaction.cash_account_id = account.id and transaction.business_date <= ${scope.to}::date ${manualCashFilter}
      where account.active = true
      group by account.id, account.name, account.type
    ), working_summary as (
      select
        coalesce(sum(item.open_amount) filter (where item.type = 'debtor' and item.status in ('open', 'partial')), 0) as debtors,
        coalesce(sum(item.open_amount) filter (where item.type = 'creditor' and item.status in ('open', 'partial')), 0) as creditors,
        coalesce(sum(item.open_amount) filter (
          where item.status in ('open', 'partial') and item.due_date < ${scope.to}::date
        ), 0) as overdue
      from working_capital_items item
    ), revenue_summary as (
      select
        coalesce(sum(line.gross_revenue - line.discounts - line.returns), 0) as revenue,
        coalesce(sum(line.cogs), 0) as cogs
      from daily_sales_lines line
      join daily_reports report on report.id = line.daily_report_id and report.status = 'approved'
      where report.business_date between ${scope.from}::date and ${scope.to}::date ${reportStore}
    ), expense_summary as (
      select
        coalesce(sum(expense.amount), 0) as total,
        coalesce(sum(expense.amount) filter (where category."group" = 'operating'), 0) as operating
      from expenses expense
      join expense_categories category on category.id = expense.expense_category_id
      where expense.business_date between ${scope.from}::date and ${scope.to}::date ${expenseStore}
    ), capital_latest as (
      select snapshot.capital_employed, snapshot.total_investment
      from capital_snapshots snapshot
      where snapshot.year <= extract(year from ${scope.to}::date)::integer
      order by snapshot.year desc
      limit 1
    ), store_revenue as (
      select report.store_id, sum(line.gross_revenue - line.discounts - line.returns) as revenue
      from daily_sales_lines line
      join daily_reports report on report.id = line.daily_report_id and report.status = 'approved'
      where report.business_date between ${scope.from}::date and ${scope.to}::date ${reportStore}
      group by report.store_id
    ), store_expense as (
      select expense.store_id, sum(expense.amount) as expenses
      from expenses expense
      where expense.business_date between ${scope.from}::date and ${scope.to}::date
        and expense.store_id is not null ${expenseStore}
      group by expense.store_id
    ), store_pnl as (
      select
        store.id,
        store.name,
        coalesce(revenue.revenue, 0) as revenue,
        coalesce(expense.expenses, 0) as expenses
      from stores store
      left join store_revenue revenue on revenue.store_id = store.id
      left join store_expense expense on expense.store_id = store.id
      where store.active = true and store.type = 'store'
        and (coalesce(revenue.revenue, 0) > 0 or coalesce(expense.expenses, 0) > 0)
    ), debtor_aging as (
      select bucket.name, bucket.sort, sum(bucket.amount) as value
      from (
        select
          case
            when item.due_date is null or item.due_date >= ${scope.to}::date then 'Current'
            when ${scope.to}::date - item.due_date <= 30 then '1-30 days'
            when ${scope.to}::date - item.due_date <= 60 then '31-60 days'
            when ${scope.to}::date - item.due_date <= 90 then '61-90 days'
            else '90+ days'
          end as name,
          case
            when item.due_date is null or item.due_date >= ${scope.to}::date then 1
            when ${scope.to}::date - item.due_date <= 30 then 2
            when ${scope.to}::date - item.due_date <= 60 then 3
            when ${scope.to}::date - item.due_date <= 90 then 4
            else 5
          end as sort,
          item.open_amount as amount
        from working_capital_items item
        where item.type = 'debtor' and item.status in ('open', 'partial')
      ) bucket
      group by bucket.name, bucket.sort
    ), overspend_rows as (
      select expense.id, category.name, expense.amount, expense.overspend_reason, expense.business_date
      from expenses expense
      join expense_categories category on category.id = expense.expense_category_id
      where expense.business_date between ${scope.from}::date and ${scope.to}::date
        and expense.overspend_reason is not null ${expenseStore}
      order by expense.business_date desc, expense.id desc
      limit 15
    ), daily_report_rows as (
      select
        report.id,
        report.store_id,
        report.transactions,
        sum(line.gross_revenue - line.discounts - line.returns) as revenue,
        sum(line.units_sold)::integer as units
      from daily_reports report
      join daily_sales_lines line on line.daily_report_id = report.id
      where report.status = 'approved'
        and report.business_date between ${scope.from}::date and ${scope.to}::date ${reportStore}
      group by report.id, report.store_id, report.transactions
    ), daily_store_rows as (
      select
        store.id,
        store.name,
        sum(report.revenue) as revenue,
        sum(report.transactions)::integer as transactions,
        sum(report.units)::integer as units,
        count(*)::integer as reports
      from daily_report_rows report
      join stores store on store.id = report.store_id
      group by store.id, store.name
    ), pending_reports as (
      select report.id, store.name as store_name, report.business_date, report.updated_at
      from daily_reports report
      join stores store on store.id = report.store_id
      where report.status = 'submitted' ${reportStore}
      order by report.business_date, report.updated_at
      limit 20
    )
    select jsonb_build_object(
      'budget', jsonb_build_object(
        'budget', round(coalesce((select sum(budget) from category_rows), 0), 2)::float8,
        'actual', round(coalesce((select sum(actual) from category_rows), 0), 2)::float8,
        'variance', round(
          coalesce((select sum(budget - actual) from category_rows), 0), 2
        )::float8,
        'utilization', coalesce(round(
          100 * (select sum(actual) from category_rows) / nullif((select sum(budget) from category_rows), 0), 1
        ), 0)::float8
      ),
      'expenseCategories', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', category.id,
          'name', category.name,
          'group', category."group",
          'budget', round(category.budget, 2)::float8,
          'actual', round(category.actual, 2)::float8
        ) order by category.actual desc, category.name)
        from category_rows category
      ), '[]'::jsonb),
      'cashTrend', coalesce((
        select jsonb_agg(jsonb_build_object(
          'date', cash.date,
          'inflow', round(cash.inflow, 2)::float8,
          'outflow', round(cash.outflow, 2)::float8,
          'net', round(cash.inflow - cash.outflow, 2)::float8
        ) order by cash.date)
        from cash_rows cash
      ), '[]'::jsonb),
      'cashAccounts', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', account.id,
          'name', account.name,
          'type', account.type,
          'balance', round(account.balance, 2)::float8
        ) order by account.name)
        from account_rows account
      ), '[]'::jsonb),
      'workingCapital', jsonb_build_object(
        'debtors', round(working.debtors, 2)::float8,
        'creditors', round(working.creditors, 2)::float8,
        'overdue', round(working.overdue, 2)::float8,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', item.id,
            'type', item.type,
            'entity', item.entity,
            'amount', round(item.open_amount, 2)::float8,
            'dueDate', item.due_date,
            'status', item.status
          ) order by item.due_date nulls last, item.open_amount desc)
          from (
            select * from working_capital_items
            where status in ('open', 'partial')
            order by due_date nulls last, open_amount desc
            limit 12
          ) item
        ), '[]'::jsonb)
      ),
      'forecasts', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', forecast.id,
          'periodStart', forecast.period_start,
          'periodEnd', forecast.period_end,
          'revenue', forecast.revenue::float8,
          'grossProfit', forecast.gross_profit::float8,
          'netProfit', forecast.net_profit::float8,
          'cashBalance', forecast.cash_balance::float8,
          'confidence', forecast.confidence
        ) order by forecast.period_start)
        from (
          select * from financial_forecasts
          where period_end >= ${scope.from}::date
          order by period_start
          limit 6
        ) forecast
      ), '[]'::jsonb),
      'profitability', jsonb_build_object(
        'cogs', round(revenue.cogs, 2)::float8,
        'grossProfit', round(revenue.revenue - revenue.cogs, 2)::float8,
        'operatingExpenses', round(expense.operating, 2)::float8,
        'totalExpenses', round(expense.total, 2)::float8,
        'operatingProfit', round(revenue.revenue - revenue.cogs - expense.operating, 2)::float8,
        'netProfit', round(revenue.revenue - revenue.cogs - expense.total, 2)::float8,
        'grossMargin', coalesce(round(100 * (revenue.revenue - revenue.cogs) / nullif(revenue.revenue, 0), 1), 0)::float8,
        'operatingMargin', coalesce(round(100 * (revenue.revenue - revenue.cogs - expense.operating) / nullif(revenue.revenue, 0), 1), 0)::float8,
        'netMargin', coalesce(round(100 * (revenue.revenue - revenue.cogs - expense.total) / nullif(revenue.revenue, 0), 1), 0)::float8,
        'capitalEmployed', coalesce(capital.capital_employed, 0)::float8,
        'investment', coalesce(capital.total_investment, 0)::float8,
        'roce', coalesce(round(100 * (revenue.revenue - revenue.cogs - expense.operating) / nullif(capital.capital_employed, 0), 1), 0)::float8,
        'roi', coalesce(round(100 * (revenue.revenue - revenue.cogs - expense.total) / nullif(capital.total_investment, 0), 1), 0)::float8
      ),
      'cash', jsonb_build_object(
        'inflow', round(coalesce((select sum(inflow) from cash_rows), 0), 2)::float8,
        'outflow', round(coalesce((select sum(outflow) from cash_rows), 0), 2)::float8,
        'net', round(coalesce((select sum(inflow - outflow) from cash_rows), 0), 2)::float8,
        'position', round(coalesce((select sum(balance) from account_rows), 0), 2)::float8,
        'runwayDays', coalesce(round(
          greatest((select sum(balance) from account_rows), 0) /
          nullif((select sum(outflow) from cash_rows) / greatest(1, (${scope.to}::date - ${scope.from}::date) + 1), 0)
        ), 0)::integer
      ),
      'storePnl', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', store.id,
          'name', store.name,
          'revenue', round(store.revenue, 2)::float8,
          'expenses', round(store.expenses, 2)::float8,
          'profit', round(store.revenue - store.expenses, 2)::float8
        ) order by store.revenue desc, store.name)
        from store_pnl store
      ), '[]'::jsonb),
      'debtorAging', coalesce((
        select jsonb_agg(jsonb_build_object('name', aging.name, 'value', round(aging.value, 2)::float8) order by aging.sort)
        from debtor_aging aging
      ), '[]'::jsonb),
      'overspend', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', item.id,
          'category', item.name,
          'amount', item.amount::float8,
          'reason', item.overspend_reason,
          'date', item.business_date
        ) order by item.business_date desc, item.id desc)
        from overspend_rows item
      ), '[]'::jsonb),
      'dailySalesByStore', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', item.id,
          'name', item.name,
          'revenue', round(item.revenue, 2)::float8,
          'transactions', item.transactions,
          'units', item.units,
          'reports', item.reports
        ) order by item.revenue desc, item.name)
        from daily_store_rows item
      ), '[]'::jsonb),
      'pendingReports', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', report.id,
          'storeName', report.store_name,
          'businessDate', report.business_date,
          'updatedAt', report.updated_at
        ) order by report.business_date, report.updated_at)
        from pending_reports report
      ), '[]'::jsonb)
    ) as data
    from working_summary working
    cross join revenue_summary revenue
    cross join expense_summary expense
    left join capital_latest capital on true
  `);

  return jsonResult<FinanceDomain>(result);
}
