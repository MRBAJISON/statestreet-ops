# StateStreet Retail Group — Operations Command Center

An internal operations system for StateStreet Retail Group. Department teams enter data
through forms; role-based dashboards compute every KPI and chart live from the database.
No mock data — empty states show until real data is entered.

## Stack
- **Next.js 16** (App Router) + React 19 + TypeScript + Tailwind
- **Neon Postgres** via **Drizzle ORM** (`@neondatabase/serverless`)
- **Recharts** for analytics; HMAC-signed session cookies for auth

## Departments
Executive (overview), Finance, Commercial, Marketing, Operations, Inventory, Brand Health.
Each has a data-entry form and a live dashboard. The Executive/CEO sees all dashboards but
no forms; department managers see only their own dashboard + form (Marketing also sees Brand).

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
npm install
npm run db:push                 # create tables in your Neon DB
node scripts/seed-users.mjs     # seed login accounts (run with DATABASE_URL set)
npm run dev                     # http://localhost:3000
```

## Database scripts
- `npm run db:push` — sync schema to the database
- `npm run db:studio` — open Drizzle Studio
- `node scripts/reset-db.mjs` — clear all entries (keeps users)

## Deployment (Vercel)
1. Push to GitHub and import the repo at vercel.com/new (framework auto-detected).
2. In **Settings → Environment Variables** (Production scope), set:
   - `DATABASE_URL` — Neon connection string
   - `AUTH_SECRET` — long random string (`openssl rand -hex 32`)
   - `RESEND_API_KEY` — (optional) for password-reset emails
   - `EMAIL_FROM` — (optional) verified sender address
3. Deploy. The same Neon database is used in production.

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
