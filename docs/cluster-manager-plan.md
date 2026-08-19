# One Manager, Two Stores

Plan for the Carbon Shoes Palace + D Angelo Palace cluster. Written 19 August 2026
after the first attempt fell short.

## What was actually asked for

One person manages both shops. From **one login** they need to:

1. Record **every workflow** for either store — not just the daily report.
2. Download a **cluster report** covering both stores, for **daily, weekly and
   monthly**.

## What was built, and where it stops

| Piece | State |
|---|---|
| Daily store report — pick which store | **Done** |
| Daily report PDF — either store | **Done** |
| Weekly cluster PDF | **Done** |
| Monthly cluster PDF | **Done** |
| **Daily cluster PDF** | **Missing** |
| **Weekly review — pick which store** | **Missing** |
| **Customer capture and other typed workflows** | **Missing** |
| **Stock transfer / inventory documents** | **Missing** |
| **My Store dashboard** | **Missing** |
| **Excel export** | **Missing** |

The honest summary: `user_stores` and `accessibleStores()` were added, then wired
into the daily report **and nothing else**. Every other workflow still reads the
single `users.store` code, so this manager can file a daily report for either
shop but silently files everything else against whichever store is on their user
record. That is worse than not supporting it, because it looks like it worked.

## The root cause

`users.store` is one text code, and it is treated as *the* store identity for a
store manager in about eleven places:

- `weekly-reviews.ts` — which store a weekly review belongs to
- `workflow-mutations.ts` — customer capture and the other typed workflows
- `inventory-documents.ts`, `inventory-document-queries.ts` — stock documents
- `reporting/shared.ts` — store resolution for reports
- `api/metrics/[department]` — the My Store dashboard
- `api/export` — the Excel export scope
- `api/reference-data` — the assigned store shown to forms
- `entry-permissions.ts`, `api/entries` — legacy entries

Fixing this one workflow at a time is how the current half-state happened. It
needs one concept that every workflow shares.

---

# Phase 1 — One acting store, used everywhere

**The idea:** a manager has an *acting store* — the shop they are currently
working on. For a manager with one store it is that store and nothing changes.
For this manager it is whichever they have selected.

**Where the choice lives:** a store switcher in the page header, remembered in a
cookie so it survives navigation, with the current store shown on every form that
writes data. A manager doing Carbon's paperwork then D Angelo's switches once,
rather than choosing on every screen — but the form always states which shop it
is about to file against, so a mis-file needs someone to ignore what is on screen.

**The change:**

1. `resolveActingStore(user, requestedStoreId?)` in `store-access.ts` — returns
   the store to act as, rejecting any store not assigned to that user.
2. Replace the `user.store` lookup in each of the eleven sites with it. The
   fallback stays `users.store`, so a single-store manager's behaviour is
   byte-for-byte unchanged.
3. Header switcher, visible only when the account has more than one store.
4. Each write form shows the acting store next to its title.

**Risk.** This is permission code. A mistake either blocks a manager from their
own shop or lets them write to someone else's. It needs tests per store-manager
workflow, and `npm test` is not optional here.

**Size.** Medium — the change per site is small, but there are eleven of them and
they must all move together.

---

# Phase 2 — Daily cluster report

The weekly and monthly cluster PDFs exist. The daily one does not, and it is the
one they will use most.

1. `getStoreGroupDailyReport(group, businessDate)` — both stores' reports for one
   day, combined, with the per-store split. Composed from the existing per-store
   daily report the same way the period one is, so the numbers cannot drift.
2. `StoreGroupDailyReportDocument` — same layout as the single-store daily PDF
   plus a BY STORE block.
3. `GET /api/store-groups/[id]/daily-report/pdf?date=` — same access rule as the
   period route: offered only to someone who can open every member store.
4. A **Daily — combined** entry in the download menu beside the store's own.

**Readiness.** Consistent with the period reports: the combined day is refused
until both stores have submitted that date, naming the store that has not.

**Size.** Small — the pattern is already established and proven.

---

# Phase 3 — Prove it with data

Nothing here has been exercised against a cluster that actually has data in both
stores, because Carbon Shoes Palace has no reports locally.

1. Seed a trading week for Carbon Shoes Palace locally.
2. Open the daily, weekly and monthly cluster PDFs and read them.
3. As the cluster manager, walk every workflow: daily report, weekly review,
   customer capture, stock transfer, dashboard, export — switching stores each
   time and confirming the entry lands against the right one.
4. Confirm a single-store manager sees no switcher and behaves exactly as before.

**This phase is not optional.** The last two rounds of bugs were found by running
the real thing, not by typechecking it.

---

# Order

| # | Work | Depends on | Size |
|---|---|---|---|
| 1 | `resolveActingStore` + header switcher | — | small |
| 2 | Move the eleven sites onto it | 1 | medium |
| 3 | Daily cluster report | — | small |
| 4 | Seed Carbon and walk every workflow | 1-3 | small |

Phase 2's daily cluster report is independent of the acting-store work and could
land first if the report matters more than the workflows.

# Open question

**Should the cluster manager also see a combined view on screen**, or only in the
downloaded PDF? Today the My Store dashboard is per store. A combined dashboard
is a larger piece of work and is not in this plan — say if it is wanted.
