import { sql } from 'drizzle-orm';
import type { InventoryDomain } from '../contracts/analytics';
import { db } from '../db';
import type { AnalyticsScope } from './shared';
import { jsonResult } from './shared';

export async function getInventoryDomain(scope: AnalyticsScope): Promise<InventoryDomain> {
  const movementStore = scope.store ? sql`and movement.store_id = ${scope.store.id}` : sql``;
  const receiptStore = scope.store ? sql`and receipt.receiving_store_id = ${scope.store.id}` : sql``;
  const transferStore = scope.store
    ? sql`and (transfer.from_store_id = ${scope.store.id} or transfer.to_store_id = ${scope.store.id})`
    : sql``;
  const replenishmentStore = scope.store ? sql`and request.store_id = ${scope.store.id}` : sql``;
  const countStore = scope.store ? sql`and count.store_id = ${scope.store.id}` : sql``;
  const summaryStore = scope.store ? sql`and snapshot.store_id = ${scope.store.id}` : sql``;
  const dispositionStore = scope.store ? sql`and disposition.store_id = ${scope.store.id}` : sql``;

  const result = await db.execute(sql`
    with balances as (
      select
        movement.product_id,
        movement.store_id,
        sum(movement.quantity)::integer as units,
        max(movement.business_date) as last_movement
      from inventory_movements movement
      where movement.business_date <= ${scope.to}::date ${movementStore}
      group by movement.product_id, movement.store_id
    ), stock_rows as (
      select
        balance.product_id,
        balance.store_id,
        product.sku,
        product.name as product_name,
        store.name as store_name,
        balance.units,
        balance.units * coalesce(product.unit_cost, 0) as value,
        balance.last_movement,
        case
          when balance.units <= 20 then 'critical'
          when balance.units <= 40 then 'low'
          when balance.last_movement < ${scope.to}::date - 45 then 'slow'
          else 'healthy'
        end as risk
      from balances balance
      join products product on product.id = balance.product_id and product.active = true
      join stores store on store.id = balance.store_id and store.active = true
      where balance.units >= 0
    ), latest_summary_rows as (
      select distinct on (snapshot.store_id)
        snapshot.store_id, snapshot.business_date, snapshot.system_quantity, snapshot.physical_quantity,
        snapshot.stock_value, snapshot.created_at
      from inventory_summary_snapshots snapshot
      where snapshot.business_date <= ${scope.to}::date ${summaryStore}
      order by snapshot.store_id, snapshot.business_date desc, snapshot.id desc
    ), summary_movement_deltas as (
      select
        snapshot.store_id,
        coalesce(sum(movement.quantity), 0)::integer as units,
        coalesce(sum(movement.quantity * coalesce(movement.unit_cost, product.unit_cost, 0)), 0) as value
      from latest_summary_rows snapshot
      left join inventory_movements movement on movement.store_id = snapshot.store_id
        and movement.business_date <= ${scope.to}::date
        and (
          movement.business_date > snapshot.business_date or
          (movement.business_date = snapshot.business_date and movement.created_at > snapshot.created_at)
        )
      left join products product on product.id = movement.product_id
      group by snapshot.store_id
    ), summary_stock_rows as (
      select
        snapshot.store_id,
        (snapshot.physical_quantity + delta.units)::integer as units,
        snapshot.stock_value + delta.value as value
      from latest_summary_rows snapshot
      join summary_movement_deltas delta on delta.store_id = snapshot.store_id
    ), movement_only_stock_rows as (
      select stock.*
      from stock_rows stock
      where not exists (select 1 from latest_summary_rows snapshot where snapshot.store_id = stock.store_id)
    ), store_brand_rows as (
      select
        store.id as store_id,
        case when count(brand.id) = 1 then min(brand.name) else 'Unassigned' end as brand_name
      from stores store
      left join brand_stores brand_store on brand_store.store_id = store.id
      left join brands brand on brand.id = brand_store.brand_id and brand.active = true
      where store.type = 'store'
      group by store.id
    ), inventory_value_components as (
      select brand.name, sum(stock.value) as value
      from movement_only_stock_rows stock
      join products product on product.id = stock.product_id
      join brands brand on brand.id = product.brand_id
      group by brand.id, brand.name
      union all
      select coalesce(store_brand.brand_name, 'Unassigned') as name, sum(snapshot.value) as value
      from summary_stock_rows snapshot
      left join store_brand_rows store_brand on store_brand.store_id = snapshot.store_id
      group by coalesce(store_brand.brand_name, 'Unassigned')
    ), inventory_value_by_brand as (
      select component.name, sum(component.value) as value
      from inventory_value_components component
      group by component.name
      having sum(component.value) <> 0
    ), latest_accuracy_summary_rows as (
      select distinct on (snapshot.store_id)
        snapshot.store_id, snapshot.system_quantity, snapshot.physical_quantity
      from inventory_summary_snapshots snapshot
      where snapshot.business_date between ${scope.from}::date and ${scope.to}::date ${summaryStore}
      order by snapshot.store_id, snapshot.business_date desc, snapshot.id desc
    ), stock_summary as (
      select
        (coalesce((select sum(stock.units) from movement_only_stock_rows stock), 0) +
          coalesce((select sum(snapshot.units) from summary_stock_rows snapshot), 0))::integer as units,
        coalesce((select sum(stock.value) from movement_only_stock_rows stock), 0) +
          coalesce((select sum(snapshot.value) from summary_stock_rows snapshot), 0) as value,
        (select count(*) from movement_only_stock_rows stock where stock.risk in ('critical', 'low'))::integer as low_stock_products,
        coalesce((select round(100 * sum(stock.value) filter (where stock.risk = 'slow') /
          nullif(sum(stock.value), 0), 1) from movement_only_stock_rows stock), 0) as dead_stock_percent
    ), receipt_rows as (
      select
        receipt.id,
        receipt.business_date,
        receipt.po_number,
        supplier.name as supplier_name,
        store.name as store_name,
        receipt.status,
        coalesce(sum(line.quantity), 0)::integer as units,
        coalesce(sum(line.quantity * coalesce(line.unit_cost, product.unit_cost, 0)), 0) as value
      from goods_receipts receipt
      join suppliers supplier on supplier.id = receipt.supplier_id
      join stores store on store.id = receipt.receiving_store_id
      left join goods_receipt_lines line on line.goods_receipt_id = receipt.id
      left join products product on product.id = line.product_id
      where receipt.business_date between ${scope.from}::date and ${scope.to}::date ${receiptStore}
      group by receipt.id, receipt.business_date, receipt.po_number, supplier.name, store.name, receipt.status
      order by receipt.business_date desc, receipt.id desc
      limit 12
    ), transfer_rows as (
      select
        transfer.id,
        transfer.business_date,
        source.name as from_store,
        destination.name as to_store,
        transfer.status,
        coalesce(sum(line.quantity), 0)::integer as units
      from stock_transfers transfer
      join stores source on source.id = transfer.from_store_id
      join stores destination on destination.id = transfer.to_store_id
      left join stock_transfer_lines line on line.stock_transfer_id = transfer.id
      where transfer.business_date between ${scope.from}::date and ${scope.to}::date ${transferStore}
      group by transfer.id, transfer.business_date, source.name, destination.name, transfer.status
      order by transfer.business_date desc, transfer.id desc
      limit 12
    ), replenishment_rows as (
      select
        request.id,
        request.business_date,
        store.name as store_name,
        request.status,
        count(line.id)::integer as lines,
        coalesce(sum(line.reorder_quantity), 0)::integer as units
      from replenishment_requests request
      join stores store on store.id = request.store_id
      left join replenishment_request_lines line on line.replenishment_request_id = request.id
      where request.status not in ('fulfilled', 'rejected', 'cancelled') ${replenishmentStore}
      group by request.id, request.business_date, store.name, request.status
      order by
        case request.status when 'requested' then 1 when 'approved' then 2 else 3 end,
        request.business_date
      limit 15
    ), receipt_trend_months as (
      select month.date
      from (
        select generate_series(
          date_trunc('month', ${scope.from}::date),
          date_trunc('month', ${scope.to}::date),
          interval '1 month'
        )::date as date
      ) month
      where exists (
        select 1 from goods_receipts receipt
        where receipt.status = 'received'
          and receipt.business_date between ${scope.from}::date and ${scope.to}::date ${receiptStore}
      )
    ), receipt_trend_rows as (
      select month.date,
        coalesce(sum(line.quantity * coalesce(line.unit_cost, product.unit_cost, 0)), 0) as value
      from receipt_trend_months month
      left join goods_receipts receipt
        on date_trunc('month', receipt.business_date)::date = month.date
       and receipt.status = 'received'
       and receipt.business_date between ${scope.from}::date and ${scope.to}::date ${receiptStore}
      left join goods_receipt_lines line on line.goods_receipt_id = receipt.id
      left join products product on product.id = line.product_id
      group by month.date
    ), typed_count_accuracy as (
      select
        count.store_id,
        sum(abs(line.physical_quantity - line.system_quantity))::numeric as variance,
        sum(greatest(line.system_quantity, 1))::numeric as baseline,
        count(*)::integer as line_count
      from stock_counts count
      join stock_count_lines line on line.stock_count_id = count.id
      where count.status = 'approved'
        and count.business_date between ${scope.from}::date and ${scope.to}::date ${countStore}
      group by count.store_id
    ), accuracy_rows as (
      select count.store_id, line.system_quantity, line.physical_quantity
      from stock_counts count
      join stock_count_lines line on line.stock_count_id = count.id
      where count.status = 'approved'
        and count.business_date between ${scope.from}::date and ${scope.to}::date ${countStore}
      union all
      select snapshot.store_id, snapshot.system_quantity, snapshot.physical_quantity
      from latest_accuracy_summary_rows snapshot
      where not exists (select 1 from typed_count_accuracy typed where typed.store_id = snapshot.store_id)
    ), accuracy_components as (
      select typed.store_id, typed.variance, typed.baseline, typed.line_count
      from typed_count_accuracy typed
      union all
      select snapshot.store_id,
        abs(snapshot.physical_quantity - snapshot.system_quantity)::numeric,
        greatest(snapshot.system_quantity, 1)::numeric,
        1
      from latest_accuracy_summary_rows snapshot
      where not exists (select 1 from typed_count_accuracy typed where typed.store_id = snapshot.store_id)
    ), count_accuracy as (
      select
        coalesce(100.0 * (1 - sum(component.variance) / nullif(sum(component.baseline), 0)), 0) as accuracy,
        coalesce(sum(component.line_count), 0)::integer as line_count
      from accuracy_components component
    ), accuracy_distribution as (
      select bucket.name, bucket.sort, count(*)::integer as value
      from (
        select
          case
            when line.system_quantity = line.physical_quantity then 'Exact'
            when abs(line.physical_quantity - line.system_quantity) <= greatest(1, round(line.system_quantity * 0.02)) then 'Within 2%'
            when abs(line.physical_quantity - line.system_quantity) <= greatest(1, round(line.system_quantity * 0.05)) then 'Within 5%'
            else 'Variance over 5%'
          end as name,
          case
            when line.system_quantity = line.physical_quantity then 1
            when abs(line.physical_quantity - line.system_quantity) <= greatest(1, round(line.system_quantity * 0.02)) then 2
            when abs(line.physical_quantity - line.system_quantity) <= greatest(1, round(line.system_quantity * 0.05)) then 3
            else 4
          end as sort
        from accuracy_rows line
      ) bucket
      group by bucket.name, bucket.sort
    ), movement_summary as (
      select
        coalesce(sum(movement.quantity) filter (where movement.movement_type = 'receipt'), 0)::integer as received_units,
        coalesce(sum(movement.quantity * coalesce(movement.unit_cost, product.unit_cost, 0)) filter (where movement.movement_type = 'receipt'), 0) as received_value,
        coalesce(sum(abs(movement.quantity)) filter (where movement.movement_type in ('transfer-in', 'transfer-out')), 0)::integer as transferred_units,
        coalesce(sum(abs(movement.quantity) * coalesce(movement.unit_cost, product.unit_cost, 0)) filter (where movement.movement_type in ('transfer-in', 'transfer-out')), 0) as transferred_value,
        coalesce(sum(abs(movement.quantity) * coalesce(movement.unit_cost, product.unit_cost, 0)) filter (where movement.movement_type = 'write-off'), 0) as dead_stock_value,
        coalesce(sum(abs(movement.quantity) * coalesce(movement.unit_cost, product.unit_cost, 0)) filter (where movement.movement_type = 'count-adjustment'), 0) as counted_value
      from inventory_movements movement
      join products product on product.id = movement.product_id
      where movement.business_date between ${scope.from}::date and ${scope.to}::date ${movementStore}
    ), supplier_performance as (
      select supplier.name,
        coalesce(round(100.0 * count(*) filter (where line.condition = 'good') / nullif(count(*), 0), 1), 0) as value
      from goods_receipts receipt
      join suppliers supplier on supplier.id = receipt.supplier_id
      join goods_receipt_lines line on line.goods_receipt_id = receipt.id
      where receipt.status = 'received'
        and receipt.business_date between ${scope.from}::date and ${scope.to}::date ${receiptStore}
      group by supplier.id, supplier.name
    ), replenishment_line_rows as (
      select line.id, product.sku, product.name as product_name, line.current_stock, line.reorder_quantity,
        line.urgency, store.name as store_name
      from replenishment_request_lines line
      join replenishment_requests request on request.id = line.replenishment_request_id
      join products product on product.id = line.product_id
      join stores store on store.id = request.store_id
      where request.status not in ('fulfilled', 'rejected', 'cancelled') ${replenishmentStore}
      order by case line.urgency when 'critical' then 1 when 'high' then 2 when 'normal' then 3 else 4 end, request.business_date
      limit 30
    ), disposition_rows as (
      select disposition.id, product.name as product_name, category.name as category_name,
        disposition.action, disposition.justification, disposition.status, store.name as store_name,
        coalesce(balance.units, 0) * coalesce(product.unit_cost, 0) as value
      from inventory_dispositions disposition
      join products product on product.id = disposition.product_id
      join categories category on category.id = product.category_id
      join stores store on store.id = disposition.store_id
      left join balances balance on balance.product_id = disposition.product_id and balance.store_id = disposition.store_id
      where disposition.review_date between ${scope.from}::date and ${scope.to}::date ${dispositionStore}
      order by disposition.review_date desc, disposition.id desc
      limit 30
    ), disposition_actions as (
      select disposition.action as name, count(*)::integer as value
      from inventory_dispositions disposition
      where disposition.review_date between ${scope.from}::date and ${scope.to}::date ${dispositionStore}
      group by disposition.action
    ), receipt_quality as (
      select line.condition as name, count(*)::integer as value
      from goods_receipts receipt
      join goods_receipt_lines line on line.goods_receipt_id = receipt.id
      where receipt.status = 'received'
        and receipt.business_date between ${scope.from}::date and ${scope.to}::date ${receiptStore}
      group by line.condition
    ), receipt_issues as (
      select line.id, supplier.name as supplier_name, line.condition, line.discrepancy,
        receipt.business_date, store.name as store_name
      from goods_receipts receipt
      join goods_receipt_lines line on line.goods_receipt_id = receipt.id
      join suppliers supplier on supplier.id = receipt.supplier_id
      join stores store on store.id = receipt.receiving_store_id
      where receipt.status = 'received'
        and (line.condition <> 'good' or line.discrepancy is not null)
        and receipt.business_date between ${scope.from}::date and ${scope.to}::date ${receiptStore}
      order by receipt.business_date desc, line.id desc
      limit 25
    ), in_transit as (
      select count(*)::integer as count
      from stock_transfers transfer
      where transfer.status in ('authorized', 'in-transit') ${transferStore}
    )
    select jsonb_build_object(
      'summary', jsonb_build_object(
        'unitsOnHand', stock.units,
        'inventoryValue', round(stock.value, 2)::float8,
        'stockAccuracy', case
          when (select line_count from count_accuracy) > 0 then round((select accuracy from count_accuracy), 1)::float8
          else 0::float8
        end,
        'deadStockPercent', stock.dead_stock_percent::float8,
        'lowStockProducts', stock.low_stock_products,
        'openReplenishments', (select count(*) from replenishment_rows),
        'inTransitTransfers', (select count from in_transit)
      ),
      'stock', coalesce((
        select jsonb_agg(jsonb_build_object(
          'productId', item.product_id,
          'sku', item.sku,
          'productName', item.product_name,
          'storeName', item.store_name,
          'units', item.units,
          'value', round(item.value, 2)::float8,
          'lastMovement', item.last_movement,
          'risk', item.risk
        ) order by
          case item.risk when 'critical' then 1 when 'low' then 2 when 'slow' then 3 else 4 end,
          item.value desc)
        from (
          select * from movement_only_stock_rows
          order by case risk when 'critical' then 1 when 'low' then 2 when 'slow' then 3 else 4 end, value desc
          limit 30
        ) item
      ), '[]'::jsonb),
      'receipts', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', item.id,
          'date', item.business_date,
          'poNumber', item.po_number,
          'supplierName', item.supplier_name,
          'storeName', item.store_name,
          'units', item.units,
          'value', round(item.value, 2)::float8,
          'status', item.status
        ) order by item.business_date desc, item.id desc)
        from receipt_rows item
      ), '[]'::jsonb),
      'transfers', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', item.id,
          'date', item.business_date,
          'fromStore', item.from_store,
          'toStore', item.to_store,
          'units', item.units,
          'status', item.status
        ) order by item.business_date desc, item.id desc)
        from transfer_rows item
      ), '[]'::jsonb),
      'replenishments', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', item.id,
          'date', item.business_date,
          'storeName', item.store_name,
          'lines', item.lines,
          'units', item.units,
          'status', item.status
        )) from replenishment_rows item
      ), '[]'::jsonb),
      'valueByBrand', coalesce((select jsonb_agg(jsonb_build_object('name', item.name, 'value', round(item.value, 2)::float8) order by item.value desc) from inventory_value_by_brand item), '[]'::jsonb),
      'receiptValueTrend', coalesce((select jsonb_agg(jsonb_build_object('date', item.date, 'value', round(item.value, 2)::float8) order by item.date) from receipt_trend_rows item), '[]'::jsonb),
      'accuracyDistribution', coalesce((select jsonb_agg(jsonb_build_object('name', item.name, 'value', item.value) order by item.sort) from accuracy_distribution item), '[]'::jsonb),
      'movement', jsonb_build_object(
        'receivedUnits', movement.received_units,
        'receivedValue', movement.received_value::float8,
        'transferredUnits', movement.transferred_units,
        'transferredValue', movement.transferred_value::float8,
        'deadStockValue', movement.dead_stock_value::float8,
        'countedValue', movement.counted_value::float8
      ),
      'supplierPerformance', coalesce((select jsonb_agg(jsonb_build_object('name', item.name, 'value', item.value::float8) order by item.value desc, item.name) from supplier_performance item), '[]'::jsonb),
      'replenishmentLines', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', item.id, 'sku', item.sku, 'productName', item.product_name,
          'currentStock', item.current_stock, 'reorderQuantity', item.reorder_quantity,
          'urgency', item.urgency, 'storeName', item.store_name
        )) from replenishment_line_rows item
      ), '[]'::jsonb),
      'dispositions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', item.id, 'productName', item.product_name, 'categoryName', item.category_name,
          'action', item.action, 'justification', item.justification, 'value', item.value::float8,
          'storeName', item.store_name, 'status', item.status
        ) order by item.id desc) from disposition_rows item
      ), '[]'::jsonb),
      'dispositionActions', coalesce((select jsonb_agg(jsonb_build_object('name', item.name, 'value', item.value) order by item.value desc) from disposition_actions item), '[]'::jsonb),
      'receiptQuality', coalesce((select jsonb_agg(jsonb_build_object('name', item.name, 'value', item.value) order by item.value desc) from receipt_quality item), '[]'::jsonb),
      'receiptIssues', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', item.id, 'supplierName', item.supplier_name, 'condition', item.condition,
          'discrepancy', item.discrepancy, 'date', item.business_date, 'storeName', item.store_name
        ) order by item.business_date desc, item.id desc) from receipt_issues item
      ), '[]'::jsonb)
    ) as data
    from stock_summary stock
    cross join movement_summary movement
  `);

  return jsonResult<InventoryDomain>(result);
}
