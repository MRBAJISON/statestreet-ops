# Data Foundation

StateStreet is moving from generic JSON submissions to typed business tables in
the same Neon database. This is an additive transition: the live screens remain
on `entries` until each workflow is migrated and its totals are reconciled.

## Source-Of-Truth Rules

- `products` is the SKU catalog. Size and color variants are separate SKU rows.
- `daily_reports` is one store/day header. Category sales and payment methods
  are child lines; report-level counts are not repeated by category.
- Finance approves and locks submitted daily reports. Reopening requires a
  reason. Every state change uses optimistic locking and an audit event.
- Inventory documents use headers plus product lines.
- Commercial weekly sales, category performance, cash flow, and the numeric
  parts of weekly reviews will be derived from typed source records.
- Flexible `entries.payload` rows remain transitional records, not the target
  analytics model.

## Schema

`src/lib/db/foundation-schema.ts` defines:

- Master data: stores, brands, category relationships, subcategories, products,
  suppliers, payment methods, and expense categories.
- Trading: daily reports, sales lines, payment lines, and legacy-entry links.
- Inventory: goods receipts, transfers, counts, and replenishment requests, all
  with product lines.
- Finance and CRM: expenses, budgets, customers, and customer interactions.
- Accountability: weekly reviews, review actions, audit events, and import
  batches.

Money uses `numeric(14,2)`, dates use PostgreSQL `date`, timestamps include time
zones, and mutable workflows have foreign keys, constraints, and indexed query
paths.

## API Contracts

- `GET|POST /api/products` searches or creates SKU records. Owner, Commercial,
  Operations, and Inventory may create products.
- `GET|POST /api/daily-reports` lists or creates store/day reports.
- `PUT /api/daily-reports/[id]` replaces an unlocked report using `lockVersion`.
- `PATCH /api/daily-reports/[id]` lets Finance approve or reopen a report.

The server derives the store for store managers and never trusts a client-sent
store assignment. Shared Zod contracts reject duplicate lines, invalid dates,
inconsistent customer totals, and invalid money precision.

The typed store-manager workflow is available only at the unlinked preview route
when `ENABLE_TYPED_DAILY_REPORT_PREVIEW=true`. Keep that flag off in production
until typed reports have parity and the dashboard and Finance readers switch in
the same release.

## Migration Files

- `drizzle/0000_small_naoko.sql` is an idempotent baseline for the three legacy
  tables. It can run against an existing database without recreating them.
- `drizzle/0001_material_expediter.sql` creates the typed foundation.

Use `npm run db:generate` for reviewed schema changes. Use `npm run db:migrate`
only against Neon or another supported remote target. The Drizzle Neon transport
does not migrate local TCP Postgres; local migration tests should apply the SQL
files with `psql`.

Never use `db:push` for a production release.

## Catalog Seed

After the typed migration exists, preview the organization-settings conversion:

```bash
npm run db:seed:foundation
```

The command is read-only unless `--apply` is explicit:

```bash
npm run db:seed:foundation -- --apply
```

Apply runs in one transaction, takes an advisory lock, refuses unresolved
mappings, upserts current values, and marks removed values inactive.

## Legacy Backfill Gate

`npm run db:plan-backfill` is read-only. It reports:

- master-data and product-candidate counts;
- the number of store/day reports, lines, payments, and legacy links;
- unresolved store/category/date values;
- revenue, COGS, discount, credit-sales, and unit parity;
- the intended transaction/footfall correction when repeated category-level
  header counts become one store/day value.

The planner exits `2` when review is required. It never writes or prints customer
records. No production backfill should be written until this output is reviewed
against a fresh production snapshot.

## Release Order

1. Refresh read-only production access and run `db:plan-backfill`.
2. Resolve every blocker and review the header-count correction.
3. Create a Neon branch or backup and apply both migrations there.
4. Preview and apply the foundation catalog seed.
5. Re-run the planner and migration/constraint checks on the branch.
6. Migrate one UI workflow at a time; compare counts and money totals before
   switching dashboard reads.
7. Keep `entries` read-only after parity. Do not delete it during the UI rebuild.
