# Data Foundation

StateStreet is moving from generic JSON submissions to typed business tables in
the same Neon database. This is an additive transition: legacy rows remain intact,
and typed analytics stay blocked until each historical workflow is reconciled.

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

Store Manager and Finance use the same typed daily-report contract. Store scope is derived from the
authenticated account, while Finance owns approval and reopening decisions.

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
npm run db:seed:foundation:apply
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
  header counts become one store/day value;
- closing-only reports and every repeated closing source link.

The planner exits `2` when review is required. It never writes or prints customer
records. No production backfill should be written until this output is reviewed
against a fresh production snapshot.

After the planner and foundation catalog are clean, preview the supported daily-report conversion:

```bash
npm run db:backfill:daily
```

Apply defaults to a disabled migration actor. An active Owner or Finance account can be supplied
with `--actor-email` when a named migration actor is required:

```bash
npm run db:backfill:daily -- --apply
```

The command is transactional and idempotent through `daily_report_legacy_entries`. It refuses
unknown references, invalid amounts, and collisions with existing typed reports. Closing-only days
become typed reports with zero sales lines so their payments and customer counts remain queryable.
Historical decimal count fields are truncated consistently, and the customer total is raised when
needed to preserve a larger new-plus-returning breakdown. It never invents a store, category, or
payment method.

The analytics API also checks this gate at runtime. If a legacy `finance/revenue` or
`finance/closing` source is not linked to a typed daily report, it returns
`LEGACY_BACKFILL_REQUIRED` instead of serving incomplete trading totals.

Preview the remaining workflow conversion after the daily-report backfill:

```bash
npm run db:backfill:legacy
```

It validates every unmigrated `entries` row before writing. Apply uses a disabled system migration
actor, writes typed records and `audit_events`, and records every source row in
`legacy_migration_records` as converted, derived, or retained. The transaction is refused while
any blocker remains. The approved mappings cover the form types observed in the production release
snapshot; a new or previously unseen legacy form remains a hard blocker until its destination is
reviewed. Historical rows that cannot satisfy a typed contract remain in `entries` and receive an
explicit `retained` ledger record; the migration never guesses missing business facts. Repeated
setpoint and snapshot rows use the latest legacy value while older versions are retained as
superseded evidence. Unique typed destinations are insert-only during migration: an existing typed
row still blocks the run instead of being overwritten. Same-day
aggregate inventory counts are combined before that collision check, and inventory reporting treats
the latest aggregate count as a baseline with only later movements applied. Apply transactions lock
the legacy table while reading and converting it, so a concurrent legacy submission cannot be missed
or copied from a stale payload. Once the ledger is populated, both the API and database reject new
legacy writes as well as changes or deletion of migrated rows, so the raw evidence cannot drift from
the typed copy during the deployment cutover.

## Release Order

1. Refresh read-only production access and run `db:plan-backfill`.
2. Resolve every blocker and review the header-count correction.
3. Create a Neon branch or backup and apply the versioned migrations there.
4. Preview and apply the foundation catalog seed.
5. Preview and apply the daily-report backfill with the disabled migration actor.
6. Preview and apply `db:backfill:legacy`; require zero blockers and full migration-ledger coverage.
7. Re-run the planner, typed counts, money parity, and migration/constraint checks on the branch.
8. Switch dashboard reads only after preview smoke tests pass.
9. Keep `entries` read-only after parity. Do not delete it during the rollback window.
