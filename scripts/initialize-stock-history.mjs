// Read-only by default. Never reads .env files or prints connection information.
import { Client } from 'pg';
import { createHash } from 'node:crypto';
import {
  reconcileOpeningLots,
  OPENING_RECEIPT_DATE,
} from '../src/lib/reporting/stock-aging.ts';
const url = process.env.DATABASE_URL;
if (!url) throw new Error('Supply the intended database through DATABASE_URL.');
const parsed = new URL(url);
const local = ['localhost', '127.0.0.1'].includes(parsed.hostname);
if (!local && !process.argv.includes('--allow-remote'))
  throw new Error(
    'Remote database access requires --allow-remote after rollout review.'
  );
const apply = process.argv.includes('--apply');
const expected = process.argv
  .find((a) => a.startsWith('--expected-hash='))
  ?.split('=')[1];
const client = new Client({ connectionString: url });
await client.connect();
try {
  await client.query('begin');
  if (apply)
    await client.query(
      'lock table store_stock_levels, inventory_movements, daily_reports, daily_report_products, customer_credit_sale_items, customer_deposits, customer_deposit_items, customer_credit_note_redemptions in share row exclusive mode'
    );
  const { rows: levels } =
    await client.query(`select level.store_id::integer as "storeId", level.product_id::integer as "productId", level.quantity,
    current_date::text as date from store_stock_levels level where not exists(select 1 from stock_history_baselines baseline where baseline.store_id=level.store_id and baseline.product_id=level.product_id) order by level.store_id,level.product_id`);
  const { rows: movements } =
    await client.query(`select 'legacy-movement:' || id as key, store_id::integer as "storeId",product_id::integer as "productId", business_date::text as date,
    quantity,movement_type as kind, case when movement_type='receipt' then business_date::text else null end as "receiptDate",
    case when source_type='stock-transfer' then source_type || ':' || source_id else null end as "transferKey",id::integer as "order" from inventory_movements order by business_date,id`);
  const { rows: sales } =
    await client.query(`select 'legacy-sale:' || report.id || ':' || line.product_id as key, report.store_id::integer as "storeId",line.product_id::integer as "productId",
    report.business_date::text as date,-sum(line.units)::integer as quantity,'sale' as kind from daily_report_products line join daily_reports report on report.id=line.daily_report_id
    where report.status<>'draft' and line.product_id is not null group by report.id,line.product_id order by report.id,line.product_id`);
  const { rows: allLevels } = await client.query(
    'select store_id::integer as "storeId",product_id::integer as "productId",quantity from store_stock_levels order by store_id,product_id'
  );
  const { rows: customerSales } = await client.query(`
    select 'legacy-credit:'||item.id as key,sale.store_id::integer as "storeId",item.product_id::integer as "productId",sale.business_date::text as date,-item.quantity as quantity,'sale' as kind
    from customer_credit_sale_items item join customer_credit_sales sale on sale.id=item.credit_sale_id where item.product_id is not null
    union all select 'legacy-deposit:'||item.id,deposit.store_id::integer,item.product_id::integer,deposit.collected_at::date::text,-item.quantity,'sale'
    from customer_deposit_items item join customer_deposits deposit on deposit.id=item.deposit_id where deposit.status='collected'
    union all select 'legacy-replacement:'||id,store_id::integer,replacement_product_id::integer,business_date::text,-1,'sale'
    from customer_credit_note_redemptions where replacement_product_id is not null`);
  const asOf = (await client.query('select current_date::text as date')).rows[0]
    .date;
  const positions = reconcileOpeningLots(
    allLevels,
    [...movements, ...sales, ...customerSales],
    asOf
  );
  const allocations = levels.map((level) => {
    return {
      ...level,
      lots: positions.get(`${level.storeId}:${level.productId}`) ?? [],
    };
  });
  const hash = createHash('sha256')
    .update(
      JSON.stringify({
        allocations,
        movements,
        sales,
        customerSales,
        allLevels,
      })
    )
    .digest('hex');
  console.log(
    JSON.stringify({
      mode: apply ? 'apply' : 'plan',
      products: allocations.length,
      quantity: allocations.reduce((sum, row) => sum + row.quantity, 0),
      assignedReceiptDate: OPENING_RECEIPT_DATE,
      planHash: hash,
    })
  );
  if (apply) {
    if (expected !== hash)
      throw new Error(
        'Plan changed or no matching --expected-hash supplied. Review the read-only plan first.'
      );
    for (const row of allocations)
      await client.query(
        `insert into stock_history_baselines(store_id,product_id,as_of_date,quantity,lots) values($1,$2,$3,$4,$5::jsonb) on conflict do nothing`,
        [
          row.storeId,
          row.productId,
          row.date,
          row.quantity,
          JSON.stringify(row.lots),
        ]
      );
    await client.query(`insert into daily_report_stock_settlements(daily_report_id,product_id,units,applied_units)
      select report.id,line.product_id,sum(line.units)::integer,sum(line.units)::integer from daily_reports report join daily_report_products line on line.daily_report_id=report.id
      where report.status<>'draft' and line.product_id is not null group by report.id,line.product_id on conflict do nothing`);
    if (allocations.length)
      await client.query(
        `insert into audit_events(entity_type,entity_id,action,after) values('stock-history-baseline',0,'create',$1::jsonb)`,
        [
          JSON.stringify({
            hash,
            products: allocations.length,
            assignedReceiptDate: OPENING_RECEIPT_DATE,
          }),
        ]
      );
    await client.query('commit');
  } else await client.query('rollback');
} catch (error) {
  await client.query('rollback');
  console.error(
    error instanceof Error ? error.message : 'Opening allocation failed'
  );
  process.exitCode = 1;
} finally {
  await client.end();
}
