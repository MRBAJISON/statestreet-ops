#!/usr/bin/env node
import nextEnv from '@next/env';
import pg from 'pg';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd(), true);

const PAYMENT_FIELDS = [
  ['bank-transfer', 'pay_bank_transfer'],
  ['cheque', 'pay_cheque'],
  ['cash', 'pay_cash'],
  ['mobile-money', 'pay_mobile_money'],
  ['pos-umb', 'pay_pos_umb'],
  ['pos-omnibsic', 'pay_pos_omnibsic'],
];

const databaseUrl = process.env.DATABASE_URL;
const apply = process.argv.includes('--apply');
const actorArgument = process.argv.find((argument) => argument.startsWith('--actor-email='));
const actorEmail = actorArgument?.slice('--actor-email='.length).trim().toLowerCase();

if (!databaseUrl) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}
if (apply && !actorEmail) {
  console.error('--actor-email is required when --apply is used.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: databaseUrl });
const clean = (value) => String(value ?? '').trim();
const normalizedNumber = (value) => clean(value).replace(/[, ]/g, '');
const validNumber = (value) => /^\d+(?:\.\d{1,2})?$/.test(normalizedNumber(value) || '0');
const validCount = (value) => /^\d+$/.test(normalizedNumber(value) || '0');
const amount = (value) => Number(normalizedNumber(value) || '0').toFixed(2);
const count = (value) => Math.trunc(Number(normalizedNumber(value) || '0'));

function validDate(value) {
  const text = clean(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

function referenceMap(rows) {
  return new Map(rows.flatMap((row) => [
    [clean(row.code).toLowerCase(), Number(row.id)],
    [clean(row.name).toLowerCase(), Number(row.id)],
  ]));
}

function referenceId(map, value) {
  return map.get(clean(value).toLowerCase());
}

function appendBlocker(blockers, entry, field, reason) {
  blockers.push(`${entry.department}/${entry.form_type}#${entry.id}:${field}:${reason}`);
}

function reportFor(reports, storeId, businessDate) {
  const key = `${storeId}|${businessDate}`;
  let report = reports.get(key);
  if (!report) {
    report = {
      key,
      storeId,
      businessDate,
      transactions: 0,
      footfall: 0,
      totalCustomers: 0,
      newCustomers: 0,
      returningCustomers: 0,
      sales: new Map(),
      payments: new Map(),
      entries: [],
      latestClosingAtMs: null,
      firstCreatedAt: null,
      lastCreatedAt: null,
    };
    reports.set(key, report);
  }
  return report;
}

function noteSourceTime(report, entry) {
  const timestamp = new Date(entry.created_at);
  if (!report.firstCreatedAt || timestamp < report.firstCreatedAt) report.firstCreatedAt = timestamp;
  if (!report.lastCreatedAt || timestamp > report.lastCreatedAt) report.lastCreatedAt = timestamp;
}

async function buildPlan() {
  const storeResult = await client.query('select id, code, name from stores where active = true');
  const categoryResult = await client.query('select id, code, name from categories where active = true');
  const paymentResult = await client.query('select id, code, name from payment_methods where active = true');
  const entryResult = await client.query(`
    select legacy.id, legacy.department, legacy.form_type, legacy.payload, legacy.created_at
    from entries legacy
    left join daily_report_legacy_entries migrated on migrated.entry_id = legacy.id
    where legacy.department = 'finance'
      and legacy.form_type in ('revenue', 'closing')
      and migrated.entry_id is null
    order by legacy.id
  `);
  const stores = referenceMap(storeResult.rows);
  const categories = referenceMap(categoryResult.rows);
  const paymentMethods = referenceMap(paymentResult.rows);
  const blockers = [];
  const reports = new Map();

  for (const entry of entryResult.rows) {
    const payload = entry.payload ?? {};
    const storeId = referenceId(stores, payload.store);
    const businessDate = clean(payload.date);
    if (!storeId) appendBlocker(blockers, entry, 'store', 'unknown-reference');
    if (!validDate(businessDate)) appendBlocker(blockers, entry, 'date', 'invalid');
    if (!storeId || !validDate(businessDate)) continue;
    const report = reportFor(reports, storeId, businessDate);
    report.entries.push(entry.id);
    noteSourceTime(report, entry);

    if (entry.form_type === 'revenue') {
      const categoryId = referenceId(categories, payload.category);
      if (!categoryId) appendBlocker(blockers, entry, 'category', 'unknown-reference');
      const countFields = ['openingStock', 'transactions', 'footfall', 'itemsSold'];
      const moneyFields = ['grossRevenue', 'cogs', 'discounts', 'creditSales'];
      for (const field of countFields) {
        if (!validCount(payload[field])) appendBlocker(blockers, entry, field, 'invalid-count');
      }
      for (const field of moneyFields) {
        if (!validNumber(payload[field])) appendBlocker(blockers, entry, field, 'invalid-number');
      }
      if (
        !categoryId ||
        countFields.some((field) => !validCount(payload[field])) ||
        moneyFields.some((field) => !validNumber(payload[field]))
      ) continue;
      const grossRevenue = Number(amount(payload.grossRevenue));
      const discounts = Number(amount(payload.discounts));
      const creditSales = Number(amount(payload.creditSales));
      if (discounts > grossRevenue) appendBlocker(blockers, entry, 'discounts', 'exceeds-gross-revenue');
      if (creditSales > grossRevenue - discounts) appendBlocker(blockers, entry, 'creditSales', 'exceeds-net-revenue');
      report.transactions = Math.max(report.transactions, count(payload.transactions));
      report.footfall = Math.max(report.footfall, count(payload.footfall));
      const line = report.sales.get(categoryId) ?? {
        categoryId,
        openingStock: 0,
        unitsSold: 0,
        grossRevenue: 0,
        cogs: 0,
        discounts: 0,
        creditSales: 0,
      };
      line.openingStock += count(payload.openingStock);
      line.unitsSold += count(payload.itemsSold);
      line.grossRevenue += grossRevenue;
      line.cogs += Number(amount(payload.cogs));
      line.discounts += discounts;
      line.creditSales += creditSales;
      report.sales.set(categoryId, line);
      continue;
    }

    const customerFields = ['customers', 'newCustomers', 'returningCustomers'];
    const paymentFields = PAYMENT_FIELDS.map(([, field]) => field);
    for (const field of customerFields) {
      if (!validCount(payload[field])) appendBlocker(blockers, entry, field, 'invalid-count');
    }
    for (const field of paymentFields) {
      if (!validNumber(payload[field])) appendBlocker(blockers, entry, field, 'invalid-number');
    }
    if (
      customerFields.some((field) => !validCount(payload[field])) ||
      paymentFields.some((field) => !validNumber(payload[field]))
    ) continue;
    const totalCustomers = count(payload.customers);
    const newCustomers = count(payload.newCustomers);
    const returningCustomers = count(payload.returningCustomers);
    if (newCustomers + returningCustomers > totalCustomers) {
      appendBlocker(blockers, entry, 'customers', 'breakdown-exceeds-total');
    }
    const closingTime = new Date(entry.created_at).getTime();
    if (report.latestClosingAtMs === null || closingTime >= report.latestClosingAtMs) {
      report.latestClosingAtMs = closingTime;
      report.totalCustomers = totalCustomers;
      report.newCustomers = newCustomers;
      report.returningCustomers = returningCustomers;
      report.payments.clear();
      for (const [code, field] of PAYMENT_FIELDS) {
        const paymentMethodId = referenceId(paymentMethods, code);
        if (!paymentMethodId) appendBlocker(blockers, entry, field, 'unknown-payment-method');
        const value = Number(amount(payload[field]));
        if (paymentMethodId && value > 0) report.payments.set(paymentMethodId, value);
      }
    }
  }

  for (const report of reports.values()) {
    const collision = await client.query(
      'select id from daily_reports where store_id = $1 and business_date = $2 limit 1',
      [report.storeId, report.businessDate]
    );
    if (collision.rowCount) blockers.push(`daily-report:${report.key}:typed-record-already-exists`);
  }

  return {
    reports: [...reports.values()],
    blockers: [...new Set(blockers)].sort(),
    sourceEntries: entryResult.rowCount,
  };
}

async function applyPlan(plan, actorUserId) {
  let salesLines = 0;
  let paymentLines = 0;
  let links = 0;
  for (const report of plan.reports) {
    const created = await client.query(
      `insert into daily_reports (
         store_id, business_date, status, transactions, footfall, total_customers,
         new_customers, returning_customers, lock_version, created_by_user_id,
         updated_by_user_id, submitted_by_user_id, submitted_at, approved_by_user_id,
         approved_at, created_at, updated_at
       ) values ($1, $2, 'approved', $3, $4, $5, $6, $7, 1, $8, $8, $8, $9, $8, $9, $10, $9)
       returning id`,
      [
        report.storeId,
        report.businessDate,
        report.transactions,
        report.footfall,
        report.totalCustomers,
        report.newCustomers,
        report.returningCustomers,
        actorUserId,
        report.lastCreatedAt,
        report.firstCreatedAt,
      ]
    );
    const reportId = Number(created.rows[0].id);
    for (const line of report.sales.values()) {
      await client.query(
        `insert into daily_sales_lines (
           daily_report_id, category_id, opening_stock, units_sold, gross_revenue,
           cogs, discounts, returns, credit_sales, created_at, updated_at
         ) values ($1, $2, $3, $4, $5, $6, $7, 0, $8, $9, $9)`,
        [
          reportId,
          line.categoryId,
          line.openingStock,
          line.unitsSold,
          line.grossRevenue.toFixed(2),
          line.cogs.toFixed(2),
          line.discounts.toFixed(2),
          line.creditSales.toFixed(2),
          report.lastCreatedAt,
        ]
      );
      salesLines += 1;
    }
    for (const [paymentMethodId, value] of report.payments) {
      await client.query(
        `insert into daily_payment_lines (daily_report_id, payment_method_id, amount, created_at, updated_at)
         values ($1, $2, $3, $4, $4)`,
        [reportId, paymentMethodId, value.toFixed(2), report.lastCreatedAt]
      );
      paymentLines += 1;
    }
    for (const entryId of report.entries) {
      await client.query(
        'insert into daily_report_legacy_entries (daily_report_id, entry_id) values ($1, $2)',
        [reportId, entryId]
      );
      links += 1;
    }
    await client.query(
      `insert into audit_events (entity_type, entity_id, action, actor_user_id, metadata, created_at)
       values ('daily-report', $1, 'import', $2, $3, $4)`,
      [reportId, actorUserId, { source: 'legacy-entries', entryCount: report.entries.length }, report.lastCreatedAt]
    );
  }
  return { reports: plan.reports.length, salesLines, paymentLines, links };
}

try {
  await client.connect();
  await client.query('set statement_timeout = 60000');
  await client.query(apply ? 'begin' : 'begin read only');
  await client.query(`select pg_advisory_xact_lock(hashtext('statestreet-daily-report-backfill-v1'))`);
  const plan = await buildPlan();
  let actorUserId = null;
  if (apply) {
    const actor = await client.query(
      `select id from users where lower(email) = $1 and active = true and role in ('owner', 'finance') limit 1`,
      [actorEmail]
    );
    if (!actor.rowCount) plan.blockers.push('actor-email:not-an-active-owner-or-finance-user');
    else actorUserId = Number(actor.rows[0].id);
  }
  const summary = {
    apply,
    sourceEntries: plan.sourceEntries,
    reports: plan.reports.length,
    salesLines: plan.reports.reduce((sum, report) => sum + report.sales.size, 0),
    paymentLines: plan.reports.reduce((sum, report) => sum + report.payments.size, 0),
    legacyLinks: plan.reports.reduce((sum, report) => sum + report.entries.length, 0),
    blockers: plan.blockers,
  };
  if (plan.blockers.length) {
    console.log(JSON.stringify(summary, null, 2));
    throw new Error('Daily-report backfill was refused because review blockers remain.');
  }
  if (apply) {
    const applied = await applyPlan(plan, actorUserId);
    await client.query('commit');
    console.log(JSON.stringify({ ...summary, applied }, null, 2));
  } else {
    console.log(JSON.stringify(summary, null, 2));
    console.log('Preview only. Re-run with --apply and an explicit --actor-email after reviewing this output.');
    await client.query('rollback');
  }
} catch (error) {
  await client.query('rollback').catch(() => undefined);
  console.error((error instanceof Error ? error.message : String(error)).replace(databaseUrl, '[DATABASE_URL]'));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
