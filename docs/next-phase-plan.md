# Next Phase Plan

Five workstreams, agreed 18 August 2026. This supersedes the "units only" rule
in gap 2 of [capability-gaps.md](capability-gaps.md); the rest of that document
still stands.

Nothing here is built yet. No source has been changed.

## Decisions taken

- Store managers **will** enter units per product. Confirmed.
- The catalogue carries **unit price, stock quantity and barcode**, and is
  **bulk uploaded**, owned by the inventory role.
- Selecting a product **fills in the money** — no typing the amount.
- Category **units and gross totals become the sum of their product lines**.
- **Sell-through gets switched back on**, fed by opening stock.
- **Carbon Shoe Store and D Angelo Palace** report as one unit under one account.
- **Woodpeckers categories** get a new set of names.
- POS integration stays out of scope.

## The one consequence worth reading before anything else

Auto-summing the category totals is a bigger decision than it looks.

Today a manager types one units figure and one gross figure per category, and
the product names are decoration. If those totals instead **add up from the
product lines**, then every item sold has to be entered, or the day's revenue is
understated. Product entry stops being optional colour and becomes the actual
sales record.

That is the full product-level sales model that
[capability-gaps.md](capability-gaps.md) parked as too heavy to type by hand. It
becomes reasonable here only because of two things in this plan: **barcode
lookup** makes each line a scan rather than a typing exercise, and **the price
comes from the catalogue** so there is one number to enter per line, not three.

Three safeguards are therefore not optional:

1. **An "Other" line per category.** Free-typed units and gross, for anything
   not in the catalogue. A missing product must never stop a store closing its
   day. The report shows what share of the day went through "Other" — if that
   climbs, the catalogue is rotting.
2. **The computed total stays editable, with the override recorded.** If the
   lines say GHS 4,600 and the till says GHS 4,800, the manager can set the true
   figure and the difference is visible to Finance rather than silently lost.
3. **A permanent seam in the history.** Everything before go-live is
   category-level with no product breakdown and cannot be backfilled. Every
   trend crossing that date must handle both shapes.

If those three are dropped to save time, this change will quietly understate
revenue. They are the whole safety net.

---

# Workstream 1 — Product catalogue and bulk import

## Where it should live: yes, inventory

Agreed, with one adjustment. The `inventory` role is the right owner for the
**upload** — it is stock data and inventory already owns goods receipts, stock
counts, transfers and replenishment. `commercial` should keep the existing
single-product catalogue form for one-off additions and price changes, since
Commercial owns pricing.

So: inventory bulk-loads and maintains stock; commercial adjusts prices.

## The import infrastructure already exists

`import_batches` and `import_batch_rows` are already in the schema, with row
level error capture and an **undo** path (`status = 'undone'`). The Finance
import in `src/lib/import-finance.ts` already implements the full pattern —
template download, parse, validate, preview, apply. A catalogue import follows
it. This is the cheapest part of the plan.

**Flow:** download template → fill → upload → preview showing new / updated /
rejected counts with per-row errors → apply → batch recorded and undoable.

**Key on SKU.** Re-uploading the same file updates rather than duplicating.
`products_sku_lower_uidx` already enforces this.

## Schema changes

- `products.barcode` — text, nullable, unique when present. Does not exist today.
- Everything else the catalogue needs is already there: `sku`, `name`,
  `brand_id`, `category_id`, `subcategory_id`, `size`, `color`, `unit_cost`,
  `selling_price`, `active`.

## Stock quantity does not belong on the product

This is the one part of the request I would build differently, and the reason
matters.

`products` is a **group-wide** table — one row per SKU for the whole business.
Stock is **per store** and changes with every sale. Putting a quantity on the
product record gives one number shared across every store, wrong the moment
anything sells, and there is no way to ask "how many does Labone have".

There is also **no running stock balance anywhere in the system today**. Stock
exists only as point-in-time events: goods receipts, transfers, stock counts,
and hand-typed figures on replenishment requests and product insights. Nothing
maintains a live on-hand figure.

**Proposal: a `store_stock_levels` table** — store, product, quantity, as-of
date. It is the missing piece, and everything to feed it already exists:

| Movement | Source | Effect |
|---|---|---|
| Opening load | catalogue import, per store | sets the balance |
| Sales | daily report product lines | decreases |
| Goods received | `goods_receipt_lines` | increases |
| Transfers | `stock_transfer_lines` | moves between stores |
| Counts | `stock_count_lines` | corrects to counted truth |

The uploaded quantity becomes the **opening balance per store**, not a product
attribute. The import template therefore carries a store column, and one file
can seed every store.

This is what makes workstream 3 real rather than decorative.

## Barcode search — partial match, suggest as they type

Confirmed: staff type **part** of the barcode, typically the last four digits,
and matching products appear as they type. So this is a search box, not a
scan-and-jump.

- One box, matching across **barcode, SKU and product name** at once. Digits
  clearly mean barcode or SKU; letters mean a name.
- **Partial match, anchored at the end for digits** — typing `4821` finds any
  barcode ending in 4821, then any containing it.
- **Always a list, never an auto-pick.** Four digits will often match more than
  one product, and silently selecting the wrong one puts the sale against the
  wrong item at the wrong price. The list shows name, size, colour and price so
  the right row is obvious.
- Results are **scoped to the store's own products first** (via the brands
  mapped to that store), then the rest of the catalogue.
- **Hardware scanners still work** with no extra code — they type the full
  digits and press Enter, which the same box handles. Scanners are an
  optimisation here, not a requirement.
- **Phone camera scanning is not included** and is a separate build if wanted.

**Performance note.** A trailing or containing match cannot use an ordinary
index. At a few thousand products this does not matter — a straight scan is
fast. If the catalogue grows past roughly fifty thousand rows, add a `pg_trgm`
index or store the barcode reversed for a prefix match. Not worth doing now.

---

# Workstream 2 — Product-level sales on the daily report

## The form

The Sales tab becomes a category with product lines beneath it:

```
Shirts                                    units 11    gross 4,850   (computed)
  [scan or search]  Nike Polo White M      5  ×  350  =  1,750
  [scan or search]  Lacoste Tee Navy L     4  ×  400  =  1,600
  [scan or search]  Ralph Shirt Blue XL    2  ×  550  =  1,100
  Other (not in catalogue)                 —      400
```

- Add a line by **scanning a barcode** or searching name / SKU.
- Enter **units only**. Line value = units × `selling_price` from the catalogue.
- **Line value stays editable** — markdowns and negotiated prices happen. An
  edited line is marked as overridden so it can be told apart from list price.
  Deliberate promotions still belong in the existing Discounts field, which is
  unchanged and still deducted at category level.
- Category units and gross **compute from the lines**, including "Other".
- Category still carries discounts, returns and credit sales as they are today.

## COGS becomes automatic

Currently Finance types COGS per category in the review screen. Once lines carry
products, COGS can be computed as the sum of `units × unit_cost`. Recommendation:
**compute it, but keep Finance's override** — that screen exists because the
computed figure is not always right, and removing the override would be a
regression. The computed value becomes the default rather than a blank field.

`canReadUnitCost` in `src/lib/access.ts` already restricts cost visibility, and
store-manager is **not** in that set. So the form must never send unit cost to
the browser — the line shows selling price only, and COGS is computed
server-side.

## Storage

`daily_report_products` already holds report + category + product-or-free-name.
It gains `units` and `line_value`. That is the product sales line, and it keeps
the shape that a machine could later write.

`daily_sales_lines` keeps its per-category row — it stays the record Finance
approves and every dashboard reads. Its `units_sold` and `gross_revenue` become
derived-on-save rather than typed. **No dashboard, export, PDF or metric needs
rewriting**, which is what makes this affordable.

---

# Workstream 3 — Opening stock and sell-through

## Most of this already exists

`daily_sales_lines.opening_stock` was never removed from the database — only
from the form. It is still in the contracts, the save queries, the read path and
the Excel export. The sell-through calculation is also already written, in
`src/lib/metrics.ts` and `src/lib/reporting/trading.ts`, reading exactly that
column.

So "activate sell-through" is genuinely three steps, not a rebuild:

1. Populate `opening_stock` per category automatically from
   `store_stock_levels` at the start of each business day. Nobody types it.
2. Unhide the sell-through figures on the Store, Commercial and Executive
   overviews.
3. Show it only where the opening figure is real — a category with no stock
   balance shows "—", never 0%.

## Do not unhide it early

Sell-through was hidden precisely because opening stock stopped being captured.
Unhiding before `store_stock_levels` is populated and trustworthy shows every
store at 0% or at absurd percentages, and people stop believing the dashboard.
**Workstream 1 must land, and stock levels must be seeded and reconciled by a
stock count, before this is switched on.**

---

# Workstream 4 — Carbon Shoe Store and D Angelo Palace as one unit

## What the code does today

`users.store` is a **single nullable text column** holding one store code,
compared with `===` in roughly eight places — the daily report API, the PDF
routes, the export scoping, the metrics scoping, reference data, entries, and
the user admin screen. There is no concept of a store group; `stores.type` only
distinguishes store / warehouse / office. `daily_reports` is unique on
(store_id, business_date).

So one account covering two stores is a real change, but a bounded one.

## Three options

**A. Merge them into one store record.** Simplest by far. Also irreversible: you
lose per-store revenue, per-store targets, and the ability to ever separate them
again. **Not recommended** — one building today is not one building forever.

**B. Store group (recommended).** A `store_groups` table plus membership rows.
Both stores keep their own identity, history and targets. The group is what
reports are produced for.

**C. Multi-store user only.** `users.store` becomes a list, with no group
concept. Lighter, but gives no durable identity to report against, so weekly and
monthly combined reports have no stable subject.

## Recommended shape (option B)

- New `store_groups` (id, code, name, active) and `store_group_members`
  (group_id, store_id).
- User access moves from a single `users.store` text value to a membership
  table, so a manager can hold one store, several, or a group. This migration is
  the bulk of the work — those eight comparison sites, the user admin UI, export
  and metrics scoping all move from "equals one code" to "is in this set".
- **Sales are filed per store, via a store selector (decided).** The manager
  picks which shop, then records that shop's sales — the same daily report form
  as everyone else, with the store chosen instead of fixed. Two reports get
  filed on a trading day, one per shop.

  This keeps `daily_reports` exactly as it is, still unique on store and date,
  so **no change to how a day is stored** — the only change is that the manager
  is allowed to pick between their two stores instead of being pinned to one.
- **Reports are produced for the group.** See below.
- The readiness rule carries over unchanged: a group weekly report unlocks when
  **every trading day of every member store** has been submitted.

## The cluster PDF

Yes — recorded per store, reported as one document. Daily, weekly and monthly
each produce a **single PDF for the group**, not two stapled together. This is
the format of the cluster report originally supplied as the reference; the
single-store version already built keeps working unchanged for every other store.

Structure, following that reference:

- **Header** — group name, date or period, the one manager, status.
- **KPI row** — target, net sales, achievement, surplus, all **combined**.
- **Store split** — one row per store: net sales, transactions, achievement.
  This is the section that makes it a cluster report rather than a merge, and it
  is only possible because sales stay recorded per store.
- **Sales breakdown and category sales** — combined, since that is how the
  buying decisions get made.
- **Day by day** (weekly and monthly) — combined totals per trading day.
- **Merchandise, customer requests, observations** — pooled from both stores,
  each tagged with which store it came from.

The individual store PDFs stay available for anyone who wants them — Finance and
Commercial still see the two stores separately everywhere else in the system.

`DailyStoreReportDocument` and `StorePeriodReportDocument` gain a group variant
rather than being replaced, and `store-period-report.ts` gains a group-scoped
query beside the store-scoped one.

## Targets (decided)

**Each store keeps its own target.** The group figure on the cluster report is
the sum of the two, and the achievement percentage is measured against that sum.
No new target machinery is needed, and Commercial carries on setting targets
exactly as it does today.

The per-store split section of the cluster report shows each shop against its
own target, which is what makes the combined achievement figure explicable
rather than a black box.

---

# Workstream 5 — Woodpeckers categories

## Requested set

Pants & Shorts · Hoodies & Sweatshirts · Footwear · Bags & Wallets · Jersey ·
Premium T-Shirts · Accessories · Shirts · Tops & Tees · Headwear · Tracksuits

("tracksuit" as written; normalised here to plural title case to match the rest.
Confirm if the singular lowercase form is deliberate.)

## The catch

Confirmed: Woodpeckers carries a different category set from the other stores.
The system already supports that — `brand_categories` maps brands to categories,
so each brand shows only its own subset.

The catch is one level down. `categories` itself is a **single global list**,
unique on lower(code), shared by every brand that maps to a row in it. Renaming
a row renames it for all of them.

Most of the eleven are probably Woodpeckers-only and rename cleanly. **Footwear
is the obvious exception** — Carbon Shoe Store certainly sells shoes, so it very
likely maps to the same category row. Renaming it there may be perfectly fine,
or may not be what Carbon wants to see on its own reports. That is a decision
per category, not a blanket one, which is why the mapping report comes first.

## The rule (decided)

**If the category already exists in the group, point Woodpeckers at it. If it
does not, rename what Woodpeckers already has.**

This is better than renaming everything, because shared names converge on one
category row for the whole group — footwear sold by Carbon and by Woodpeckers
then rolls up into a single group figure instead of two rows that mean the same
thing.

Applied per category, that gives four cases:

| Name exists in the group? | Woodpeckers has an equivalent? | Action |
|---|---|---|
| Yes | Yes | **Replace** — map Woodpeckers to the group category, move its history across, retire the old one |
| Yes | No | **Map** — simply add the mapping, nothing else to do |
| No | Yes | **Rename** — change the display name in place, history follows automatically |
| No | No | **Create** — new category, mapped to Woodpeckers only |

**Which of the eleven falls into which case cannot be determined from the code.**
It depends on live data, so step one is a read-only mapping report: for each
existing category, its name, which brands map to it, and how many
`daily_sales_lines` rows reference it. The migration is written from that report,
reviewed, then applied.

## The replace case needs care

Rename and map are trivial. **Replace moves history**, and there is one trap.

Woodpeckers sales rows currently point at the old category id. They have to be
repointed at the group category, or the change puts a permanent break in every
Woodpeckers trend. But `daily_sales_lines` is unique on
(daily_report_id, category_id) — so **if any single report already has a row
under both the old and the new category, repointing collides** and the migration
fails. Those pairs have to be merged: units, revenue, cost, discounts, returns
and credit sales added together into one row.

The mapping report must therefore also count how many reports hold both
categories, so the merge is understood before anything is written.

Retire the old category with `active = false` rather than deleting it —
`categories` is referenced with `on delete restrict`, and keeping the row keeps
the audit trail intact.

**Rename `name`, keep `code`.** Codes appear in exports and the legacy entries
payloads. Changing display names is safe; changing codes is a data migration
with a much wider blast radius, and there is no reason to take it on.

## Confirmed

**Jersey, Tops & Tees, Premium T-Shirts and Shirts are genuinely distinct** and
all four stay. Staff have to pick correctly every time, so the daily form should
keep them in a stable order and never reorder them between days — a moving list
is how the wrong one gets picked.

Eleven categories is a long list, but the form only shows categories a store
actually sold that day, so it stays manageable.

---

# Order of work

| # | Workstream | Depends on | Size |
|---|---|---|---|
| 1 | Category mapping report and rename | nothing | small |
| 2 | Catalogue schema (barcode) + bulk import + stock levels | 1 | medium |
| 3 | Product lines on the daily report, auto totals, auto COGS | 2 | medium |
| 4 | Opening stock feed + unhide sell-through | 2, 3 | small |
| 5 | Store groups + combined cluster reports | nothing | medium |

Categories go first because renaming is cheapest before the catalogue is loaded
against them. Store groups are independent of the catalogue work and could run
in parallel or first if the Carbon / D Angelo situation is urgent.

# Answered

- Barcodes are searched by **partial digits with live suggestions**, always
  presenting a list rather than auto-selecting.
- Woodpeckers carries **its own category set**; where a name already exists in
  the group, Woodpeckers is pointed at the existing category rather than a
  duplicate being made.
- Cluster reports are **one combined PDF per group**, with a per-store split.
- `selling_price` is the **shelf price including tax, identical in every store**.
  So one price column on the product is correct — no per-store pricing table,
  and the line value on a sale needs no tax calculation.
- The cluster manager **selects the store, then records that store's sales**.
- **Each store keeps its own target**; the group figure is their sum.

# Still open

None of these block starting. They are sequencing and operational questions
rather than design ones.

1. **Cutover.** When does product-level entry begin, and does one store pilot it
   first or does everyone switch on the same day? This date is the seam in the
   history, so it wants deciding deliberately rather than by accident.
2. **Day-to-day catalogue ownership.** Inventory does the bulk upload, but who
   adds a new arrival mid-week before the next upload? Without an answer,
   everything new lands in the "Other" line and the catalogue quietly decays.
3. **Stock reseeding and the first count.** How often the opening balances are
   reloaded, and how soon after go-live a physical count happens. Sell-through
   cannot be switched on until that count exists.
4. **Training.** The daily form changes shape for every store manager, not only
   the two in the cluster.
5. **Priority.** The order below is a recommendation, not a decision. Workstream
   5 is independent and can go first if the Carbon / D Angelo situation is
   urgent.

# Risks

- **Catalogue completeness is now load-bearing.** Once totals compute from
  product lines, a stale catalogue directly understates revenue. The "Other"
  line and its reported share are the early warning; somebody has to watch it.
- **Stock levels drift.** A running balance with no periodic stock count will be
  wrong within weeks, and sell-through will be wrong with it. Stock counts
  already exist in the system — they need to actually be used.
- **The history seam.** Product-level detail starts on go-live day. Any
  comparison spanning it must be category-level.
- **`users.store` migration.** Eight comparison sites plus the admin UI. This is
  role and access code, so it needs `npm test` and a deliberate review, per
  CLAUDE.md.
