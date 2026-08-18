import { sql, type SQL } from 'drizzle-orm';

// The running on-hand balance per store and product.
//
// The catalogue import sets the opening balance, sales take from it, goods
// receipts and transfers move it, and a physical stock count corrects it. Without
// this, opening stock has to be typed by hand every morning — which is why it was
// dropped from the form and why sell-through was hidden with it.

/**
 * Applies a submitted report's product lines against the store's stock.
 *
 * Only catalogue lines move stock: a free-typed line names something the catalogue
 * does not know, so there is no balance to take it from. Balances are floored at
 * zero rather than going negative, because a negative on-hand is always a data
 * problem — a missed receipt or an uncounted transfer — and letting it go negative
 * hides that instead of surfacing it at the next stock count.
 */
export function applySalesToStockQuery(dailyReportId: number): SQL {
  return sql`
    with sold as (
      select
        report.store_id,
        line.product_id,
        sum(line.units)::integer as units,
        report.business_date
      from daily_report_products line
      join daily_reports report on report.id = line.daily_report_id
      where line.daily_report_id = ${dailyReportId}
        and line.product_id is not null
        and line.units > 0
      group by report.store_id, line.product_id, report.business_date
    )
    update store_stock_levels level
    set
      quantity = greatest(level.quantity - sold.units, 0),
      as_of_date = sold.business_date,
      updated_at = now()
    from sold
    where level.store_id = sold.store_id
      and level.product_id = sold.product_id
  `;
}

/**
 * Fills each category's opening stock on a report from the store's current
 * balances, so nobody types it.
 *
 * Left at zero where the store holds no stock rows for that category at all: a
 * zero opening is what tells the sell-through calculation it has nothing real to
 * work from, so it can show a dash rather than a made-up percentage.
 */
export function fillOpeningStockQuery(dailyReportId: number): SQL {
  return sql`
    with on_hand as (
      select
        product.category_id,
        sum(level.quantity)::integer as quantity
      from store_stock_levels level
      join products product on product.id = level.product_id
      join daily_reports report on report.id = ${dailyReportId}
      where level.store_id = report.store_id
      group by product.category_id
    )
    update daily_sales_lines line
    set opening_stock = on_hand.quantity, updated_at = now()
    from on_hand
    where line.daily_report_id = ${dailyReportId}
      and line.category_id = on_hand.category_id
      and line.opening_stock = 0
  `;
}
