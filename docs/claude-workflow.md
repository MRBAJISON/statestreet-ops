# Partner Workflow

This guide keeps local development repeatable for a non-technical product owner. Local work uses
an isolated disposable PostgreSQL database and must never point at production.

## First Session Setup

```bash
cd /Users/eyacquah/Desktop/projects/statestreet-ops
nvm use
npm install
npm run db:local:fresh
npm run dev:local
```

Open `http://localhost:3000`. The seed command creates realistic StateStreet sample data and prints
the shared password for local demo accounts. `dev:local` reads the local authentication secret from
macOS Keychain through `agent-secret`.

Do not create `.env.local` for ordinary local work. The local scripts deliberately use
`statestreet_ops_local` through the PostgreSQL Unix socket and do not read a production URL.

## Normal Development

```bash
nvm use
npm run dev:local
```

Use `npm run db:local:fresh` when the local data needs to be reset. This deletes and recreates only
the database named `statestreet_ops_local`.

Before handoff:

```bash
npx tsc --noEmit
npm run lint
npm test
npm run build
git diff --check
```

## Product Boundaries

- Use the existing shadcn components and analytics primitives before adding a new UI system.
- Keep dashboard names and sections aligned with `docs/dashboard-parity.md`.
- New data entry must write to typed workflows and tables. Never add writes to `entries.payload`.
- Do not change dashboard calculations inside React components. Calculations belong in
  `src/lib/reporting` and their response types belong in `src/lib/contracts/analytics.ts`.
- Reuse products, stores, brands, categories, suppliers, and payment methods from reference data;
  do not ask users to retype them into each form.

## Browser Verification

For every visible change:

1. Sign in at `http://localhost:3000/login` with the affected local role.
2. Open the changed dashboard or workflow and complete the main interaction.
3. Test at desktop and mobile width.
4. Confirm there are no relevant browser-console errors.
5. Verify that a store manager cannot see another store's data.

## Data and Deployment Safety

- Do not run `db:push`, migration, seed, reset, or cleanup commands against a shared or production
  database.
- Production changes require reviewed versioned SQL migrations and a separate rollout decision.
- Merging to `main` can trigger the production Vercel deployment. A pull request or preview is not
  permission to merge.
- Do not paste database URLs, API keys, reset links, or real customer records into chat, docs,
  screenshots, commits, or pull-request descriptions.
- Read `docs/deployment.md` before any Vercel or production work.

## Handoff Checklist

1. Explain the user-visible change in plain language.
2. List the dashboard-parity sections or workflows affected.
3. Run the verification commands above.
4. Browser-smoke the affected roles.
5. Review the complete diff using `docs/code-review.md`.
6. State what was verified, what was not, and any remaining data or deployment risk.
