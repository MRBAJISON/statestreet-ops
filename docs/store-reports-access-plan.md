# Store Reports for Commercial

Plan for giving Commercial the store reports, and a place to download them from.
Written 19 August 2026.

## The gap is the screen, not the permission

Commercial is **already allowed** to read every store report. All five endpoints
list `commercial` among their readers:

| Endpoint | Commercial allowed |
|---|---|
| `/api/daily-reports/[id]/pdf` | yes |
| `/api/stores/[id]/period-report/pdf` | yes |
| `/api/store-groups/[id]/daily-report/pdf` | yes |
| `/api/store-groups/[id]/period-report/pdf` | yes |
| `/api/daily-reports` (the list) | yes |

But the download button exists in exactly two places, and Commercial can reach
neither:

- `forms/finance/DailyReportReview.tsx` — a Finance screen
- `forms/store-manager/TypedDailyReport.tsx` — a manager's own daily report

So today Commercial would have to hand-build a URL. Nothing needs unlocking; a
screen needs building.

## Where it should live

`/reports` already exists and is already the download page — it currently serves
the Excel export, scoped per role, and Commercial already reaches it.

Adding store reports there rather than inventing a new route keeps one answer to
"where do I get a document from", and reuses the download plumbing that page
already has.

---

# Phase 1 — A store report panel on /reports

A second panel beneath the existing Excel export:

1. **Store** — every active trading store, defaulting to none so nothing is
   downloaded by accident. Store managers see only their own; Commercial,
   Finance, Operations and the owner see all.
2. **Date** — one date field. The daily report uses it directly; the weekly and
   monthly reports use the period containing it, with the resolved range shown
   ("Week — 17 Aug - 22 Aug 2026") so nobody downloads the wrong week.
3. **Three buttons** — Daily, Weekly, Monthly.
4. **Cluster row** — when the chosen store belongs to a group, the group's
   combined Daily / Weekly / Monthly appear beneath, labelled with the group name.

**Refusals are shown, not swallowed.** The endpoints already return a clear 409
naming the days or stores still outstanding; that message goes straight on screen.

**Size.** Small. The panel is new; every endpoint behind it exists and is tested.

---

# Phase 2 — Make the store list the right one per role

`accessibleStores()` answers this for a store manager. Commercial, Finance,
Operations and the owner need the full list of active trading stores.

1. A small `GET /api/stores` returning id, code and name for active stores of
   type `store`, restricted to roles that may read reports.
2. Store managers get their own stores from the same endpoint, so the panel has
   one source rather than a branch per role.

**Size.** Small.

---

# Phase 3 — A recent-reports list (optional, worth considering)

Picking a date blind is awkward when someone wants "the last full week" or "what
did Labone file yesterday". A short list of the most recent submitted reports per
store, each with a download button, removes most of the date-guessing.

This is genuinely optional and I would leave it out of the first cut, but it is
the difference between a usable page and one people avoid.

**Size.** Medium.

---

# Deliberately not included

- **No new permissions.** Commercial can already read these. Nothing about who
  may see what changes, which keeps this out of the risky category.
- ~~No combined-across-all-stores report.~~ **Now wanted.** Commercial gets a
  group report covering every store, in the cluster format: combined totals with
  a per-store split. That split is the point — it answers "how did the group do"
  and "which store carried it" in one document.
- **No changes to the store manager's own screens.** They already download from
  the daily report and keep doing so.

# Order

| # | Work | Depends on | Size |
|---|---|---|---|
| 1 | Store list endpoint | — | small |
| 2 | Store report panel on /reports | 1 | small |
| 3 | Recent submitted reports list | 2 | medium |

# Open question

**Which "manager" should download these?** This plan reads it as the Commercial
manager, using the same `/reports` page. If it means the two-store manager
instead, they can already download from the daily report — including all three
cluster reports — so nothing further is needed there.
