# Woodpeckers Category Mapping

Worked from a read-only snapshot of production categories, brand mappings and
sales-row counts taken 18 August 2026.

## Headline: no sales data moves

The migration is **mapping-only** — safe, additive and reversible.

The reason is worth understanding. `daily_sales_lines` records a store and a
category. It does **not** record a brand. So a historical sales row cannot be
attributed to Woodpeckers in the first place, which means there is no such thing
as "moving Woodpeckers history" onto a different category.

That removes the collision risk flagged in [next-phase-plan.md](next-phase-plan.md):
because no rows are repointed, the unique index on (daily_report_id, category_id)
is never challenged and no rows need merging. Historical reports keep the
category names they were filed under, which is correct.

## The rule needs one amendment

The agreed rule was: exists in the group → point Woodpeckers at it; does not
exist → rename what Woodpeckers has.

**Eight of Woodpeckers' nine current categories are shared with other brands.**
Renaming any of them would rename it for Boulevard Men, Boulevard Women or
D Angelo too. So "rename what Woodpeckers has" is only available once, for the
single category Woodpeckers holds exclusively.

Everywhere else the third case applies: **create a new category and map it to
Woodpeckers only**, leaving the shared one untouched for the brands still using it.

## Footwear does not collide

An earlier concern was that renaming Footwear would disturb Carbon Shoe Store.
It does not. **Carbon has no "Footwear" category** — it maps to five specific
ones: Derby Shoes, Oxford Shoes, Loafers, Sandals and its two belt categories.
Creating a single "Footwear" category for Woodpeckers touches nothing of Carbon's.

## What Woodpeckers maps to today

| Id | Category | Shared with | Sales rows |
|---|---|---|---|
| 8 | Denim Jeans | Boulevard Men, Boulevard Women, D Angelo | 5 |
| 28 | Jackets & Outerwear | Boulevard Men, D Angelo | 12 |
| 7 | Polo Shirts | Boulevard Men, Boulevard Women, D Angelo | 20 |
| 6 | Premium T-Shirts | Boulevard Men, Boulevard Women, D Angelo | 14 |
| 11 | Sneakers | Boulevard Men, Boulevard Women, D Angelo | 4 |
| 27 | Streetwear Sets | **nobody — Woodpeckers only** | 1 |
| 20 | Sunglasses | Boulevard Men, Boulevard Women, D Angelo | 6 |
| 22 | Wallets & Purses | Boulevard Men, Boulevard Women, D Angelo | 3 |
| 23 | Watches | Boulevard Men, Boulevard Women | 1 |

Sales-row counts are group-wide for that category, not Woodpeckers' share.

## The plan, per requested name

| # | Requested | Action | Detail |
|---|---|---|---|
| 1 | Pants & Shorts | **Create** | No group equivalent. Denim Jeans is shared, so cannot be renamed. |
| 2 | Hoodies & Sweatshirts | **Create** | No group equivalent at all. |
| 3 | Footwear | **Create** | Carbon uses five specific shoe categories; no clash. |
| 4 | Bags & Wallets | **Create** | Leather Bags and Wallets & Purses exist separately and are shared. |
| 5 | Jersey | **Create** | No group equivalent. |
| 6 | Premium T-Shirts | **None** | Already exists (id 6) and Woodpeckers is already mapped. |
| 7 | Accessories | **Map** | Already exists (id 29). Add the Woodpeckers mapping only. |
| 8 | Shirts | **Create** | Casual, Formal and Polo Shirts exist separately and are shared. |
| 9 | Tops & Tees | **Create** | No group equivalent. |
| 10 | Headwear | **Create** | No group equivalent. |
| 11 | Tracksuits | **Rename** | Streetwear Sets (id 27) is Woodpeckers-only — the one safe rename. |

Then **unmap Woodpeckers** from the categories the new set absorbs, leaving the
categories themselves untouched for the brands still on them:

| Unmapped from Woodpeckers | Absorbed into |
|---|---|
| Denim Jeans | Pants & Shorts |
| Polo Shirts | Shirts |
| Sneakers | Footwear |
| Sunglasses | Accessories |
| Wallets & Purses | Bags & Wallets |
| Watches | Accessories |
| Jackets & Outerwear | **unresolved — see below** |

A store's category list is the union of the categories mapped to the brands that
store carries (`configuredCategoryIdsForStore` in `src/lib/daily-reports.ts`), so
unmapping is the correct and only lever. It changes what appears on the form from
that day forward and changes nothing already filed.

## Open before this can be written

1. **Jackets & Outerwear has no home in the new list.** It is Woodpeckers'
   busiest category at 12 sales rows. Does it fold into Hoodies & Sweatshirts,
   stay as its own category, or get dropped?
2. **Streetwear Sets → Tracksuits.** This is the only rename and it shifts the
   meaning slightly. Confirm it is wanted, or create Tracksuits separately and
   retire Streetwear Sets.
3. **Which stores carry Woodpeckers, and do they carry anything else?** If a
   store carries Woodpeckers alongside another brand, its category list is the
   union of both, so it will show the new names next to the old ones.

## Housekeeping found on the way

**Knitwear (id 26) is dead** — mapped to no brand, zero sales rows. Worth
deactivating while this migration is open.
