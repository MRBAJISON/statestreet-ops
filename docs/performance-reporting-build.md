# Store performance and review reporting

Implementation branch: `codex/store-performance-reviews`. Production release verification is recorded below.

## Agreed rules

- Daily source records feed weekly financial PDFs and monthly financial totals.
- Weekly reviews remain per store. A cluster has one combined monthly review.
- Final monthly performance download requires all trading-day reports, all overlapping weekly reviews (including the cross-month final week), and a submitted monthly review with current narrative confirmation.
- Ordinary financial-summary PDFs remain independent of monthly review readiness.
- Automated product rankings use real product units and values. Unmatched or missing product coverage is disclosed.
- Non-moving means 30 calendar days with no recorded sale and sufficient observation. Stock at risk is non-moving OR remaining quantity older than 90 days; count the union once at selling price.
- Assigned receipt date for imported opening stock is 2026-07-01. Preserve verified receipt history and current quantities. This is an aging assumption, not proof of historical balances.
- Templates produce factual executive commentary; source-attributed weekly extracts provide explanations. Managers confirm/edit narrative but cannot override calculations.
- No external AI service, POS integration or Commercial presentation prototype.

## Rollout gate

1. Apply reviewed migration 0024 only to the isolated development database first.
2. Run `node scripts/initialize-stock-history.mjs` with DATABASE_URL supplied securely. Read-only by default; no customer payload or URL is printed.
3. Review counts/hash, then rerun with `--apply --expected-hash=<reviewed hash>`. Existing balances require this before accepting stock mutations. Re-running is idempotent.
4. Production requires a separate rollout decision, migration test on a backup/branch and reviewed opening allocation before application activation. Pause all stock-writing workflows across migration, baseline and code activation: running the previous sales-settlement code alongside the new triggers could double-post stock. Never use db:push on production.

Use Node 24 (the repository runtime) for the opening-history script. Its plan hash covers source movements and current balances; a changed plan must be reviewed again. It never claims that today's opening allocation establishes historical daily on-hand. Existing imports with missing receipt dates are explicitly marked as assigned; new undated adjustments remain unknown.

## Implementation verification checklist

- [x] Stock source reconciliation, July baseline and retry/correction tests.
- [x] Shared product analysis and automatic weekly category fields.
- [x] Weekly PDF review appendix.
- [x] Monthly review, generated narrative and action carry-forward.
- [x] Monthly performance PDF, access and readiness checks.
- [x] Automated checks and browser/PDF visual verification (build limitation below).

Existing daily product save queries dropped quantities and values before this build. The fix preserves future submissions; historical product coverage must be disclosed, not reconstructed by guessing. Review source audit evidence separately before any historical restoration.

## Local verification record

- Migration 0024 applied transactionally to local development and isolated test databases; a development backup was taken first. Production untouched.
- Reviewed local opening allocation: 983 stock positions, 13,444 units. Applying the baseline left all quantities unchanged; retry and audit-count checks passed.
- Isolated `npm run db:push` completed without truncating tables. Production will use reviewed SQL, not schema push.
- Database tests cover optimistic edit conflicts, approval eligibility, source/action corrections, cluster authorization, cross-month weeks, baseline retries, sale reopen/resubmit, reservations, deposit pickup, approved returns and replacement stock.
- Existing reporting, weekly-review, inventory-document, ledger and export regression suites have been exercised. Updated manual-insight expectations now assert recorded sales instead.
- PDF stress fixture includes two stores, 45 product positions, missing prices, unmatched products and multi-page category commentary. Table headers repeat in bounded blocks; financial ratios use combined denominators.
- All 196 tests passed together with the isolated test database enabled (30 test files), including the empty-month/recurring-target regression. Focused narrative/stock and weekly suites also passed during the integrity refinements.
- Local browser checks: the authorized Palace manager gets one cluster option, draft save/reload works, advisor achievement and reconciliation warnings work, missing daily/weekly sources block final submission/download, and all weekly categories require written comments. Computed risk and inactivity fields are read-only.
- Finance and Owner were signed in separately: manager-form URLs redirect away, monthly reporting is read-only and no draft-save controls are exposed. Commercial and Inventory display the shared product analysis. No relevant browser-console errors were observed.
- The monthly form was checked at desktop and 390px phone width. All 12 pages of the large PDF fixture were visually inspected against the reference's navy/orange treatment.
- The local database was also missing pre-existing migration 0019; applying that reviewed SQL locally restored customer stock-gap loading. No production schema was inspected or changed.
- The standard Turbopack build did not finish on this low-memory Windows machine. The final direct Node 24 `node node_modules/next/dist/bin/next build --webpack` build passed, including TypeScript and all 69 generated pages. Full lint and a focused recheck after the last edits passed. No project build configuration was changed.
- Final rebuilt-browser checks passed: switching Carbon to D'Angelo changes the weekly title and category set, saving-and-refreshing preserves edited narrative and clears confirmation, and the Store product table expands/collapses from ten rows. Incomplete stock observation displays `Valuation incomplete` rather than a misleading zero amount. The local server is running on port 3000 with the monthly review open for testing.

## Local testing handoff

- Store workflows → Monthly performance review. Select a month; the Palace account uses the combined cluster while other managers use their assigned store.
- Check the completion checklist before attempting a final PDF. Missing cross-month weekly reviews intentionally block it; normal monthly financial summaries remain separate.
- A clearly labelled `LOCAL QA DRAFT` for the Palace cluster in August was saved during browser verification. It is local sample data only and has not been submitted.
- Weekly review → Category notes retains the expandable layout. Switching stores reloads the selected store's review and source evidence.
- Refreshing an edited monthly review saves the wording as an unconfirmed draft before refreshing facts. The manager must check the refreshed sources again.
- At the initial local handoff, production rollout and production baseline reconciliation were outstanding. A successful local build alone is not authorization to merge or deploy.

## Production release — 12 September 2026

- The user authorized deployment and the short submission pause. Implementation commit `c578a69` was fast-forwarded to `main` and deployed through the existing Vercel project.
- Migration 0024 and the opening allocation were first rehearsed on an isolated Neon branch. The allocation used the committed FIFO module, with a database-computed source fingerprint checked before and after application. A repeat applied no additional allocations or audit rows.
- A separate pre-release backup branch, `backup-before-performance-0024-20260912`, was retained without a compute endpoint. The rehearsal branch was also retained; neither is connected to the application.
- Temporary database guards paused sales, customer-transaction, catalog and stock writes during cutover. Migration 0024, the reviewed opening allocations and its migration-ledger entry were committed atomically. All temporary guards were removed after the production deployment was ready.
- Before/after checksums matched for existing daily reports, sales/payment/product lines, weekly reviews/category notes, customer credit/deposit records, stock balances, movements and catalog products. Stock quantities did not change, and initialization created no new stock movements.
- Production's earlier migration ledger was pre-existing and incomplete; historical migrations were not re-run or retroactively marked as applied. Only the migration actually applied in this release was registered.
- Verification: the earlier complete 196-test run plus a fresh 15-test stock/review regression run passed. Vercel's production build passed. Live sign-in returned 200; unauthenticated new APIs returned 401. The existing signed-in manager session loaded both the Store product-analysis panel and Monthly performance review without browser errors. No live sales, reviews or customer transactions were submitted for testing.
- Historical missing product detail remains explicitly disclosed. A code-only rollback to the former stock-writing implementation is unsafe with migration 0024 active; coordinate any rollback with the matching database state and preserve subsequent transactions.
