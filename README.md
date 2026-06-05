# StateStreet Retail Group — Operations Command Center

A full operational system with role-based dashboards and department intake forms. Each department enters its own data; data is analyzed and visualized on command-center dashboards. The owner sees everything across all departments plus an Executive Command Center, and can drill into any single department.

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:3000 — you'll be redirected to the login page.

## Demo Logins

| Role | Email | Password | Sees |
|------|-------|----------|------|
| Owner / CEO | owner@statestreet.com | owner123 | Everything + Executive Command Center |
| Finance Manager | finance@statestreet.com | finance123 | Finance only |
| Commercial Director | commercial@statestreet.com | commercial123 | Commercial only |
| Marketing Director | marketing@statestreet.com | marketing123 | Marketing + Brand Health |
| Operations Manager | operations@statestreet.com | operations123 | Operations only |
| Inventory Manager | inventory@statestreet.com | inventory123 | Inventory only |
| Brand Manager | brand@statestreet.com | brand123 | Brand Health only |

Use the **Quick Login** buttons on the login screen to fill credentials instantly.

## Structure

```
src/
  app/
    login/                 Login page
    api/auth/              Authentication endpoint
    dashboard/
      executive/           Executive Command Center (owner only)
      finance/             Finance Command Center
      commercial/          Commercial Command Center
      marketing/           Marketing Command Center
      operations/          Business Operations Command Center
      inventory/           Inventory Command Center
      brand-health/        Brand Health Command Center
    forms/
      finance/ commercial/ marketing/ operations/ inventory/ brand-health/
                           Department data-entry forms (multi-tab)
  components/
    layout/                Sidebar, DashboardHeader
    ui/                    KPICard, Section, StatusBadge, ScoreGauge, ProgressBar
    charts/                Recharts wrappers (line, bar, donut, sparkline)
    forms/                 FormField, FormSection
  lib/
    auth.ts                Users, roles, department access control
    data.ts                Demo data for all dashboards
    types.ts               TypeScript interfaces
```

## How Access Control Works

`src/lib/auth.ts` maps each role to the departments it can access. The sidebar and dashboards
only render departments in that list. The owner role maps to all departments plus `executive`.

## Dashboards

1. **Executive** — group-wide KPIs summarizing all six departments
2. **Finance** — revenue, profitability, cash flow, working capital, expenses, forecast
3. **Commercial** — store sales, categories, SKU performance, new arrivals, accountability
4. **Marketing** — campaigns, customer acquisition, clienteling, customer intelligence
5. **Operations** — store ops, VM compliance, maintenance, CX, SOP, incidents
6. **Inventory** — stock value, aging, dead stock, accuracy, replenishment
7. **Brand Health** — brand equity, sentiment, market position, digital reputation

## Data Entry

Each department has a **Forms** section in the sidebar with multi-tab intake forms.
Currently the forms validate and show a success confirmation (demo). To persist data,
wire the form `onSubmit` handlers to API routes that write to your database of choice.

## Tech Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS v4 (dark command-center theme)
- Recharts for visualizations
- Cookie-based session auth (demo-grade — replace with a real auth provider for production)
