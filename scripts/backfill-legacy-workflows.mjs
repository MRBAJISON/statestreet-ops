#!/usr/bin/env node
import { createHash } from 'node:crypto';
import nextEnv from '@next/env';
import { Client } from 'pg';
import {
  actionState,
  clean,
  compareLegacyEntries,
  decimal,
  firstCode,
  legacyStockValue,
  lifecycle,
  maintenanceStatus,
  monthPeriod,
  normalizePhone,
  productStatus,
  score,
  validDate,
  weekStart,
  whole,
} from './lib/legacy-backfill-helpers.mjs';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd(), true);

const databaseUrl = process.env.DATABASE_URL;
const apply = process.argv.includes('--apply');
if (!databaseUrl) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const client = new Client({ connectionString: databaseUrl });
const SYSTEM_EMAIL = 'system-migration@statestreet.local';
const PAYMENT_ALIASES = new Map([
  ['omnibsic', 'pos-omnibsic'],
  ['omnibsic bank', 'pos-omnibsic'],
  ['omnibsic pos', 'pos-omnibsic'],
  ['pos omnibsic', 'pos-omnibsic'],
  ['umb', 'pos-umb'],
  ['umb bank', 'pos-umb'],
  ['umb pos', 'pos-umb'],
  ['pos umb', 'pos-umb'],
  ['momo', 'mobile-money'],
  ['mobile money', 'mobile-money'],
  ['cheque', 'cheque'],
  ['cash', 'cash'],
  ['bank transfer', 'bank-transfer'],
]);

const key = (department, formType) => `${department}/${formType}`;
const money = (value) => decimal(value)?.toFixed(2) ?? null;
const timestamp = (value) => new Date(value);
const hashPayload = (payload) => createHash('sha256').update(JSON.stringify(payload ?? {})).digest('hex');
const referenceMap = (rows) => new Map(rows.flatMap((row) => [
  [clean(row.code).toLowerCase(), row],
  [clean(row.name).toLowerCase(), row],
]));
const reference = (map, value) => map.get(clean(value).toLowerCase());

function appendNote(...parts) {
  const note = parts.map(clean).filter(Boolean).join(' | ');
  return note || null;
}

function block(blockers, entry, reason) {
  const item = { entryId: Number(entry.id), source: key(entry.department, entry.form_type), reason };
  if (!blockers.some((existing) => existing.entryId === item.entryId && existing.reason === item.reason)) {
    blockers.push(item);
  }
}

function operation(operations, entry, type, values) {
  operations.push({ entry, type, values });
}

function retain(operations, entry, reason) {
  operation(operations, entry, 'retained', { note: `Not converted: ${reason}` });
}

async function loadContext() {
  const entriesResult = await client.query(`
    select entry.id, entry.department, entry.form_type, entry.payload, entry.created_at,
      migration.entry_id as migrated_entry_id,
      daily.daily_report_id
    from entries entry
    left join legacy_migration_records migration on migration.entry_id = entry.id
    left join daily_report_legacy_entries daily on daily.entry_id = entry.id
    where migration.entry_id is null
    order by entry.created_at, entry.id
  `);
  const storesResult = await client.query('select id, code, name from stores');
  const brandsResult = await client.query('select id, code, name from brands');
  const categoriesResult = await client.query('select id, code, name from categories');
  const expenseResult = await client.query('select id, code, name from expense_categories');
  const paymentResult = await client.query('select id, code, name from payment_methods');
  const productsResult = await client.query('select id, sku, name, brand_id, category_id from products');
  const brandStoresResult = await client.query('select brand_id, store_id from brand_stores');
  const uniqueTargetsResult = await client.query(`
    select jsonb_build_array('budget', year, expense_category_id) as natural_key
    from budgets where store_id is null
    union all
    select jsonb_build_array('performance-target', store_id, period_start, period_end)
    from performance_targets where scope_type = 'store' and metric = 'net-revenue'
    union all
    select jsonb_build_array('product-insight', lower(product.sku), insight.period_start, insight.period_end)
    from product_insights insight join products product on product.id = insight.product_id
    union all
    select jsonb_build_array('store-standard', store_id, business_date) from store_standard_reviews
    union all
    select jsonb_build_array('vm-review', store_id, business_date) from visual_merchandising_reviews
    union all
    select jsonb_build_array('sop-review', store_id, business_date, area) from sop_reviews
    union all
    select jsonb_build_array('people-snapshot', store_id, business_date) from people_snapshots
    union all
    select jsonb_build_array('inventory-summary', store_id, business_date) from inventory_summary_snapshots
  `);
  const storeBrands = new Map();
  for (const row of brandStoresResult.rows) {
    const values = storeBrands.get(Number(row.store_id)) ?? [];
    values.push(Number(row.brand_id));
    storeBrands.set(Number(row.store_id), values);
  }
  return {
    entries: entriesResult.rows,
    stores: referenceMap(storesResult.rows),
    brands: referenceMap(brandsResult.rows),
    categories: referenceMap(categoriesResult.rows),
    expenseCategories: referenceMap(expenseResult.rows),
    paymentMethods: referenceMap(paymentResult.rows),
    products: new Map(productsResult.rows.map((row) => [clean(row.sku).toLowerCase(), row])),
    storeBrands,
    uniqueTargets: new Set(uniqueTargetsResult.rows.map((row) => JSON.stringify(row.natural_key))),
  };
}

function buildProductSpecs(context, blockers) {
  const specs = new Map();
  for (const entry of context.entries.filter((row) => key(row.department, row.form_type) === 'commercial/sku-entry')) {
    const payload = entry.payload ?? {};
    const sku = clean(payload.sku);
    const name = clean(payload.name ?? payload.description);
    const store = reference(context.stores, payload.store);
    const storeBrandIds = store ? [...new Set(context.storeBrands.get(Number(store.id)) ?? [])] : [];
    const explicitBrand = reference(context.brands, payload.brand);
    const brandId = explicitBrand ? Number(explicitBrand.id) : storeBrandIds.length === 1 ? storeBrandIds[0] : null;
    const category = reference(context.categories, payload.category);
    if (!sku || !name || !brandId || !category) continue;
    const normalizedSku = sku.toLowerCase();
    const existing = specs.get(normalizedSku);
    const typedProduct = context.products.get(normalizedSku);
    if (typedProduct && (Number(typedProduct.brand_id) !== brandId || Number(typedProduct.category_id) !== Number(category.id))) {
      block(blockers, entry, 'product classification conflicts with an existing typed product');
      continue;
    }
    if (existing && (existing.brandId !== brandId || existing.categoryId !== Number(category.id))) {
      block(blockers, entry, 'product classification conflicts with another legacy row');
      continue;
    }
    specs.set(normalizedSku, { sku, name, brandId, categoryId: Number(category.id) });
  }
  for (const entry of context.entries.filter((row) => ['inventory/store-transfer', 'inventory/stock-transfer'].includes(key(row.department, row.form_type)))) {
    const payload = entry.payload ?? {};
    const sku = clean(payload.sku);
    if (!sku || context.products.has(sku.toLowerCase()) || specs.has(sku.toLowerCase())) continue;
    const store = reference(context.stores, payload.fromStore);
    const category = reference(context.categories, firstCode(payload.categories ?? payload.category));
    const brandIds = store ? [...new Set(context.storeBrands.get(Number(store.id)) ?? [])] : [];
    const name = clean(payload.description);
    if (store && category && brandIds.length === 1 && name) {
      specs.set(sku.toLowerCase(), { sku, name, brandId: brandIds[0], categoryId: Number(category.id) });
    }
  }
  return specs;
}

function operationNaturalKey(item) {
  const { type, values } = item;
  if (type === 'budget') return ['budget', values.year, values.expenseCategoryId];
  if (type === 'performance-target') return [type, values.storeId, values.periodStart, values.periodEnd];
  if (type === 'product-insight') return [type, values.spec.sku.toLowerCase(), values.periodStart, values.periodEnd];
  if (type === 'store-standard' || type === 'vm-review' || type === 'people-snapshot' || type === 'inventory-summary') {
    return [type, values.storeId, values.businessDate];
  }
  if (type === 'sop-review') return [type, values.storeId, values.businessDate, values.area];
  return null;
}

function addMoney(left, right) {
  const cents = (value) => {
    const [wholePart, fraction = ''] = String(value).split('.');
    return BigInt(wholePart) * 100n + BigInt(fraction.padEnd(2, '0').slice(0, 2));
  };
  const total = cents(left) + cents(right);
  return `${total / 100n}.${String(total % 100n).padStart(2, '0')}`;
}

function collapseInventorySummaries(operations) {
  const collapsed = [];
  const summaries = new Map();
  for (const item of operations) {
    if (item.type !== 'inventory-summary') {
      collapsed.push(item);
      continue;
    }
    const naturalKey = JSON.stringify(operationNaturalKey(item));
    const existing = summaries.get(naturalKey);
    if (!existing) {
      const aggregate = { ...item, sourceEntries: [item.entry], values: { ...item.values } };
      summaries.set(naturalKey, aggregate);
      collapsed.push(aggregate);
      continue;
    }
    existing.sourceEntries.push(item.entry);
    existing.values.systemQuantity += item.values.systemQuantity;
    existing.values.physicalQuantity += item.values.physicalQuantity;
    existing.values.stockValue = addMoney(existing.values.stockValue, item.values.stockValue);
    existing.values.countedByName = appendNote(existing.values.countedByName, item.values.countedByName);
    existing.values.notes = appendNote(existing.values.notes, item.values.notes);
    if (item.values.createdAt > existing.values.createdAt) existing.values.createdAt = item.values.createdAt;
  }
  return collapsed;
}

function resolveRepeatedUniqueTargets(context, operations, blockers) {
  const unkeyed = [];
  const planned = new Map();
  for (const item of operations) {
    const tuple = operationNaturalKey(item);
    if (!tuple) {
      unkeyed.push(item);
      continue;
    }
    const naturalKey = JSON.stringify(tuple);
    const group = planned.get(naturalKey) ?? [];
    group.push(item);
    planned.set(naturalKey, group);
  }

  const resolved = [...unkeyed];
  for (const [naturalKey, items] of planned) {
    const entries = items.flatMap((item) => item.sourceEntries ?? [item.entry]);
    if (context.uniqueTargets.has(naturalKey)) {
      for (const entry of entries) block(blockers, entry, 'typed destination already exists for this natural key');
      resolved.push(...items);
      continue;
    }
    if (items.length === 1) {
      resolved.push(items[0]);
      continue;
    }

    const ordered = [...items].sort((left, right) => compareLegacyEntries(left.entry, right.entry));
    const latest = ordered.at(-1);
    resolved.push(latest);
    for (const item of ordered.slice(0, -1)) {
      for (const entry of item.sourceEntries ?? [item.entry]) {
        retain(resolved, entry, `superseded by later ${item.type} entry ${latest.entry.id}`);
      }
    }
  }
  return resolved;
}

function buildPlan(context) {
  const operations = [];
  const blockers = [];
  const productSpecs = buildProductSpecs(context, blockers);
  const alreadyBlocked = new Set(blockers.map((item) => item.entryId));

  for (const entry of context.entries) {
    if (alreadyBlocked.has(Number(entry.id))) continue;
    const payload = entry.payload ?? {};
    const source = key(entry.department, entry.form_type);
    const createdAt = timestamp(entry.created_at);

    if (['finance/revenue', 'finance/closing'].includes(source)) {
      if (!entry.daily_report_id) block(blockers, entry, 'daily report link is missing');
      else operation(operations, entry, 'daily-report-ledger', { targetId: Number(entry.daily_report_id) });
      continue;
    }
    if (source === 'admin/org-settings' || source === 'finance/import-log') {
      operation(operations, entry, 'retained', { note: 'Preserved as legacy configuration or import evidence' });
      continue;
    }
    if (source === 'commercial/store-sales' || source === 'commercial/category-perf') {
      operation(operations, entry, 'derived', { note: 'Derived summary; typed daily reports are the source of truth' });
      continue;
    }

    if (source === 'finance/expenses') {
      const businessDate = clean(payload.date);
      const category = reference(context.expenseCategories, payload.category);
      const store = clean(payload.store) ? reference(context.stores, payload.store) : null;
      const paymentCode = PAYMENT_ALIASES.get(clean(payload.paymentMethod).toLowerCase()) ?? clean(payload.paymentMethod);
      const payment = paymentCode ? reference(context.paymentMethods, paymentCode) : null;
      const amount = money(payload.amount);
      if (!validDate(businessDate) || !category || !amount || Number(amount) <= 0) {
        retain(operations, entry, 'expense has an invalid date, category, or amount');
      } else operation(operations, entry, 'expense', {
        businessDate, expenseCategoryId: Number(category.id), storeId: store ? Number(store.id) : null,
        paymentMethodId: payment ? Number(payment.id) : null, amount,
        vendor: clean(payload.vendor) || null, invoiceReference: clean(payload.invoice) || null,
        description: appendNote(
          clean(payload.description) || clean(payload.vendor) || 'Legacy expense',
          clean(payload.store) && !store && `Legacy store or department: ${clean(payload.store)}`,
          paymentCode && !payment && `Legacy payment method: ${clean(payload.paymentMethod)}`
        ),
        overspendReason: clean(payload.overspendReason) || null, createdAt,
      });
      continue;
    }

    if (source === 'finance/budget') {
      const year = whole(payload.year);
      const category = reference(context.expenseCategories, payload.item);
      const amount = money(payload.amount);
      if (!year || year < 2000 || year > 2200 || !category || !amount) retain(operations, entry, 'budget has an invalid year, category, or amount');
      else operation(operations, entry, 'budget', {
        year, expenseCategoryId: Number(category.id), amount, notes: clean(payload.notes) || null, createdAt,
      });
      continue;
    }

    if (source === 'finance/debtors') {
      const amount = money(payload.amount);
      const type = clean(payload.type).toLowerCase();
      const dueDate = clean(payload.dueDate);
      if (!['debtor', 'creditor'].includes(type) || !clean(payload.entity) || !amount || Number(amount) <= 0 || (dueDate && !validDate(dueDate))) {
        retain(operations, entry, 'working-capital row has an invalid type, entity, amount, or due date');
      } else operation(operations, entry, 'working-capital', {
        type, entity: clean(payload.entity), amount, dueDate: dueDate || null,
        notes: appendNote(payload.notes, clean(payload.status) && `Legacy status: ${clean(payload.status)}`, clean(payload.ageDays) && `Legacy age: ${clean(payload.ageDays)} days`),
        createdAt,
      });
      continue;
    }

    if (source === 'commercial/weekly-target') {
      const store = reference(context.stores, payload.store);
      const periodEnd = clean(payload.weekEnd);
      const periodStart = weekStart(periodEnd);
      const value = money(payload.target);
      if (!store || !periodStart || !value) retain(operations, entry, 'weekly target has an invalid store, week, or value');
      else operation(operations, entry, 'performance-target', {
        storeId: Number(store.id), periodStart, periodEnd, value, createdAt,
      });
      continue;
    }

    if (source === 'commercial/sku-entry') {
      const spec = productSpecs.get(clean(payload.sku).toLowerCase());
      const period = monthPeriod(entry.created_at);
      const unitsSold = whole(payload.unitsSold);
      const currentStock = whole(payload.stock);
      const sellThroughPercent = decimal(payload.sellThrough);
      const salesValue = money(payload.salesValue);
      const daysInStock = whole(payload.daysInStock);
      const malformedMetrics = [
        [payload.unitsSold, unitsSold, () => true],
        [payload.stock, currentStock, () => true],
        [payload.sellThrough, sellThroughPercent, (value) => value <= 100],
        [payload.salesValue, salesValue, () => true],
        [payload.daysInStock, daysInStock, () => true],
      ].some(([raw, parsed, valid]) => clean(raw) !== '' && (parsed === null || !valid(parsed)));
      const performance = clean(payload.performance) || null;
      if (!spec || !period) retain(operations, entry, 'product insight cannot be classified');
      else if (malformedMetrics || (performance && !['strong', 'steady', 'underperforming'].includes(performance))) {
        retain(operations, entry, 'product insight has an invalid optional metric or performance value');
      }
      else operation(operations, entry, 'product-insight', {
        spec, periodStart: period.start, periodEnd: period.end, status: productStatus(payload.status),
        performance, campaign: clean(payload.promo) || null,
        insight: clean(payload.insight) || null, unitsSold, currentStock,
        sellThroughPercent, salesValue, daysInStock, createdAt,
      });
      continue;
    }

    if (source === 'commercial/accountability') {
      const state = actionState(payload.status);
      if (!clean(payload.member) || !clean(payload.kpi)) retain(operations, entry, 'accountability row is missing its owner or KPI');
      else operation(operations, entry, 'action-item', {
        title: clean(payload.kpi), ownerName: clean(payload.member), status: state.status, priority: state.priority,
        detail: appendNote(clean(payload.role) && `Role: ${clean(payload.role)}`, clean(payload.target) && `Target: ${clean(payload.target)}`, clean(payload.actual) && `Actual: ${clean(payload.actual)}`, clean(payload.status) && `Legacy status: ${clean(payload.status)}`),
        createdAt,
      });
      continue;
    }

    if (source === 'commercial/customer-capture') {
      const store = reference(context.stores, payload.store);
      const businessDate = clean(payload.date);
      const phoneNormalized = normalizePhone(payload.number);
      if (!store || !validDate(businessDate) || !phoneNormalized || !clean(payload.name)) {
        retain(operations, entry, 'customer capture has an invalid store, date, phone, or name');
      } else operation(operations, entry, 'customer-interaction', {
        storeId: Number(store.id), businessDate, phoneNormalized, phone: clean(payload.number), name: clean(payload.name),
        occupation: clean(payload.occupation) || null, sizePreference: clean(payload.size) || null,
        lifecycle: lifecycle(payload.leadBuyer), source: clean(payload.source) || 'legacy-capture',
        sourceDetail: clean(payload.sourceDetail) || null, interestText: clean(payload.item) || null,
        notes: appendNote(clean(payload.staff) && `Captured by: ${clean(payload.staff)}`), createdAt,
      });
      continue;
    }

    if (source === 'operations/store-audit') {
      const store = reference(context.stores, payload.store);
      const businessDate = clean(payload.date);
      const scores = ['opsScore', 'vmScore', 'readinessScore', 'cxScore', 'cleanScore', 'safetyScore'].map((field) => score(payload[field]));
      if (!store || !validDate(businessDate) || scores.some((value) => value === null)) retain(operations, entry, 'store standards row has an invalid store, date, or score');
      else operation(operations, entry, 'store-standard', {
        storeId: Number(store.id), businessDate, scores, issues: clean(payload.issues) || null, createdAt,
      });
      continue;
    }

    if (source === 'operations/vm-check') {
      const store = reference(context.stores, payload.store);
      const businessDate = clean(payload.date);
      const scores = ['windowDisplay', 'mannequin', 'productPresentation', 'signage'].map((field) => score(payload[field]));
      if (!store || !validDate(businessDate) || scores.some((value) => value === null)) retain(operations, entry, 'VM row has an invalid store, date, or score');
      else operation(operations, entry, 'vm-review', {
        storeId: Number(store.id), businessDate, scores, improvements: clean(payload.improvements) || null, createdAt,
      });
      continue;
    }

    if (source === 'operations/maintenance') {
      const store = reference(context.stores, payload.store);
      const businessDate = clean(payload.date);
      const estimatedCost = clean(payload.cost) ? money(payload.cost) : null;
      if (!store || !validDate(businessDate) || !clean(payload.description) || (clean(payload.cost) && !estimatedCost)) {
        retain(operations, entry, 'maintenance row has an invalid store, date, description, or cost');
      } else operation(operations, entry, 'maintenance', {
        storeId: Number(store.id), businessDate, category: clean(payload.category) || 'other',
        priority: ['low', 'medium', 'high', 'critical'].includes(clean(payload.priority)) ? clean(payload.priority) : 'medium',
        description: appendNote(clean(payload.description), clean(payload.reportedBy) && `Legacy reporter: ${clean(payload.reportedBy)}`),
        assignedToName: clean(payload.assignedTo) || null,
        estimatedCost, status: maintenanceStatus(payload.status),
        createdAt,
      });
      continue;
    }

    if (source === 'operations/sop-check') {
      const store = reference(context.stores, payload.store);
      const businessDate = clean(payload.date);
      const compliance = score(payload.compliance);
      if (!store || !validDate(businessDate) || compliance === null || !clean(payload.area)) retain(operations, entry, 'SOP row has an invalid store, date, area, or score');
      else operation(operations, entry, 'sop-review', {
        storeId: Number(store.id), businessDate, area: clean(payload.area), compliance,
        deviations: clean(payload.deviations) || null, corrective: clean(payload.corrective) || null, createdAt,
      });
      continue;
    }

    if (source === 'operations/hr') {
      const store = reference(context.stores, payload.store);
      const businessDate = clean(payload.date);
      const staffTotal = whole(payload.staffTotal);
      const staffPresent = whole(payload.staffPresent);
      const punctuality = score(payload.punctuality);
      const training = score(payload.training);
      if (!store || !validDate(businessDate) || staffTotal === null || staffPresent === null || staffPresent > staffTotal || punctuality === null || training === null) {
        retain(operations, entry, 'people row has an invalid store, date, count, or score');
      } else operation(operations, entry, 'people-snapshot', {
        storeId: Number(store.id), businessDate, staffTotal, staffPresent, punctuality, training,
        absenceReason: clean(payload.reason) || null,
        notes: appendNote(payload.notes, clean(payload.absences) && `Absences: ${clean(payload.absences)}`, clean(payload.recordedBy) && `Recorded by: ${clean(payload.recordedBy)}`),
        createdAt,
      });
      continue;
    }

    if (source === 'inventory/stock-count') {
      const store = reference(context.stores, payload.store);
      const businessDate = clean(payload.date);
      const systemQuantity = whole(payload.systemQty);
      const physicalQuantity = whole(payload.physicalQty);
      const stockValue = legacyStockValue(payload.stockValue, payload.unitValue, physicalQuantity);
      if (!store || !validDate(businessDate) || systemQuantity === null || physicalQuantity === null || !stockValue) {
        retain(operations, entry, 'inventory summary has an invalid store, date, quantity, or value');
      } else operation(operations, entry, 'inventory-summary', {
        storeId: Number(store.id), businessDate, systemQuantity, physicalQuantity, stockValue,
        countedByName: clean(payload.countedBy) || null, notes: clean(payload.notes) || null, createdAt,
      });
      continue;
    }

    if (source === 'inventory/store-transfer' || source === 'inventory/stock-transfer') {
      const fromStore = reference(context.stores, payload.fromStore);
      const toStore = reference(context.stores, payload.toStore);
      const businessDate = clean(payload.date);
      const quantity = whole(payload.qty ?? payload.units);
      const sku = clean(payload.sku).toLowerCase();
      const product = context.products.get(sku);
      const spec = productSpecs.get(sku);
      const totalValue = clean(payload.totalValue) ? decimal(payload.totalValue) : null;
      const legacyUnitValue = clean(payload.unitValue) ? decimal(payload.unitValue) : null;
      if (!fromStore || !toStore || fromStore.id === toStore.id || !validDate(businessDate) || !quantity || quantity <= 0 || (!product && !spec) || (clean(payload.totalValue) && totalValue === null) || (clean(payload.unitValue) && legacyUnitValue === null)) {
        retain(operations, entry, 'stock transfer has an invalid store, date, product, quantity, or value');
      } else operation(operations, entry, 'stock-transfer', {
        fromStoreId: Number(fromStore.id), toStoreId: Number(toStore.id), businessDate, quantity,
        productId: product ? Number(product.id) : null, spec,
        unitCost: legacyUnitValue === null ? (totalValue === null ? null : (totalValue / quantity).toFixed(2)) : legacyUnitValue.toFixed(2),
        reason: clean(payload.reason) || 'legacy-transfer', authorizedBy: clean(payload.authorizedBy) || null,
        notes: appendNote(clean(payload.description), clean(payload.categories) && `Categories: ${clean(payload.categories)}`, clean(payload.subCategories) && `Subcategories: ${clean(payload.subCategories)}`),
        createdAt,
      });
      continue;
    }

    // Unobserved source shapes are release blockers by design. Silently marking
    // them retained would claim parity without a reviewed typed destination.
    block(blockers, entry, 'legacy form has no approved typed mapping');
  }

  const collapsedOperations = collapseInventorySummaries(operations);
  const resolvedOperations = resolveRepeatedUniqueTargets(context, collapsedOperations, blockers);
  return { operations: resolvedOperations, blockers, sourceEntries: context.entries.length, productSpecs };
}

async function systemActor() {
  const existing = await client.query('select id from users where lower(email) = $1 limit 1', [SYSTEM_EMAIL]);
  if (existing.rowCount) return Number(existing.rows[0].id);
  const created = await client.query(
    `insert into users (name, email, password_hash, role, department, active)
     values ('Data Migration', $1, 'disabled:disabled', 'owner', 'admin', false)
     returning id`,
    [SYSTEM_EMAIL]
  );
  return Number(created.rows[0].id);
}

async function ensureProduct(spec, actorUserId, cache, createdAt) {
  const normalized = spec.sku.toLowerCase();
  if (cache.has(normalized)) return Number(cache.get(normalized).id);
  const result = await client.query(
    `insert into products (sku, name, brand_id, category_id, created_by_user_id, updated_by_user_id, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $5, $6, $6)
     on conflict (lower(sku)) do update set updated_at = products.updated_at
     returning id, sku`,
    [spec.sku, spec.name, spec.brandId, spec.categoryId, actorUserId, createdAt]
  );
  const row = result.rows[0];
  cache.set(normalized, row);
  return Number(row.id);
}

async function audit(entityType, entityId, actorUserId, entry, createdAt) {
  await client.query(
    `insert into audit_events (entity_type, entity_id, action, actor_user_id, metadata, created_at)
     values ($1, $2, 'import', $3, $4, $5)`,
    [entityType, entityId, actorUserId, { source: 'legacy-entry', entryId: Number(entry.id) }, createdAt]
  );
}

async function ledger(entry, actorUserId, disposition, targetType = null, targetId = null, note = null) {
  await client.query(
    `insert into legacy_migration_records (
       entry_id, disposition, target_type, target_id, source_created_at,
       source_payload_hash, note, migrated_by_user_id
     ) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [Number(entry.id), disposition, targetType, targetId, entry.created_at, hashPayload(entry.payload), note, actorUserId]
  );
}

async function applyOperation(item, actorUserId, productCache) {
  const { entry, type, values } = item;
  const sourceEntries = item.sourceEntries ?? [entry];
  let result;
  if (type === 'retained' || type === 'derived') {
    await ledger(entry, actorUserId, type, null, null, values.note);
    return type;
  }
  if (type === 'daily-report-ledger') {
    await ledger(entry, actorUserId, 'converted', 'daily-report', values.targetId, 'Converted by the daily-report backfill');
    return 'converted';
  }
  if (type === 'expense') {
    result = await client.query(
      `insert into expenses (business_date, expense_category_id, store_id, amount, vendor, invoice_reference,
       payment_method_id, description, overspend_reason, created_by_user_id, updated_by_user_id, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,$11,$11) returning id`,
      [values.businessDate, values.expenseCategoryId, values.storeId, values.amount, values.vendor, values.invoiceReference,
        values.paymentMethodId, values.description, values.overspendReason, actorUserId, values.createdAt]
    );
  } else if (type === 'budget') {
    result = await client.query(
      `insert into budgets (year, expense_category_id, store_id, amount, notes, created_by_user_id, updated_by_user_id, created_at, updated_at)
       values ($1,$2,null,$3,$4,$5,$5,$6,$6)
       returning id`,
      [values.year, values.expenseCategoryId, values.amount, values.notes, actorUserId, values.createdAt]
    );
  } else if (type === 'working-capital') {
    result = await client.query(
      `insert into working_capital_items (type, entity, original_amount, open_amount, due_date, status, notes,
       created_by_user_id, updated_by_user_id, created_at, updated_at)
       values ($1,$2,$3,$3,$4,'open',$5,$6,$6,$7,$7) returning id`,
      [values.type, values.entity, values.amount, values.dueDate, values.notes, actorUserId, values.createdAt]
    );
  } else if (type === 'performance-target') {
    result = await client.query(
      `insert into performance_targets (metric, scope_type, store_id, period_type, period_start, period_end, value, unit,
       created_by_user_id, updated_by_user_id, created_at, updated_at)
       values ('net-revenue','store',$1,'week',$2,$3,$4,'money',$5,$5,$6,$6)
       returning id`,
      [values.storeId, values.periodStart, values.periodEnd, values.value, actorUserId, values.createdAt]
    );
  } else if (type === 'product-insight') {
    const productId = await ensureProduct(values.spec, actorUserId, productCache, values.createdAt);
    result = await client.query(
      `insert into product_insights (product_id, period_start, period_end, status, performance, campaign, insight,
       units_sold, current_stock, sell_through_percent, sales_value, days_in_stock,
       created_by_user_id, updated_by_user_id, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13,$14,$14)
       returning id`,
      [productId, values.periodStart, values.periodEnd, values.status, values.performance, values.campaign, values.insight,
        values.unitsSold, values.currentStock, values.sellThroughPercent, values.salesValue, values.daysInStock, actorUserId, values.createdAt]
    );
  } else if (type === 'action-item') {
    result = await client.query(
      `insert into action_items (department, source_type, source_id, title, detail, priority, owner_name, status, completed_at,
       created_by_user_id, updated_by_user_id, created_at, updated_at)
       values ('commercial','legacy-accountability',$1,$2,$3,$4,$5,$6,$7,$8,$8,$9,$9) returning id`,
      [Number(entry.id), values.title, values.detail, values.priority, values.ownerName, values.status,
        values.status === 'completed' ? values.createdAt : null, actorUserId, values.createdAt]
    );
  } else if (type === 'customer-interaction') {
    let customer = await client.query(
      `insert into customers (name, phone, phone_normalized, occupation, size_preference, created_by_user_id, updated_by_user_id, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$6,$7,$7)
       on conflict (phone_normalized) do nothing returning id`,
      [values.name, values.phone, values.phoneNormalized, values.occupation, values.sizePreference, actorUserId, values.createdAt]
    );
    if (!customer.rowCount) {
      customer = await client.query('select id from customers where phone_normalized = $1', [values.phoneNormalized]);
    }
    result = await client.query(
      `insert into customer_interactions (customer_id, store_id, business_date, lifecycle, source, source_detail,
       interest_text, notes, captured_by_user_id, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
      [Number(customer.rows[0].id), values.storeId, values.businessDate, values.lifecycle, values.source,
        values.sourceDetail, values.interestText, values.notes, actorUserId, values.createdAt]
    );
  } else if (type === 'store-standard') {
    result = await client.query(
      `insert into store_standard_reviews (business_date, store_id, operations_score, vm_score, readiness_score,
       customer_experience_score, cleanliness_score, safety_score, issues, reviewed_by_user_id, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)
       returning id`,
      [values.businessDate, values.storeId, ...values.scores, values.issues, actorUserId, values.createdAt]
    );
  } else if (type === 'vm-review') {
    result = await client.query(
      `insert into visual_merchandising_reviews (business_date, store_id, window_display_score, mannequin_score,
       product_presentation_score, size_arrangement_score, improvements, reviewed_by_user_id, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)
       returning id`,
      [values.businessDate, values.storeId, ...values.scores, values.improvements, actorUserId, values.createdAt]
    );
  } else if (type === 'maintenance') {
    result = await client.query(
      `insert into maintenance_requests (business_date, store_id, category, priority, description, assigned_to_name,
       estimated_cost, status, resolved_at, reported_by_user_id, updated_by_user_id, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,$11,$11) returning id`,
      [values.businessDate, values.storeId, values.category, values.priority, values.description, values.assignedToName,
        values.estimatedCost, values.status, values.status === 'completed' ? values.createdAt : null, actorUserId, values.createdAt]
    );
  } else if (type === 'sop-review') {
    result = await client.query(
      `insert into sop_reviews (business_date, store_id, area, compliance_score, deviations, corrective_action,
       reviewed_by_user_id, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$8)
       returning id`,
      [values.businessDate, values.storeId, values.area, values.compliance, values.deviations, values.corrective, actorUserId, values.createdAt]
    );
  } else if (type === 'people-snapshot') {
    result = await client.query(
      `insert into people_snapshots (business_date, store_id, staff_total, staff_present, punctuality_score,
       training_completion_score, absence_reason, notes, recorded_by_user_id, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)
       returning id`,
      [values.businessDate, values.storeId, values.staffTotal, values.staffPresent, values.punctuality, values.training,
        values.absenceReason, values.notes, actorUserId, values.createdAt]
    );
  } else if (type === 'inventory-summary') {
    result = await client.query(
      `insert into inventory_summary_snapshots (business_date, store_id, system_quantity, physical_quantity,
       stock_value, counted_by_name, notes, created_by_user_id, updated_by_user_id, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$8,$9,$9)
       returning id`,
      [values.businessDate, values.storeId, values.systemQuantity, values.physicalQuantity, values.stockValue,
        values.countedByName, values.notes, actorUserId, values.createdAt]
    );
  } else if (type === 'stock-transfer') {
    const productId = values.productId ?? await ensureProduct(values.spec, actorUserId, productCache, values.createdAt);
    result = await client.query(
      `insert into stock_transfers (business_date, from_store_id, to_store_id, status, reason,
       requested_by_user_id, authorized_by_user_id, authorized_at, received_by_user_id, received_at, notes, created_at, updated_at)
       values ($1,$2,$3,'received',$4,$5,$5,$6,$5,$6,$7,$6,$6) returning id`,
      [values.businessDate, values.fromStoreId, values.toStoreId, values.reason, actorUserId, values.createdAt, appendNote(values.notes, values.authorizedBy && `Authorized by: ${values.authorizedBy}`)]
    );
    const line = await client.query(
      `insert into stock_transfer_lines (stock_transfer_id, product_id, quantity, unit_cost, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$5) returning id`,
      [Number(result.rows[0].id), productId, values.quantity, values.unitCost, values.createdAt]
    );
    await client.query(
      `insert into inventory_movements (
         business_date, product_id, store_id, movement_type, quantity, unit_cost,
         source_type, source_id, source_line_id, created_by_user_id, created_at
       ) values
         ($1,$2,$3,'transfer-out',$4,$5,'stock-transfer',$6,$7,$8,$9),
         ($1,$2,$10,'transfer-in',$11,$5,'stock-transfer',$6,$7,$8,$9)`,
      [values.businessDate, productId, values.fromStoreId, -values.quantity, values.unitCost,
        Number(result.rows[0].id), Number(line.rows[0].id), actorUserId, values.createdAt,
        values.toStoreId, values.quantity]
    );
  } else {
    throw new Error(`Unknown migration operation: ${type}`);
  }

  const targetId = Number(result.rows[0].id);
  for (const sourceEntry of sourceEntries) {
    await audit(type, targetId, actorUserId, sourceEntry, timestamp(sourceEntry.created_at));
    await ledger(sourceEntry, actorUserId, 'converted', type, targetId);
  }
  return 'converted';
}

try {
  await client.connect();
  await client.query('set statement_timeout = 120000');
  await client.query('begin');
  await client.query(`select pg_advisory_xact_lock(hashtext('statestreet-legacy-workflow-backfill-v1'))`);
  if (apply) await client.query('lock table entries in share mode');
  const context = await loadContext();
  const plan = buildPlan(context);
  const bySource = Object.fromEntries(Object.entries(
    context.entries.reduce((counts, entry) => {
      const source = key(entry.department, entry.form_type);
      counts[source] = (counts[source] ?? 0) + 1;
      return counts;
    }, {})
  ).sort(([left], [right]) => left.localeCompare(right)));
  const byOperation = Object.fromEntries(Object.entries(
    plan.operations.reduce((counts, item) => {
      counts[item.type] = (counts[item.type] ?? 0) + (item.sourceEntries?.length ?? 1);
      return counts;
    }, {})
  ).sort(([left], [right]) => left.localeCompare(right)));
  const retainedReasons = Object.fromEntries(Object.entries(
    plan.operations.filter((item) => item.type === 'retained').reduce((counts, item) => {
      counts[item.values.note] = (counts[item.values.note] ?? 0) + (item.sourceEntries?.length ?? 1);
      return counts;
    }, {})
  ).sort(([left], [right]) => left.localeCompare(right)));
  const summary = { apply, sourceEntries: plan.sourceEntries, bySource, byOperation, retainedReasons, blockers: plan.blockers };
  if (plan.blockers.length) {
    console.log(JSON.stringify(summary, null, 2));
    throw new Error('Legacy workflow backfill was refused because review blockers remain.');
  }
  if (!apply) {
    console.log(JSON.stringify(summary, null, 2));
    console.log('Preview only. Re-run with --apply after reviewing this output.');
    await client.query('rollback');
  } else {
    const actorUserId = await systemActor();
    const counts = { converted: 0, derived: 0, retained: 0 };
    for (const item of plan.operations) {
      counts[await applyOperation(item, actorUserId, context.products)] += item.sourceEntries?.length ?? 1;
    }
    await client.query('commit');
    console.log(JSON.stringify({ ...summary, applied: counts }, null, 2));
  }
} catch (error) {
  await client.query('rollback').catch(() => undefined);
  console.error((error instanceof Error ? error.message : String(error)).replace(databaseUrl, '[DATABASE_URL]'));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
