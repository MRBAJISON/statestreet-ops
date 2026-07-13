# Deployment Notes

This repo is already connected to Vercel. Do not import it as a new Vercel
project unless the current production project is being intentionally replaced.

## Current Vercel Project

- Vercel account/scope: `mrbajisons-projects`
- Vercel project: `statestreet-ops`
- Production URL: `https://statestreet-ops.vercel.app`
- GitHub source: `MRBAJISON/statestreet-ops`
- Production branch: `main`
- Framework preset: Next.js
- Node.js version: 24.x
- Root directory: repo root
- Build command: Vercel default for Next.js (`npm run build` / `next build`)
- Install command: Vercel default package-manager install

Pushing to `main` is expected to create a Production deployment. Do not push to
`main` unless the user explicitly wants to deploy.

## Database Release Gate

Application deploys do not automatically make a production schema change safe.
For data-foundation releases, follow `docs/data-foundation.md`: run the read-only
planner, test migrations on a Neon branch or backup, preview and apply master data,
reconcile legacy rows, and only then switch application reads. The analytics API
returns `LEGACY_BACKFILL_REQUIRED` until that gate is clean. Never run `npm run
db:push` against production.

## Environment Variables

Vercel currently has these variables configured for Preview and Production:

- `DATABASE_URL`
- `AUTH_SECRET`
- `RESEND_API_KEY`
- `EMAIL_FROM`

Before releasing the survey contact workflow, add `CRON_SECRET` to Production. The daily job in
`vercel.json` calls `/api/cron/customer-data-retention`; the route refuses to run when the secret
is missing or the request is not authenticated.

Vercel Development env is currently empty. Local development uses the isolated
`statestreet_ops_local` PostgreSQL database and the `statestreet.local.auth_secret`
Keychain handle through `npm run dev:local`; it must not pull production secrets.

## CLI Safety

The local folder may be linked with:

```bash
npx vercel link --yes --scope mrbajisons-projects --project statestreet-ops
```

Important: do not run `vercel env pull` into this workspace. Local development is
deliberately independent of Vercel environment variables.

Read-only inspection commands:

```bash
npx vercel whoami
npx vercel project inspect statestreet-ops
npx vercel ls
npx vercel env list production
npx vercel env list preview
npx vercel env list development
```

Avoid these unless the user explicitly asks:

- `vercel`
- `vercel --prod`
- `git push origin main`
- `vercel env pull .env.local --environment=production`

Those can deploy, expose production values locally, or change the active local
environment.
