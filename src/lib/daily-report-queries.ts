import { sql } from 'drizzle-orm';
import type { SaveDailyReportInput } from './contracts/daily-report';

function flattenProductsByCategory(sales: SaveDailyReportInput['sales']) {
  return sales.flatMap((line) =>
    line.products.map((product) => ({
      categoryId: line.categoryId,
      productId: product.productId ?? null,
      customName: product.customName ?? null,
    }))
  );
}

export function buildCreateDailyReportQuery(userId: number, storeId: number, input: SaveDailyReportInput) {
  const sales = JSON.stringify(input.sales);
  const payments = JSON.stringify(input.payments);
  const products = JSON.stringify(flattenProductsByCategory(input.sales));
  const submitted = input.status === 'submitted';
  return sql`
    with new_report as (
      insert into daily_reports (
        store_id, business_date, status, transactions, footfall, total_customers,
        new_customers, returning_customers, notes, staff_performance_note, closing_facility_status,
        created_by_user_id, updated_by_user_id, submitted_by_user_id, submitted_at
      ) values (
        ${storeId}, ${input.businessDate}, ${input.status}, ${input.transactions}, ${input.footfall},
        ${input.totalCustomers}, ${input.newCustomers}, ${input.returningCustomers}, ${input.notes ?? null},
        ${input.staffPerformanceNote ?? null}, ${input.closingFacilityStatus ?? null},
        ${userId}, ${userId}, ${submitted ? userId : null}, ${submitted ? sql`now()` : null}
      )
      returning *
    ), new_sales as (
      insert into daily_sales_lines (
        daily_report_id, category_id, opening_stock, units_sold, gross_revenue, cogs, discounts, returns, credit_sales
      )
      select
        report.id, line."categoryId", line."openingStock", line."unitsSold",
        line."grossRevenue", line.cogs, line.discounts, line.returns, line."creditSales"
      from new_report report
      cross join jsonb_to_recordset(${sales}::jsonb) as line(
        "categoryId" bigint,
        "openingStock" integer,
        "unitsSold" integer,
        "grossRevenue" numeric(14, 2),
        cogs numeric(14, 2),
        discounts numeric(14, 2),
        returns numeric(14, 2),
        "creditSales" numeric(14, 2)
      )
      returning id
    ), new_payments as (
      insert into daily_payment_lines (daily_report_id, payment_method_id, amount)
      select report.id, line."paymentMethodId", line.amount
      from new_report report
      cross join jsonb_to_recordset(${payments}::jsonb) as line(
        "paymentMethodId" bigint,
        amount numeric(14, 2)
      )
      returning id
    ), new_products as (
      insert into daily_report_products (daily_report_id, category_id, product_id, custom_name)
      select report.id, line."categoryId", line."productId", line."customName"
      from new_report report
      cross join jsonb_to_recordset(${products}::jsonb) as line(
        "categoryId" bigint,
        "productId" bigint,
        "customName" text
      )
      returning id
    ), new_audit as (
      insert into audit_events (entity_type, entity_id, action, actor_user_id, after)
      select
        'daily-report', report.id, ${submitted ? 'submit' : 'create'}, ${userId},
        jsonb_build_object(
          'report', to_jsonb(report), 'sales', ${sales}::jsonb,
          'payments', ${payments}::jsonb, 'products', ${products}::jsonb
        )
      from new_report report
      returning id
    )
    select
      report.id,
      report.lock_version,
      (select count(*)::integer from new_sales) as sales_count,
      (select count(*)::integer from new_payments) as payment_count
    from new_report report
  `;
}

export function buildReplaceDailyReportQuery(
  userId: number,
  reportId: number,
  input: SaveDailyReportInput & { lockVersion: number }
) {
  const sales = JSON.stringify(input.sales);
  const payments = JSON.stringify(input.payments);
  const products = JSON.stringify(flattenProductsByCategory(input.sales));
  const submitted = input.status === 'submitted';
  return sql`
    with before_report as materialized (
      select
        report.*,
        jsonb_build_object(
          'report', to_jsonb(report),
          'sales', coalesce(
            (select jsonb_agg(to_jsonb(line) order by line.id) from daily_sales_lines line where line.daily_report_id = report.id),
            '[]'::jsonb
          ),
          'payments', coalesce(
            (select jsonb_agg(to_jsonb(line) order by line.id) from daily_payment_lines line where line.daily_report_id = report.id),
            '[]'::jsonb
          ),
          'products', coalesce(
            (select jsonb_agg(to_jsonb(line) order by line.id) from daily_report_products line where line.daily_report_id = report.id),
            '[]'::jsonb
          )
        ) as snapshot
      from daily_reports report
      where report.id = ${reportId}
        and report.lock_version = ${input.lockVersion}
        and report.status <> 'approved'
        and (report.status = 'draft' or ${input.status} = 'submitted')
      for update
    ), updated_report as (
      update daily_reports report
      set
        business_date = ${input.businessDate},
        status = ${input.status},
        transactions = ${input.transactions},
        footfall = ${input.footfall},
        total_customers = ${input.totalCustomers},
        new_customers = ${input.newCustomers},
        returning_customers = ${input.returningCustomers},
        notes = ${input.notes ?? null},
        staff_performance_note = ${input.staffPerformanceNote ?? null},
        closing_facility_status = ${input.closingFacilityStatus ?? null},
        updated_by_user_id = ${userId},
        submitted_by_user_id = case when ${submitted} then coalesce(report.submitted_by_user_id, ${userId}) else null end,
        submitted_at = case when ${submitted} then coalesce(report.submitted_at, now()) else null end,
        updated_at = now(),
        lock_version = report.lock_version + 1
      from before_report before
      where report.id = before.id
      returning report.*
    ), upsert_sales as (
      insert into daily_sales_lines (
        daily_report_id, category_id, opening_stock, units_sold, gross_revenue, cogs, discounts, returns, credit_sales
      )
      select
        report.id, line."categoryId", line."openingStock", line."unitsSold",
        line."grossRevenue", line.cogs, line.discounts, line.returns, line."creditSales"
      from updated_report report
      cross join jsonb_to_recordset(${sales}::jsonb) as line(
        "categoryId" bigint,
        "openingStock" integer,
        "unitsSold" integer,
        "grossRevenue" numeric(14, 2),
        cogs numeric(14, 2),
        discounts numeric(14, 2),
        returns numeric(14, 2),
        "creditSales" numeric(14, 2)
      )
      on conflict (daily_report_id, category_id) do update set
        opening_stock = excluded.opening_stock,
        units_sold = excluded.units_sold,
        gross_revenue = excluded.gross_revenue,
        cogs = excluded.cogs,
        discounts = excluded.discounts,
        returns = excluded.returns,
        credit_sales = excluded.credit_sales,
        updated_at = now()
      returning id
    ), delete_sales as (
      delete from daily_sales_lines existing
      using updated_report report
      where existing.daily_report_id = report.id
        and not exists (
          select 1
          from jsonb_to_recordset(${sales}::jsonb) as line("categoryId" bigint)
          where line."categoryId" = existing.category_id
        )
      returning existing.id
    ), upsert_payments as (
      insert into daily_payment_lines (daily_report_id, payment_method_id, amount)
      select report.id, line."paymentMethodId", line.amount
      from updated_report report
      cross join jsonb_to_recordset(${payments}::jsonb) as line(
        "paymentMethodId" bigint,
        amount numeric(14, 2)
      )
      on conflict (daily_report_id, payment_method_id) do update set
        amount = excluded.amount,
        updated_at = now()
      returning id
    ), delete_payments as (
      delete from daily_payment_lines existing
      using updated_report report
      where existing.daily_report_id = report.id
        and not exists (
          select 1
          from jsonb_to_recordset(${payments}::jsonb) as line("paymentMethodId" bigint)
          where line."paymentMethodId" = existing.payment_method_id
        )
      returning existing.id
    ), delete_products as (
      delete from daily_report_products existing
      using updated_report report
      where existing.daily_report_id = report.id
      returning existing.id
    ), new_products as (
      insert into daily_report_products (daily_report_id, category_id, product_id, custom_name)
      select report.id, line."categoryId", line."productId", line."customName"
      from updated_report report
      cross join jsonb_to_recordset(${products}::jsonb) as line(
        "categoryId" bigint,
        "productId" bigint,
        "customName" text
      )
      returning id
    ), new_audit as (
      insert into audit_events (entity_type, entity_id, action, actor_user_id, before, after)
      select
        'daily-report', report.id, 'update', ${userId}, before.snapshot,
        jsonb_build_object(
          'report', to_jsonb(report), 'sales', ${sales}::jsonb,
          'payments', ${payments}::jsonb, 'products', ${products}::jsonb
        )
      from updated_report report
      join before_report before on before.id = report.id
      returning id
    )
    select
      report.id,
      report.lock_version,
      (select count(*)::integer from upsert_sales) as sales_count,
      (select count(*)::integer from upsert_payments) as payment_count
    from updated_report report
  `;
}

export function buildDecideDailyReportQuery(
  userId: number,
  reportId: number,
  action: 'approve' | 'reopen',
  lockVersion: number,
  reason?: string
) {
  return sql`
    with before_report as materialized (
      select report.*
      from daily_reports report
      where report.id = ${reportId}
        and report.lock_version = ${lockVersion}
        and (
          (${action}::text = 'approve' and report.status = 'submitted')
          or (${action}::text = 'reopen' and report.status = 'approved')
        )
      for update
    ), updated_report as (
      update daily_reports report
      set
        status = case when ${action}::text = 'approve' then 'approved' else 'draft' end,
        submitted_by_user_id = case when ${action}::text = 'approve' then report.submitted_by_user_id else null end,
        submitted_at = case when ${action}::text = 'approve' then report.submitted_at else null end,
        approved_by_user_id = case when ${action}::text = 'approve' then ${userId}::integer else null::integer end,
        approved_at = case when ${action}::text = 'approve' then now() else null::timestamptz end,
        updated_by_user_id = ${userId},
        updated_at = now(),
        lock_version = report.lock_version + 1
      from before_report before
      where report.id = before.id
      returning report.*
    ), new_audit as (
      insert into audit_events (entity_type, entity_id, action, actor_user_id, before, after, metadata)
      select
        'daily-report', report.id, ${action}, ${userId}, to_jsonb(before), to_jsonb(report),
        case
          when ${reason ?? null}::text is null then null
          else jsonb_build_object('reason', ${reason ?? null}::text)
        end
      from updated_report report
      join before_report before on before.id = report.id
      returning id
    )
    select id, lock_version, status from updated_report
  `;
}
