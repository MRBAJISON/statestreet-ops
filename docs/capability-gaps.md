# Capability Gaps

Things the system does not capture yet, and what it would take to close each one.
Kept out of the owner-facing system report deliberately — this is the working
backlog behind it.

## Scope

The app must work **independently**. A POS feed (Kova AI) has been discussed and
may arrive later, but nothing here depends on it and nothing here waits for it.
The one accommodation made for it is a storage shape, noted under gap 2, that
lets a machine write the same rows a person writes — so this work is not thrown
away if a POS lands.

---

## 0. Enabler: upload the product catalogue

Not a gap in itself, but it makes gap 2 work and is worth doing first.

**Today.** Products are added one at a time through the Commercial catalogue
form. Product names on daily reports are free text, so "Nike Air Max", "nike
airmax" and "Air Max" are three different things in the data.

**Why it matters.** Any ranking built on free-typed names fragments: one real
best seller splits into three mediocre ones. Fix the names and the ranking works.

**What it needs.**

- A bulk product import, following the existing Finance import pattern in
  `src/lib/import-finance.ts` — template download, upload, validate, preview,
  apply. Key on SKU so re-uploading updates rather than duplicates.
- Type-ahead on the daily report product field, suggesting the store's own
  products first, then the wider catalogue. Free text stays as a fallback — an
  item missing from the catalogue must never block a day's report.

**One catalogue, not one per store.** `products` is group-wide and unique by
SKU, and `brand_stores` already maps brands to stores, so "what this store
carries" is derivable today with no new structure. A per-store catalogue would
split the same item into separate records, break group-level ranking, and make
stock transfers move what the system thinks are different products.

**Ownership.** The catalogue has to be kept current or the suggestions go stale
and people type free text anyway. Commercial already owns the catalogue form.

**Size.** Small — the import pattern already exists and is proven.

---

## 1. Missed sales are recorded but not valued

**Today.** Customer capture records that someone asked for a product and whether
it was in stock (`customer_interactions.fulfillment_status` — `in_stock` /
`stock_gap`). It does not record how much the lost sale was worth or how many
units were wanted.

**Why it matters.** Commercial reports a weekly "opportunities missed" figure —
GH₵189,670 in the week of 20 July — that is currently totalled by hand off the
back of store conversations. The system holds the fact of the gap but not the
amount, so it cannot produce that number.

This is permanently a manual-capture problem: no till can record the sale that
did not happen. It stays worth building whatever else changes.

**What it needs.**

- Add `quantity` and `value` to `customer_interactions`, plus a `cause`
  (size unavailable, colour unavailable, price, authenticity doubt, discount
  declined). Cause is already the most useful axis in the manual Commercial
  report.
- Extend the Customer Capture form with those fields, shown only when
  `fulfillment_status = 'stock_gap'` (needs the `showWhen` engine, which today
  supports a single field condition — sufficient here).
- Surface a lost-revenue total on the Commercial dashboard and in the weekly and
  monthly store reports, which already have a Customer Requests section to hang
  it off.

**Size.** Small. One migration, one form, one reporting addition.

---

## 2. Sales are tracked by category, not by product

> **Superseded 18 August 2026.** Store managers confirmed they will enter units
> per product, and category totals are to sum from the product lines. That makes
> this the full product-level model rather than the lighter one described below.
> See [next-phase-plan.md](next-phase-plan.md) for what is actually being built.

**Today.** `daily_sales_lines` records units and revenue per **category**, one
row per report per category. `daily_report_products` holds the product names
typed under each category but carries no quantity and no value.

**Why it matters.** Best sellers and slow movers — a full page of the weekly
Commercial report — cannot fall out of the daily figures. Someone re-enters them.

**What it needs.** Add `units` to `daily_report_products`, and give each product
its own line under the category rather than one free-text box holding several
names.

Three rules keep the entry burden survivable:

- **Units only, not value.** One number per product line. A best seller is the
  thing that moved most units; asking for money per line doubles the typing for
  a figure that would be guessed, since discounts differ per item. Money can be
  apportioned from the category revenue later and labelled as an estimate.
- **Product lines need not reconcile to the category total.** The category row
  stays the truth for revenue — it is what Finance approves and what every
  dashboard reads. Product lines are an attributed subset, constrained only to
  not exceed the category total. Forcing an exact match would block submission
  over one forgotten item and push people into fudging numbers at closing.
- **Show the attribution rate.** If a store named products covering 60% of its
  units, the best-seller list is usable; at 15% it is noise. Publishing that
  percentage keeps everyone honest about how much weight to give the ranking.

**Storage shape.** Store these as product sales lines — report, category,
product (catalogue link or free name), units — independent of who filled them
in. A person fills them today; a machine could write the same rows later without
restructuring anything.

**Not doing:** moving `daily_sales_lines` itself to product level. That changes
the daily form, every dashboard reading category sales, the per-category COGS
entry in Finance review, the exports and the PDFs, and leaves a permanent seam
in the history that cannot be backfilled. Hand-typed, it would also decay into
guesswork. Park it unless a machine is feeding the data.

**Open question.** Whether store managers will accurately add a units figure per
product at closing time. Worth asking two or three of them before building —
this is a data-entry burden question, not a technical one. The gap 0 type-ahead
reduces it, since picking a suggestion beats typing a name.

**Size.** Small, after gap 0.

---

## 3. Campaign results are not linked to sales

**Today.** `campaigns` records spend, reach and a hand-entered `revenue_impact`.
Nothing connects a campaign to the transactions it produced.

**Why it matters.** Campaign return on investment is self-reported. The
"Style Without Permission" campaign was reported at GH₵43,310 — a figure nobody
can check.

**What it needs.**

- A link between a sale and a campaign. The cheapest version is a campaign
  reference on `customer_interactions`, so at least attributed walk-ins are
  traceable.
- Attribution rules have to be agreed with Marketing before anything is built —
  what counts as campaign-driven, and over what window. This is a business
  decision, not a schema one.

**Size.** Medium, and blocked on the attribution decision.

---

## 4. The weekly Commercial presentation is assembled by hand

**Today.** Commercial rebuilds a 20-slide deck each week. Most of its figures —
revenue by brand and store, target attainment, average ticket, conversion,
footfall, units per transaction — are already calculated live by the system.

**Why it matters.** It costs a person a day a week, and hand-copying introduces
errors. The 24 July deck had two stores both labelled "Labone Men" and a
repeated "WEEK 4" column header where week 3 belonged.

**What it needs.** Mostly assembly rather than new capture, once gaps 1 and 2
are closed:

- A group-level weekly report generated the same way as the store weekly report
  (`store-period-report.ts` is the pattern to follow).
- Sections that already have their data: brand contribution, store league table,
  productivity trend, risks, actions.
- Sections that depend on the gaps above: missed sales (gap 1), best sellers
  (gap 2), campaign results (gap 3).

**Note.** A design prototype exists from the August 2026 session but is not
wired to data and lives outside the repo.

**Size.** Medium, and best done after gaps 1 and 2.

---

## Order

1. **Gap 0** — catalogue upload and type-ahead. Small, and gap 2 depends on it.
2. **Gap 1** — value the missed sales. Replaces a number Commercial totals by
   hand every week, and no future integration would ever supply it.
3. **Gap 2** — units per named product, pending the conversation with store
   managers about entry burden.
4. **Gap 4** — the group weekly report, once 1 and 2 give it real data.
5. **Gap 3** — leave until Marketing has settled attribution rules.
