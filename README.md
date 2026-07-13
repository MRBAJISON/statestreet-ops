# StateStreet Operations

StateStreet's internal retail operations and performance system. Store and department teams
capture operational records through role-scoped workflows; executive and department dashboards
read typed PostgreSQL data through server-side reporting APIs.

The application remains a Next.js app on Vercel with PostgreSQL as the durable data layer. A VPS
is not required for the current workload. Kova product synchronization is intentionally out of
scope until its source data and integration contract are reviewed separately.

## Stack

- Next.js 16, React 19, TypeScript, and Tailwind CSS
- shadcn components, Radix primitives, Lucide icons, and Recharts
- PostgreSQL with Drizzle ORM
- Signed, HTTP-only session cookies with database-backed users and session invalidation
- Vitest for contracts, data logic, and PostgreSQL integration tests

## Product Areas

- Executive, Finance, Commercial, Marketing, Operations, Inventory, Brand Health, and store dashboards
- Typed daily store reports with Finance approval and reopen decisions
- Weekly store reviews and assigned actions
- Finance expenses, budgets, cash, forecasts, targets, workbook imports, and safe import undo
- Product catalog with reusable SKUs, prices, brands, and categories
- Goods receipts, transfers, counts, replenishment, and inventory decisions
- Campaigns, customer feedback, customer capture, store standards, incidents, maintenance, and people workflows
- Owner-only user access, role, store assignment, password reset, and impersonation controls
- Public customer-experience survey with explicit contact consent and enforced contact-data retention

See [form inventory](docs/form-inventory.md) for the original workflow inventory,
[dashboard parity](docs/dashboard-parity.md) for the preserved reporting surface, and
[data model](docs/data-model.md) for the typed schema.

## Data Architecture

The application uses first-class relational tables for master data, documents, transactions,
decisions, and audit events. Important examples include:

- `stores`, `brands`, `categories`, `subcategories`, `products`, and `suppliers`
- `daily_reports`, `daily_sales_lines`, and `daily_payment_lines`
- `expenses`, `budgets`, `cash_transactions`, and `performance_targets`
- inventory document headers, lines, movements, balances, and dispositions
- marketing, operations, customer, weekly review, and action tables
- `audit_events`, `import_batches`, and `import_batch_rows`

`entries.payload` is a frozen legacy JSON store retained only as migration evidence and for
historical compatibility. New workflows must not write to it. The old historical workbook export
also remains hidden until a typed export replaces it.

Dashboard data comes from `/api/analytics/*`; typed form writes use `/api/workflows/*`,
`/api/daily-reports`, `/api/inventory-documents/*`, `/api/products`, and related decision routes.

## Roles

- Owner: all dashboards, users, settings, catalog, and targets; no department data-entry impersonation
- Finance: Finance workflows plus cross-department reporting access
- Operations: broad reporting plus the existing cross-department data-entry remit; approvals stay with domain owners
- Commercial, Marketing, Inventory, and Brand: their assigned workflow and dashboard surfaces
- Store manager: assigned-store dashboard, daily report, weekly review, customer capture, and transfer request

API authorization is authoritative. Hiding a navigation item is never treated as access control.

## Requirements

- Node.js 24 or newer
- npm 11.x
- PostgreSQL for local development, or a supported remote PostgreSQL URL

## Local Development

The local workflow creates a disposable `statestreet_ops_local` database through the local
PostgreSQL Unix socket. It never reads the production database URL from `.env.local`.

```bash
npm install
npm run db:local:fresh
npm run dev:local
```

Open [http://localhost:3000](http://localhost:3000). The seed command creates realistic synthetic
StateStreet data and local role accounts; it prints the shared local-only demo password.

`dev:local` reads the `statestreet.local.auth_secret` handle from macOS Keychain through
`agent-secret`. Secrets must not be committed to the repository or printed into logs.

Useful local commands:

```bash
npm run db:local:status
npm run db:local:reset
npm run db:local:seed
```

## Remote Development

For an isolated remote development database, set `DATABASE_URL` and `AUTH_SECRET` in the intended
environment, then apply reviewed migrations:

```bash
npm run db:migrate
npm run db:seed:foundation
npm run db:seed:foundation:apply
npm run dev
```

The first foundation command is a read-only preview. Review its blockers and counts before running
the explicit apply command. Typed analytics return `LEGACY_BACKFILL_REQUIRED` while any historical
daily-report source remains unlinked, so an upgrade cannot silently replace live trading history
with empty charts. Non-trading legacy workflows remain separate release-checklist items.

Do not point development commands at production. Do not use `db:push` as a production migration
strategy.

## Database Commands

- `npm run db:generate` - generate a reviewed SQL migration
- `npm run db:migrate` - apply versioned migrations
- `npm run db:plan-backfill` - inspect legacy-to-typed backfill coverage without writing
- `npm run db:backfill:daily` - preview the idempotent daily-report conversion
- `npm run db:seed:foundation` - preview foundation catalog conversion
- `npm run db:seed:foundation:apply` - apply a reviewed foundation catalog conversion
- `npm run db:studio` - inspect the configured database
- `npm run db:local:fresh` - recreate, migrate, and seed the local database

Migrations are additive. Apply them to an isolated staging database first, review backfill counts
and constraints, and only then plan a production cutover. Do not drop the legacy `entries` table
until production parity has been proven and a rollback window has elapsed.

## Verification

```bash
npx tsc --noEmit
npm run lint
npm test
npm run build
git diff --check
```

Database integration tests are gated so the generic suite cannot mutate an arbitrary configured
database. They additionally refuse database names that do not end in `_test`. Run the complete
database suite against a disposable local database:

```bash
createdb statestreet_ops_test
DATABASE_URL='postgresql:///statestreet_ops_test?host=/tmp' npm run db:migrate
TEST_DATABASE_URL='postgresql:///statestreet_ops_test?host=/tmp' npm run test:db
dropdb statestreet_ops_test
```

## Environment Variables

| Name | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | yes outside `dev:local` | PostgreSQL connection string |
| `AUTH_SECRET` | yes | Secret used to sign session cookies |
| `CRON_SECRET` | yes in production | Secret used to authenticate scheduled retention cleanup |
| `RESEND_API_KEY` | no | Resend key for password-reset email |
| `EMAIL_FROM` | no | Verified sender address for password-reset email |

## Deployment

The existing Vercel project deploys from GitHub `main`. Merging to `main` can trigger production,
so this rebuild must remain local until migrations, role workflows, browser QA, and review are all
approved. See [deployment notes](docs/deployment.md).

## Engineering Notes

- [Rebuild plan](docs/rebuild-plan.md)
- [Data model](docs/data-model.md)
- [Data foundation](docs/data-foundation.md)
- [Form inventory](docs/form-inventory.md)
- [Dashboard parity](docs/dashboard-parity.md)
- [Conventions](docs/conventions.md)
- [Code review](docs/code-review.md)
- [AGENTS.md](AGENTS.md)
