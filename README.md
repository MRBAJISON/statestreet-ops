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

| Name | Description |
| --- | --- |
| `DATABASE_URL` | Neon Postgres connection string |
| `AUTH_SECRET` | Long random string used to sign session cookies |

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
2. Set `DATABASE_URL` and `AUTH_SECRET` as Environment Variables.
3. Deploy. The same Neon database is used in production.

## Security notes
- Sessions are HMAC-signed (tamper-proof); set a strong `AUTH_SECRET` in production.
- Seeded demo passwords should be rotated before real use.
