# StateStreet Retail Group — Operations Command Center

An internal operations system for StateStreet Retail Group. Department teams enter data
through forms; role-based dashboards compute every KPI and chart live from the database.
No mock data — empty states show until real data is entered.

## Stack
- **Next.js 16** (App Router) + React 19 + TypeScript + Tailwind
- **Neon Postgres** via **Drizzle ORM** (`@neondatabase/serverless`)
- **Recharts** for analytics; HMAC-signed session cookies for auth

## Requirements
- Node.js **24.13.0** (`nvm use`)
- npm **11.x**
- A Neon development database URL

## Departments
Executive (overview), Finance, Commercial, Marketing, Operations, Inventory, Brand Health.
Each has a data-entry form and a live dashboard. The Executive/CEO sees all dashboards but
no forms; department managers see only their own dashboard + form (Marketing also sees Brand).
Finance sees every main department dashboard, including Executive Command, but data entry
stays scoped to Finance forms.

## How it works
- Forms POST submissions to `POST /api/entries` → stored in the `entries` table (jsonb payload).
- Dashboards read `GET /api/metrics/[department]?period=&date=&store=` — aggregated live in
  `src/lib/metrics.ts`. Filters: period (day/week/month/year/all) + calendar date + store.
- Entries can be edited/deleted (`PATCH`/`DELETE /api/entries/[id]`) from the forms and dashboards.

## Environment variables
Create `.env.local` (see `.env.example`):

| Name | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | yes | Neon Postgres connection string |
| `AUTH_SECRET` | yes | Long random string used to sign session cookies |
| `RESEND_API_KEY` | no | Resend API key for password-reset emails. If unset, reset links are logged to the server console instead of emailed. |
| `EMAIL_FROM` | no | From address for emails, e.g. `StateStreet Ops <no-reply@yourdomain.com>`. Sending to arbitrary recipients requires a **verified domain** in Resend. |

## Local development
```bash
nvm use
npm install
cp .env.example .env.local
npm run db:push                 # create tables in your Neon DB
npm run db:seed                 # seed demo login accounts
npm run dev                     # http://localhost:3000
```

Fill `.env.local` before running database commands. `npm run db:push` loads
`.env.local` through the Next.js env loader, so you do not need to manually export
`DATABASE_URL`.

## Database scripts
- `npm run db:push` — sync schema to the database
- `npm run db:studio` — open Drizzle Studio
- `npm run db:seed` — seed demo users (updates seeded passwords on conflict)
- `npm run db:seed:all` — seed users plus sample operating data
- `node scripts/reset-db.mjs` — clear all entries (keeps users)

## Verification
```bash
npm run lint
npm run build
npm run verify:fast
```

`npm run verify:fast` is the default local and CI gate. For schema/setup changes,
also run `npm run db:push` against the intended development database.

## Claude-assisted workflow
This repo is primarily edited through Claude. Start with:

- [`AGENTS.md`](AGENTS.md) for repo-wide instructions
- [`CLAUDE.md`](CLAUDE.md) for Claude behavior
- [`docs/conventions.md`](docs/conventions.md) for shared engineering rules
- [`docs/claude-workflow.md`](docs/claude-workflow.md) for setup and verification
- [`docs/code-review.md`](docs/code-review.md) for the review checklist
- [`docs/deployment.md`](docs/deployment.md) for the current Vercel setup

## Deployment (Vercel)
This repo is already connected to Vercel. Current project details live in
[`docs/deployment.md`](docs/deployment.md).

Important: Vercel production deploys are tied to the GitHub `main` branch.
Do not push to `main` unless the user explicitly wants a production deploy.

### Enabling password-reset emails (Resend)
1. Create an account at resend.com → **API Keys** → create a key (`re_…`).
2. **Domains** → add and verify your domain (DNS records) so you can email any recipient.
   Until a domain is verified, Resend only delivers to your own account email, and the
   default `EMAIL_FROM` (`onboarding@resend.dev`) is test-only.
3. Set `RESEND_API_KEY` and `EMAIL_FROM` (e.g. `StateStreet Ops <no-reply@yourdomain.com>`)
   in Vercel, then redeploy.

## Security notes
- Sessions are HMAC-signed (tamper-proof); set a strong `AUTH_SECRET` in production.
- Seeded demo passwords should be rotated before real use.
