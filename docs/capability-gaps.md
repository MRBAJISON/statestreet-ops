# Capability Gaps

Things the system does not capture yet, and what it would take to close each one.
Kept out of the owner-facing system report deliberately — this is the working
backlog behind it.

Ordered by what unlocks the most downstream value, not by effort.

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

**What it needs.**

- Add `quantity` and `value` to `customer_interactions`, plus a `cause`
  (size unavailable, colour unavailable, price, authenticity doubt, discount
  declined). Cause is already the most useful axis in Commercial's manual report.
- Extend the Customer Capture form with those fields, shown only when
  `fulfillment_status = 'stock_gap'` (needs the `showWhen` engine, which today
  supports a single field condition — sufficient here).
- Surface a lost-revenue total on the Commercial dashboard and in the weekly and
  monthly store reports, which already have a Customer Requests section to hang
  it off.

**Size.** Small. One migration, one form, one reporting addition.

---

## 2. Sales are tracked by category, not by product

**Today.** `daily_sales_lines` records units and revenue per **category**.
Product-level detail exists only as free-typed names on
`daily_report_products`, which carry no quantity or value, and as separately
entered `product_insights` rows.

**Why it matters.** Best sellers and slow movers — a full page of Commercial's
weekly report — cannot fall out of the daily figures. Someone re-enters them.
It also means the product catalogue and actual sales never reconcile.

**What it needs.** Two honest options:

- **Lighter:** add `quantity` and `value` to `daily_report_products` so the
  products a store already types in carry numbers. Gets best sellers for free.
  Does not give slow movers, which need stock ageing.
- **Fuller:** move `daily_sales_lines` to product-level lines with category
  derived from the product. Correct, but it changes the shape of the daily
  report form, every dashboard that reads category sales, and needs a backfill
  plan for existing rows.

**Recommendation.** Start with the lighter option and see whether product-level
daily entry is realistic for store staff before committing to the fuller one.
Ask the store managers first — this is a data-entry burden question, not a
technical one.

**Size.** Lighter: small. Fuller: large, and touches the data foundation.

---

## 3. Campaign results are not linked to sales

**Today.** `campaigns` records spend, reach and a hand-entered
`revenue_impact`. Nothing connects a campaign to the transactions it produced.

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

## 4. Commercial's weekly presentation is assembled by hand

**Today.** Commercial rebuilds a 20-slide deck each week. Most of its figures —
revenue by brand and store, target attainment, average ticket, conversion,
footfall, units per transaction — are already calculated live by the system.

**Why it matters.** It costs a person a day a week, and hand-copying introduces
errors. The 24 July deck had two stores both labelled "Labone Men" and a
repeated "WEEK 4" column header where week 3 belonged.

**What it needs.** Mostly assembly rather than new capture, once gaps 1–3 are
closed:

- A group-level weekly report generated the same way as the store weekly report
  (`store-period-report.ts` is the pattern to follow).
- Sections that already have their data: brand contribution, store league table,
  productivity trend, risks, actions.
- Sections that depend on the gaps above: missed sales (gap 1), best sellers and
  slow movers (gap 2), campaign results (gap 3).

**Note.** A design prototype exists from the August session but is not wired to
data and lives outside the repo.

**Size.** Medium, and best done after gaps 1 and 2.

---

## Suggested order

1. **Gap 1** — smallest, and immediately replaces a number Commercial totals by
   hand every week.
2. **Gap 2, lighter option** — unlocks best sellers, pending a conversation with
   store managers about entry burden.
3. **Gap 4** — the group weekly report, once 1 and 2 give it real data.
4. **Gap 3** — leave until Marketing has settled attribution rules.
