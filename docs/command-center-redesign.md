# Command Center Redesign — Implementation Guide

Goal: convert the 7 dashboards to the dark **command-center** look.
This is a **presentation-only** change. Do **not** touch `useMetrics`, data
shapes, auth, forms, or any business logic — only rearrange JSX and styling.

- **Visual spec:** open `public/command-center.html` in a browser. Each rail icon
  is the target design for that dashboard (executive + 6 departments). Numbers
  there are fake; the layout, panels, and chart choices are the spec.
- **Branch:** `feat/command-center-ui` (this branch). Off `main`. Don't push `main`.

---

## What already exists on this branch (shared, reusable)

| File | What it gives you |
|------|-------------------|
| `src/app/globals.css` | `.panel-surface` class + `--grad-panel` / `--shadow-panel` tokens (gradient + elevation, theme-aware) |
| `src/components/ui/Section.tsx` | Reskinned panel surface + gold-gradient section badge |
| `src/components/ui/KPICard.tsx` | Matches the prototype card; new props: `sparkline?: number[]`, `sparkColor?`, plus existing `progress`, `change`, `target`, `icon`, `status` |
| `src/components/charts/Charts.tsx` | Command-center palette (gold/violet/teal/blue/pink), softer grid, refined tooltips. Same chart components as before. |
| `src/components/ui/Bento.tsx` | **NEW.** `<Bento>` = 12-col grid; `<Panel span={3..12} title meta number actions>` = the panel shell. |
| `src/components/ui/PeriodTabs.tsx` | Already has the **Custom Date** range filter — reuse as-is in the top bar. |

`verify:fast` passes on this branch with all of the above.

---

## The conversion recipe (repeat per page)

For each `src/app/dashboard/<dept>/page.tsx`:

1. **Open the page and its `command-center.html` view side by side.**
2. **Keep the whole data layer.** Every variable the page already computes
   (`revenueByCategory`, `salesByStore`, `storePerformance`, etc.) stays. You are
   only moving the JSX that renders it.
3. **Replace the stacked `<Section>` blocks with one `<Bento>`,** and wrap each
   chart/table/stat block in a `<Panel span={n}>` whose `span` matches the
   prototype's column width.
4. **Keep `EmptyState` fallbacks and `ShowMore*`** inside the panels — they are
   real behaviors, not decoration.
5. **KPI sparklines:** pass an existing trend array, e.g.
   `<KPICard label="Revenue MTD" value={…} sparkline={dailyData.map(d => d.value)} />`.
   For progress cards keep `progress={…}`.
6. **Top bar:** keep `<PeriodTabs …>` (it already includes Custom Date + store filter).

### Example (Finance §1)

```tsx
import { Bento, Panel } from '@/components/ui/Bento';

<Bento>
  <Panel span={8} number={1} title="Daily Revenue" meta="MTD · GHS">
    {hasDaily
      ? <SimpleLineChart data={dailyData} area prefix="GHS " />
      : <EmptyState message="No revenue entries yet" height={220} />}
  </Panel>
  <Panel span={4} title="Revenue by Category">
    {revenueByCategory.length
      ? <SimpleDonutChart data={revenueByCategory} centerLabel="Total" centerValue={fmtGHS(revenueMtd)} />
      : <EmptyState height={200} />}
  </Panel>
</Bento>
```

The data calls are identical to today — only the wrapper changed.

---

## Column spans per dashboard (from the prototype)

Use these as the starting grid; tweak to taste. Each row sums to 12.

- **Executive** — KPI bar (7) · [trend 8 | category-donut 4] · [store 4 | category-mix 4 | brand 4] · [store-table 8 | feed 4] · ratios/departments · CEO/ManagerVoices/ActionTracker/KeyInsights full-width
- **Finance** — KPI bar (6) · [daily 8 | category 4] · [bridge 6 | margins 3 | ratios 3] · [cash 8 | cash-tiles 4] · [payments 8 | list 4] · [spend 8 | opex 4] · budget 12 · [revStore 4 | expStore 4 | debtor 4] · forecast 12
- **Commercial** — KPI bar (7) · [store 4 | category 4 | brand 4] · [sell-donut 4 | sell-detail 8] · [top 4 | low 4 | dead 4] · insight 12 · accountability 12 · [wr-kpis 4 | wr-cat 5 | wr-rating 3] · achievement 12 · [customer 4 | recent 8]
- **Marketing** — KPI bar (6) · [channel 6 | funnel 6] · [qual 4 | rates 4 | cadence 4] · [campaigns 8 | roi 4] · social 12 · [clienteling 5 | cx 7] · actions 12 · [items 4 | sizes 4 | source 4]
- **Operations** — KPI bar (7) · [vm 8 | risk 4] · standards 12 · [inc-types 4 | inc-store 4 | risks 4] · [maint 4 | actions 8] · [maint-cat 6 | assignee 6] · [cx 4 | vm-break 4 | people 4] · [sop 6 | deviations 6] · corrective 12
- **Inventory** — KPI bar (4) · [goods 8 | brand 4] · [accuracy 4 | movement 8] · [supplier 6 | replen 6] · [dead 6 | dead-items 6] · [condition 4 | flagged 8] · transfers 12
- **Brand Health** — KPI bar (4) · [gauge 4 | portfolio 8] · [equity 8 | sentiment 4] · [trend 8 | share 4] · digital 12 · [risks 6 | opportunities 6] · ceo 12

---

## Order & verification

1. Branch off this branch per chunk if you like; **don't touch `main`**.
2. Do **executive first** (the reference), then finance → commercial → marketing
   → operations → inventory → brand.
3. After each page: `npm run dev` → open `/dashboard/<dept>` and eyeball it
   against `command-center.html`. (Login required — needs a working
   `DATABASE_URL` in `.env.local`.)
4. `npm run verify:fast` before merging the branch into `main`.

## Guardrails

- Presentation only — no data/logic changes.
- Keep `EmptyState`, `ShowMore*`, and all existing props.
- The prototype's numbers are placeholders; never copy them into the app.
