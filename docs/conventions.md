# Conventions

Shared standards for Claude sessions working in this repo.

## Core Principle

Choose the simplest change that fully solves the current task.

- Reuse existing patterns before adding new helpers.
- Prefer local edits over broad refactors.
- Do not rename or redesign adjacent code unless the task requires it.
- Treat scanner output as leads, not truth. Verify findings against real imports
  and runtime behavior.

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Neon Postgres through Drizzle ORM
- HMAC-signed session cookies
- Recharts for dashboards

## Commands

```bash
nvm use
npm install
npm run dev
npm run lint
npm run build
npm run verify:fast
npm run db:push
npm run db:seed
```

## React And Next.js

- Do not use effects for derived state. Compute derived values during render.
- Effects are acceptable for synchronizing with external systems, including
  fetching, cookies, localStorage, and route-driven browser state.
- Keep client components small when a page grows complex.
- Check `node_modules/next/dist/docs/` before changing Next.js config, proxy,
  routing, server components, or build behavior.
- The app intentionally allows `<img>` for runtime data URLs such as uploaded org
  logos and generated QR codes.

## Data And Auth

- `.env.local` is the local source for `DATABASE_URL`, `AUTH_SECRET`, and email
  settings. It must remain ignored.
- `npm run db:push` syncs the Drizzle schema to the configured dev database.
- `npm run db:seed` seeds demo users and resets those demo passwords on conflict.
  Do not run it casually against a shared dev database.
- Session role data is embedded in the signed session token. Role access changes
  must be reflected in both `src/lib/auth.ts` and `src/proxy.ts`.

## Role Access

- Owner: all dashboards plus admin; no data-entry forms.
- Finance: all main department dashboards; Finance forms only.
- Commercial: Commercial dashboard/forms.
- Marketing: Marketing and Brand Health dashboard/forms.
- Operations: broad operational access as currently encoded in `src/proxy.ts`.
- Inventory: Inventory dashboard/forms.
- Brand: Brand Health dashboard/forms.
- Store manager: store-manager dashboard/forms.

## Documentation

When setup or workflow changes, update the docs in the same change:

- `README.md` for human setup.
- `AGENTS.md` and `CLAUDE.md` for Claude instructions.
- `docs/claude-workflow.md` for setup and verification workflow.
- `docs/code-review.md` for review process changes.
