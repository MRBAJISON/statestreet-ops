import { sql } from 'drizzle-orm';
import { db } from '../db';
import {
  classifyStock,
  replayStock,
  type StockEvent,
  type StockLot,
} from './stock-aging';

export interface ProductPerformanceRow {
  storeId: number;
  storeName: string;
  productId: number;
  name: string;
  sku: string;
  categoryId: number;
  categoryName: string;
  unitsSold: number;
  salesValue: string;
  returnedUnits: number;
  sellingPrice: string | null;
  reserved: number;
  available: number;
  quantity: number;
  lastSale: string | null;
  historyComplete: boolean;
  warnings: string[];
  bands: ReturnType<typeof classifyStock>['bands'];
  oldestAge: number | null;
  observationDays: number;
  daysSinceSale: number | null;
  nonMoving: boolean;
  riskQuantity: number;
  riskValue: string | null;
}
export interface ProductPerformance {
  from: string;
  to: string;
  asOf: string;
  rows: ProductPerformanceRow[];
  unmatched: {
    storeId: number;
    categoryId: number;
    name: string;
    units: number;
    value: string;
  }[];
  incompleteReportCount: number;
}

export async function getProductPerformance(
  storeIds: number[],
  from: string,
  to: string,
  approvedOnly = false
): Promise<ProductPerformance> {
  const today = new Date().toISOString().slice(0, 10);
  const asOf = to < today ? to : today;
  if (!storeIds.length)
    return {
      from,
      to,
      asOf,
      rows: [],
      unmatched: [],
      incompleteReportCount: 0,
    };
  const ids = sql`array[${sql.join(
    storeIds.map((id) => sql`${id}::bigint`),
    sql`, `
  )}]`;
  const status = approvedOnly
    ? sql`report.status='approved'`
    : sql`report.status<>'draft'`;
  const [
    baselineResult,
    eventResult,
    productsResult,
    unmatchedResult,
    gapsResult,
    observationResult,
  ] = await Promise.all([
    // Transfer provenance may originate in a different store or warehouse. Only
    // the authorized requested stores are included in the returned product rows.
    db.execute(
      sql`select store_id::integer as "storeId",product_id::integer as "productId",as_of_date::text as date,quantity,lots,created_at::text as "createdAt" from stock_history_baselines`
    ),
    db.execute(sql`select source_key as key,store_id::integer as "storeId",product_id::integer as "productId",business_date::text as date,
      quantity,requested_quantity as "requestedQuantity",kind,receipt_date::text as "receiptDate",transfer_key as "transferKey",id::integer as "order",created_at::text as "createdAt"
      from stock_history_events where business_date<=${asOf}::date order by business_date,id`),
    db.execute(sql`
      with sales as (
        select report.store_id,line.product_id,report.business_date as date,line.units as units,line.line_value as value
        from daily_report_products line join daily_reports report on report.id=line.daily_report_id where ${status}
        union all
        select sale.store_id,item.product_id,sale.business_date,item.quantity,item.line_value from customer_credit_sale_items item join customer_credit_sales sale on sale.id=item.credit_sale_id
        union all
        select deposit.store_id,item.product_id,deposit.collected_at::date,item.quantity,item.line_value from customer_deposit_items item join customer_deposits deposit on deposit.id=item.deposit_id where deposit.status='collected'
        union all
        select store_id,replacement_product_id,business_date,1,replacement_value from customer_credit_note_redemptions where replacement_product_id is not null
      ), actuals as (
        select store_id,product_id,
          coalesce(sum(units) filter(where date between ${from}::date and ${asOf}::date),0)::integer as units,
          coalesce(sum(value) filter(where date between ${from}::date and ${asOf}::date),0)::text as value,
          max(date) filter(where units>0 and date<=${asOf}::date)::text as last_sale
        from sales where store_id=any(${ids}) and product_id is not null group by store_id,product_id
      ), returned as (
        select note.store_id,item.product_id,sum(item.quantity)::integer as units
        from customer_credit_note_items item join customer_credit_notes note on note.id=item.credit_note_id
        where note.status in ('approved','partially-redeemed','redeemed') and note.business_date between ${from}::date and ${asOf}::date
        group by note.store_id,item.product_id
      ), pairs as (
        select store_id,product_id from store_stock_levels where store_id=any(${ids})
        union select store_id,product_id from actuals
        union select store_id,product_id from stock_history_baselines where store_id=any(${ids})
      )
      select pair.store_id::integer as "storeId",store.name as "storeName",product.id::integer as "productId",product.name,product.sku,
        product.category_id::integer as "categoryId",category.name as "categoryName",product.selling_price::text as "sellingPrice",
        coalesce(actual.units,0)::integer as "unitsSold",coalesce(actual.value,'0.00') as "salesValue",actual.last_sale as "lastSale",
        coalesce(returned.units,0)::integer as "returnedUnits",coalesce(level.quantity,0)::integer as "currentQuantity",
        exists(select 1 from daily_report_stock_settlements settlement join daily_reports report on report.id=settlement.daily_report_id
          where report.store_id=pair.store_id and settlement.product_id=pair.product_id and report.status<>'draft'
            and report.business_date<=${asOf}::date and settlement.units<>settlement.applied_units) as "unsettledSales",
        coalesce((select sum(reservation.quantity) from store_stock_reservations reservation where reservation.store_id=pair.store_id and reservation.product_id=pair.product_id
          and reservation.created_at::date<=${asOf}::date
          and (reservation.released_at is null or reservation.released_at::date>${asOf}::date)
          and (reservation.fulfilled_at is null or reservation.fulfilled_at::date>${asOf}::date)),0)::integer as reserved
      from pairs pair join products product on product.id=pair.product_id join stores store on store.id=pair.store_id
      join categories category on category.id=product.category_id left join actuals actual using(store_id,product_id)
      left join store_stock_levels level using(store_id,product_id) left join returned using(store_id,product_id)
      where product.created_at::date<=${asOf}::date or actual.last_sale is not null
        or exists(select 1 from stock_history_baselines baseline where baseline.store_id=pair.store_id and baseline.product_id=pair.product_id and baseline.as_of_date<=${asOf}::date)
      order by pair.store_id,product.id`),
    db.execute(sql`select report.store_id::integer as "storeId",line.category_id::integer as "categoryId",coalesce(line.custom_name,'Unmatched product') as name,
      sum(line.units)::integer as units,sum(line.line_value)::text as value from daily_report_products line join daily_reports report on report.id=line.daily_report_id
      where line.product_id is null and ${status} and report.store_id=any(${ids}) and report.business_date between ${from}::date and ${asOf}::date
      group by report.store_id,line.category_id,line.custom_name order by report.store_id,line.category_id,line.custom_name`),
    db.execute(sql`select report.store_id::integer as "storeId",count(distinct report.id)::integer as count from daily_reports report join daily_sales_lines category on category.daily_report_id=report.id
      where ${status} and report.store_id=any(${ids}) and report.business_date between ${from}::date and ${asOf}::date and (
        category.units_sold>coalesce((select sum(line.units) from daily_report_products line where line.daily_report_id=report.id and line.category_id=category.category_id),0)
        or category.gross_revenue>coalesce((select sum(line.line_value) from daily_report_products line where line.daily_report_id=report.id and line.category_id=category.category_id),0)) group by report.store_id order by report.store_id`),
    db.execute(sql`select store.id::integer as "storeId",not exists(
      select 1 from generate_series(${asOf}::date-30,${asOf}::date,interval '1 day') day(date)
      left join daily_reports report on report.store_id=store.id and report.business_date=day.date::date and ${status}
      where extract(dow from day.date)<>0 and (report.id is null or exists(
        select 1 from daily_sales_lines category where category.daily_report_id=report.id and
          category.units_sold>coalesce((select sum(line.units) from daily_report_products line where line.daily_report_id=report.id and line.category_id=category.category_id),0)
      ))) as complete from stores store where store.id=any(${ids})`),
  ]);
  const baselines = baselineResult.rows as {
    storeId: number;
    productId: number;
    date: string;
    quantity: number;
    lots: StockLot[];
    createdAt: string;
  }[];
  const byKey = new Map(
    baselines.map((b) => [`${b.storeId}:${b.productId}`, b])
  );
  const history: StockEvent[] = baselines.map((b) => ({
    ...b,
    key: `baseline:${b.storeId}:${b.productId}`,
    kind: 'baseline',
    order: -1,
  }));
  const events = eventResult.rows as unknown as (StockEvent & {
    requestedQuantity: number;
    createdAt: string;
  })[];
  const daily = new Map<string, StockEvent>();
  for (const e of events) {
    const baseline = byKey.get(`${e.storeId}:${e.productId}`);
    const event = {
      ...e,
      date: baseline && e.date < baseline.date ? baseline.date : e.date,
    };
    if (e.kind === 'daily-sale') {
      const key = `daily-net:${e.key.split(':')[1]}:${e.productId}`;
      const prior = daily.get(key);
      if (prior) prior.quantity += event.quantity;
      else daily.set(key, { ...event, key });
    } else history.push(event);
  }
  history.push(...daily.values());
  const positions = replayStock(history, asOf);
  const gaps = gapsResult.rows as { storeId: number; count: number }[];
  const incompleteByStore = new Map(
    gaps.map((row) => [row.storeId, row.count])
  );
  const incompleteReportCount = gaps.reduce(
    (sum, row) => sum + Number(row.count),
    0
  );
  const observed = new Map(
    (observationResult.rows as { storeId: number; complete: boolean }[]).map(
      (row) => [row.storeId, row.complete]
    )
  );
  const rows = (
    productsResult.rows as (Omit<
      ProductPerformanceRow,
      | 'bands'
      | 'quantity'
      | 'available'
      | 'oldestAge'
      | 'observationDays'
      | 'daysSinceSale'
      | 'nonMoving'
      | 'riskQuantity'
      | 'riskValue'
      | 'warnings'
      | 'historyComplete'
    > & { currentQuantity: number; unsettledSales: boolean })[]
  ).map(({ currentQuantity, unsettledSales, ...product }) => {
    const key = `${product.storeId}:${product.productId}`;
    const baseline = byKey.get(key);
    const position = positions.get(key);
    const warnings = [...(position?.discrepancies ?? [])];
    if (!baseline || baseline.date > asOf)
      warnings.push(
        'Historical stock is unavailable before the opening allocation.'
      );
    if (
      unsettledSales ||
      events.some(
        (e) =>
          e.storeId === product.storeId &&
          e.productId === product.productId &&
          e.kind !== 'daily-sale' &&
          e.quantity !== e.requestedQuantity
      )
    )
      warnings.push('Stock postings contain an unresolved shortfall.');
    if (asOf === today && position && position.quantity !== currentQuantity)
      warnings.push(
        'Stock history does not reconcile with the current balance.'
      );
    if (product.sellingPrice === null)
      warnings.push('Selling price is missing; risk valuation is incomplete.');
    if (incompleteByStore.get(product.storeId))
      warnings.push('Product sales coverage is incomplete in this period.');
    const lots = position?.lots ?? [];
    if (lots.some((lot) => lot.assumed))
      warnings.push(
        'Includes an assigned opening-stock receipt date of 1 July 2026, not a verified delivery date.'
      );
    if (lots.some((lot) => lot.receiptDate === null))
      warnings.push('Some remaining units have unknown receipt history.');
    const firstStockDate = position?.inStockSince ?? null;
    if (!observed.get(product.storeId))
      warnings.push(
        'Thirty days of complete daily product observations are not available; inactivity is not inferred.'
      );
    const complete = Boolean(
      baseline &&
        baseline.date <= asOf &&
        observed.get(product.storeId) &&
        !warnings.some(
          (w) => w.includes('shortfall') || w.includes('reconcile')
        )
    );
    const classification = classifyStock({
      lots,
      asOf,
      lastSale: product.lastSale,
      observedFrom: firstStockDate,
      historyComplete: complete,
      sellingPrice: product.sellingPrice,
    });
    if (
      product.reserved > classification.quantity &&
      baseline &&
      baseline.date <= asOf
    )
      warnings.push(
        'Reserved units exceed the reconciled on-hand balance; investigate the reservation or stock posting.'
      );
    if (
      !baseline ||
      baseline.date > asOf ||
      (!complete && classification.quantity > 0) ||
      lots.some((lot) => lot.receiptDate === null) ||
      warnings.some((w) => w.includes('shortfall') || w.includes('reconcile'))
    )
      classification.riskValue = null;
    return {
      ...product,
      ...classification,
      available: Math.max(0, classification.quantity - product.reserved),
      historyComplete: complete,
      warnings,
    };
  });
  rows.sort(
    (a, b) =>
      b.unitsSold - a.unitsSold ||
      Number(b.salesValue) - Number(a.salesValue) ||
      a.sku.localeCompare(b.sku)
  );
  return {
    from,
    to,
    asOf,
    rows,
    unmatched: unmatchedResult.rows as ProductPerformance['unmatched'],
    incompleteReportCount,
  };
}
