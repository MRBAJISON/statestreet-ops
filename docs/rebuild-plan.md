# Local Rebuild Plan

The rebuild is developed and reviewed locally before any production migration,
merge, or deployment decision.

## Architecture Decision

- Keep the existing Next.js 16 application.
- Keep Vercel as the current production runtime; a VPS does not solve the data
  or UX problems and adds operations work.
- Keep one PostgreSQL database in production and use a separate local PostgreSQL
  database for development.
- Add a local `pg` adapter while retaining Neon HTTP for Vercel.
- Move workflows from generic `entries.payload` to typed tables one domain at a
  time.
- Build dashboards on server-side SQL reporting queries.

## Data Safety

- Local setup refuses non-local database hosts.
- Demo reset and seed commands are local-only and idempotent.
- Demo data may use real StateStreet store, brand, category, and product naming,
  but never production customer identities or verbatim transactions.
- Migrations are additive and reviewed SQL.
- Production remains untouched in this phase.
- Legacy JSON rows remain read-only until a later production parity review.

## Delivery Sequence

### 1. Contract and local platform

- Freeze the form parity contract and target schema.
- Add the local database adapter and safe setup/reset commands.
- Apply migrations to an isolated local database.
- Seed role accounts, reference data, products, and realistic synthetic history.

### 2. Typed source workflows

- Daily store report and Finance review.
- Products and customer capture.
- Inventory documents and ledger.
- Expenses, budgets, cash, working capital, capital, and forecasts.
- Targets, weekly reviews, and actions.
- Marketing, operations, and brand-health source records.

### 3. Reporting layer

- Implement typed reporting contracts and SQL query functions.
- Reconcile daily, weekly, monthly, store, brand, category, and group totals.
- Build attention signals from explicit thresholds and overdue states.

### 4. Product experience

- Replace the application shell and navigation.
- Build the executive overview first as the visual quality reference.
- Build role dashboards from shared reporting components.
- Rebuild forms around prefill, derivation, drafts, inline validation, recent
  records, and clear approval states.
- Verify desktop, compact laptop, tablet, and mobile layouts.

### 5. Parity and cleanup

- Exercise every role and workflow against the local database.
- Compare the parity contract with the implemented routes and pages.
- Remove unused legacy UI, metrics, and generic-write code only after all rebuilt
  paths pass.
- Keep migration-only legacy readers until production cutover planning.

### 6. Closeout

- Run lint, unit tests, database integration tests, and production build.
- Run browser workflows and visual checks across roles and viewports.
- Run `codex-review`, fix every actionable finding, and repeat until clean.
- Launch the final local server and provide the URL and demo role credentials.

## Visual Thesis

StateStreet becomes a bright retail-intelligence product rather than a dark
command-center theme. Official shadcn primitives provide familiar controls and
states, while a cool green-tinted foundation, emerald actions, cobalt actuals,
amber targets, coral risk, teal, and orchid give the product a distinct palette.

The executive screen is one analytical workspace: an inline KPI rail, a dominant
revenue-versus-target canvas, store ranking, category contribution, cash and
margin context, and a short attention queue. Softly layered analytical bands,
subtle depth, and varied information density create a smooth visual rhythm;
repeated flat boxes do not.

Forms use a calm work surface with stable section dimensions, product/reference
selectors, prefilled context, derived summaries, and explicit draft/submit states.
Motion is limited to useful transitions, cross-highlighting, and feedback.
