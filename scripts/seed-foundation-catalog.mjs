#!/usr/bin/env node
import nextEnv from '@next/env';
import { Client } from 'pg';
import { buildFoundationCatalog } from './lib/foundation-backfill-plan.mjs';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd(), true);

const databaseUrl = process.env.DATABASE_URL;
const apply = process.argv.includes('--apply');
if (!databaseUrl) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const client = new Client({ connectionString: databaseUrl });
const idMap = (rows) => new Map(rows.map((row) => [String(row.code), Number(row.id)]));

async function loadIds(table) {
  const result = await client.query(`select id, code from ${table}`);
  return idMap(result.rows);
}

async function upsertSimple(table, rows, values, update) {
  for (const row of rows) {
    const params = values.map((key) => row[key]);
    const columns = values.map((value) => `"${value}"`).join(', ');
    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
    await client.query(
      `insert into ${table} (${columns}) values (${placeholders})
       on conflict (lower(code)) do update set code = excluded.code, ${update}, updated_at = now()`,
      params
    );
  }
}

async function deactivateMissing(table, codes) {
  await client.query(`update ${table} set active = false, updated_at = now() where not (lower(code) = any($1::text[]))`, [
    codes.map((code) => code.toLowerCase()),
  ]);
}

try {
  await client.connect();
  await client.query('set statement_timeout = 30000');
  const orgResult = await client.query(
    `select payload from entries
     where department = 'admin' and form_type = 'org-settings'
     order by created_at desc limit 1`
  );
  if (!orgResult.rows[0]?.payload) throw new Error('No stored organization settings row was found.');
  const catalog = buildFoundationCatalog(orgResult.rows[0].payload);
  const blockerCount = Object.values(catalog.blockers).reduce((sum, values) => sum + values.length, 0);
  const summary = {
    apply,
    stores: catalog.stores.length,
    brands: catalog.brands.length,
    categories: catalog.categories.length,
    subcategories: catalog.subcategories.length,
    expenseCategories: catalog.expenseCategories.length,
    paymentMethods: catalog.paymentMethods.length,
    brandStores: catalog.brandStores.length,
    brandCategories: catalog.brandCategories.length,
    blockers: catalog.blockers,
  };
  if (!apply) {
    console.log(JSON.stringify(summary, null, 2));
    console.log('Preview only. Re-run with --apply after reviewing this output.');
  } else {
    if (blockerCount) throw new Error('Catalog contains unresolved mappings; apply was refused.');
    await client.query('begin');
    await client.query(`select pg_advisory_xact_lock(hashtext('statestreet-foundation-catalog-v1'))`);
    await upsertSimple('stores', catalog.stores, ['code', 'name', 'active'], 'name = excluded.name, active = excluded.active');
    await upsertSimple('brands', catalog.brands, ['code', 'name'], 'name = excluded.name, active = true');
    await upsertSimple(
      'categories',
      catalog.categories,
      ['code', 'name', 'sort_order'],
      'name = excluded.name, sort_order = excluded.sort_order, active = true'
    );
    await upsertSimple(
      'expense_categories',
      catalog.expenseCategories,
      ['code', 'name', 'group', 'sort_order'],
      'name = excluded.name, "group" = excluded."group", sort_order = excluded.sort_order, active = true'
    );
    await upsertSimple(
      'payment_methods',
      catalog.paymentMethods,
      ['code', 'name', 'sort_order'],
      'name = excluded.name, sort_order = excluded.sort_order, active = true'
    );
    await deactivateMissing('stores', catalog.stores.map((row) => row.code));
    await deactivateMissing('brands', catalog.brands.map((row) => row.code));
    await deactivateMissing('categories', catalog.categories.map((row) => row.code));
    await deactivateMissing('expense_categories', catalog.expenseCategories.map((row) => row.code));
    await deactivateMissing('payment_methods', catalog.paymentMethods.map((row) => row.code));
    const storeIds = await loadIds('stores');
    const brandIds = await loadIds('brands');
    const categoryIds = await loadIds('categories');
    const brandIdValues = [...brandIds.values()];
    if (brandIdValues.length) {
      await client.query('delete from brand_stores where brand_id = any($1::bigint[])', [brandIdValues]);
      await client.query('delete from brand_categories where brand_id = any($1::bigint[])', [brandIdValues]);
    }
    for (const relation of catalog.brandStores) {
      const brandId = brandIds.get(relation.brandCode);
      const storeId = storeIds.get(relation.storeCode);
      if (!brandId || !storeId) throw new Error('Brand/store mapping references an unknown code.');
      await client.query('insert into brand_stores (brand_id, store_id) values ($1, $2) on conflict do nothing', [brandId, storeId]);
    }
    for (const relation of catalog.brandCategories) {
      const brandId = brandIds.get(relation.brandCode);
      const categoryId = categoryIds.get(relation.categoryCode);
      if (!brandId || !categoryId) throw new Error('Brand/category mapping references an unknown code.');
      await client.query('insert into brand_categories (brand_id, category_id) values ($1, $2) on conflict do nothing', [
        brandId,
        categoryId,
      ]);
    }
    for (const subcategory of catalog.subcategories) {
      const categoryId = categoryIds.get(subcategory.categoryCode);
      if (!categoryId) throw new Error('Subcategory mapping references an unknown category.');
      await client.query(
        `insert into subcategories (category_id, code, name)
         values ($1, $2, $3)
         on conflict (category_id, lower(code)) do update set name = excluded.name, active = true, updated_at = now()`,
        [categoryId, subcategory.code, subcategory.name]
      );
    }
    await deactivateMissing('subcategories', catalog.subcategories.map((row) => row.code));
    await client.query('commit');
    console.log(JSON.stringify(summary, null, 2));
  }
} catch (error) {
  await client.query('rollback').catch(() => undefined);
  console.error((error instanceof Error ? error.message : String(error)).replace(databaseUrl, '[DATABASE_URL]'));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
