# Claude Workflow

This repo is primarily built with Claude. Keep the workflow simple and repeatable
so a non-technical owner does not have to debug setup drift.

## First Session Setup

```bash
cd /Users/eyacquah/Desktop/projects/statestreet-ops
nvm use
npm install
cp .env.example .env.local
```

Fill `.env.local` with a Neon development `DATABASE_URL`. Use a strong
`AUTH_SECRET` outside local throwaway development.

Then run:

```bash
npm run db:push
npm run db:seed
npm run dev
```

`npm run db:seed` is idempotent for seeded demo accounts, but it updates their
password hashes. Check whether users already exist before running it on a shared
dev database.

## Normal Development

```bash
nvm use
npm run dev
```

Open `http://127.0.0.1:3000`. The root route redirects based on session state.

Before handoff:

```bash
npm test
npm run verify:fast
```

For schema/setup work:

```bash
npm run db:push
npm run db:generate
```

`db:push` is development-only. Test generated SQL against an isolated database
and follow `docs/data-foundation.md` before any remote migration or backfill.

## Browser Verification

Use a real browser for auth-protected UI checks. Minimum UI smoke:

1. Open `http://127.0.0.1:3000/login`.
2. Sign in with an appropriate seeded demo user from `scripts/seed-users.mjs`.
3. Confirm the expected dashboard route renders.
4. Check the browser console for relevant errors.

## Secrets

- Do not paste real database URLs, API keys, reset links, or passwords into chat,
  docs, screenshots, commits, PR descriptions, or instructions.
- Keep local values in `.env.local`, which is ignored by git.
- Read `docs/deployment.md` before using Vercel CLI. `vercel link` can rewrite
  `.env.local`; back it up first.
- Use `/Users/eyacquah/.config/local-agents/README.md` for machine-local secret
  handling conventions.

## Handoff Checklist

For meaningful changes, Claude should finish with a practical handoff:

1. Implement the smallest scoped change.
2. Run `npm run verify:fast`.
3. Run `npm test`; include the isolated database test for persistence changes.
4. Browser-smoke any changed UI route.
5. Re-read the diff using `docs/code-review.md` as a checklist.
6. Tell the user what was verified, what was not verified, and what risks remain.

This is not an independent review system. Recommend a second reviewer only when
the change touches auth, role access, data persistence, exports, or dashboard
calculations.
