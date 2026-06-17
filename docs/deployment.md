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

## Environment Variables

Vercel currently has these variables configured for Preview and Production:

- `DATABASE_URL`
- `AUTH_SECRET`
- `RESEND_API_KEY`
- `EMAIL_FROM`

Vercel Development env is currently empty. Local development should use a local
`.env.local` file with a development database URL, not production secrets.

## CLI Safety

The local folder may be linked with:

```bash
npx vercel link --yes --scope mrbajisons-projects --project statestreet-ops
```

Important: `vercel link` can rewrite `.env.local` by pulling Vercel Development
environment variables. Since Development env is empty, this can remove local
`DATABASE_URL` and `AUTH_SECRET` values. Back up `.env.local` before linking:

```bash
cp .env.local .env.local.backup
npx vercel link --yes --scope mrbajisons-projects --project statestreet-ops
```

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
