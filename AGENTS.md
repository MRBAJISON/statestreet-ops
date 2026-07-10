# AGENTS.md

Read this before changing the repo. Claude is the primary coding assistant for
this project, so keep repo guidance optimized for Claude sessions.

For machine-local conventions shared by all local agents, read
`/Users/eyacquah/.config/local-agents/README.md`.

Shared project conventions live in [`docs/conventions.md`](docs/conventions.md).
Claude setup and verification notes live in [`docs/claude-workflow.md`](docs/claude-workflow.md).
Deployment notes live in [`docs/deployment.md`](docs/deployment.md).
When reviewing code, follow [`docs/code-review.md`](docs/code-review.md).

## Next.js Version Rule

This app uses Next.js 16 and React 19. APIs, lint rules, and config behavior may
differ from older examples. Before changing Next.js routing, config, server
components, image handling, or middleware/proxy behavior, check the relevant
local docs in `node_modules/next/dist/docs/`.

## Working Rules

1. Inspect the relevant files before making claims or edits.
2. Keep changes scoped to the request. Do not bundle redesigns, renames, or broad
   refactors into a cleanup task.
3. Prefer simple, explicit code over speculative abstractions.
4. Preserve current product behavior unless the task explicitly changes it.
5. Do not commit secrets, database URLs, customer data, screenshots containing
   credentials, or raw private payloads.
6. Use `.env.local` for local app config. Keep it ignored by git.
7. Do not push `main` unless the user explicitly wants a production deploy.
8. Run verification before saying work is done.

## Standard Commands

```bash
nvm use
npm install
npm run dev
npm run lint
npm run build
npm run verify:fast
npm test
npm run db:generate
```

Database setup:

```bash
npm run db:push
npm run db:seed
```

Production data-foundation work follows `docs/data-foundation.md`. Never use
`db:push` against production or run a backfill before its read-only plan is
reviewed.

`npm run db:seed` resets the seeded demo users' passwords. Check whether the dev
database already has users before running it.

## Verification Expectations

- For code/config changes: run `npm run verify:fast`.
- For schema/setup changes: also run `npm run db:push` against the intended dev
  database.
- For user-visible UI changes: verify the relevant route in a real browser and
  check the browser console.
- For protected routes: sign in with a seeded local demo user, then verify the
  actual role-specific route.

## Product Access Rules To Preserve

- Owner sees dashboards and admin, but does not use data-entry forms.
- Finance sees all main department dashboards, including Executive Command, but
  only uses Finance forms.
- Marketing sees Marketing and Brand Health.
- Store managers use the store-manager form/dashboard flow.

If you change role access, update `src/lib/auth.ts`, `src/proxy.ts`, sidebar
navigation, and this file together.
