# Dashboard Parity Map

This map is the contract for the rebuilt dashboards. It preserves the business views from the
original application while replacing legacy JSON reads with typed reporting queries. A section
should not be removed or renamed without confirming the change with the business users who rely
on it.

## Executive Command Center

| Section | Primary typed source |
| --- | --- |
| Group Revenue & Margin Trend | `daily_reports`, `daily_sales_lines`, `performance_targets` |
| Revenue by Category / Sales by Category | `daily_sales_lines`, `categories` |
| Sales by Store / Store Performance | `daily_reports`, `stores`, `brand_stores`, `store_standard_reviews` |
| Payment Mix | `daily_payment_lines`, `payment_methods` |
| Brand Performance | approved store sales and `brand_stores` |
| People Health | `people_health_snapshots` |
| Departments | role-scoped command-center routes |
| Profitability Ratios | approved sales, `expenses`, `capital_snapshots` |
| CEO Attention Index / Action Tracker | `actions` |
| Operations Feed | `audit_events`, `users` |
| Manager Voices / Store Manager - Key Insights | `weekly_store_reviews`, `weekly_review_actions` |

## Department Command Centers

| Dashboard | Preserved sections |
| --- | --- |
| Finance | Revenue; Profitability; Cash Flow; Payments by Mode; Expense Control; Overspend Register; Store P&L; Debtor Aging; Weekly & Period Forecast; Daily Sales by Store; Store Ledger & Working Capital; Recent Entries & Approval Queue |
| Commercial | Sales Performance; Sell-Through by Category; SKU Performance; Commercial Insights; Accountability & Action Tracker; Weekly Review; Review Submissions; Category Target vs Actual; Manager Voices; Achievement Trend; New Arrivals & Deployment; Customer Database; Recent Entries |
| Marketing | Lead Generation; Lead Qualification; Content Cadence; Campaign Performance; Social Media by Channel; Clienteling; Customer Experience; Customer Insights; Action Tracker; Recent Entries |
| Operations | Visual Merchandising & Risk; Store Standards Scores; Risk & Incident Monitor; Priority Actions; Maintenance Backlog; Customer Experience; VM Detail; People Health; SOP Compliance; Corrective Action Register; Recent Entries |
| Inventory | Inventory Value; Stock Accuracy; Stock Movement; Suppliers & Replenishment; Inventory Position; Dead-Stock Actions; Goods-Receipt Quality; Stock Transfers; Recent Entries |
| Brand Health | Brand Health Index & Portfolio; Brand Equity Dimensions; Sentiment; Share of Conversation; Digital Reputation & Social; Competitive Watch; Risks; Opportunities; CEO Attention; Recent Entries |
| Store Manager | Trading KPIs; Sales by Category; Sell-Through by Category; Recent Daily Reports; Weekly Review; Customer Health; Customer Sources; Stock Transfers; Low-Stock Watch |

## Reporting Rules

- Revenue charts use approved daily reports only. Draft and submitted reports remain visible in
  workflow queues but do not enter financial totals.
- Store filters are enforced in the server reporting scope, not only in the browser.
- Targets are prorated to the selected date range before attainment is calculated.
- Inventory value comes from typed movement balances and product cost, not from form payloads.
- Dashboard APIs are read-only and return data through `/api/analytics/*`.
- `entries.payload` is retained as historical evidence only and must not receive new writes.

## Change Checklist

Before changing a dashboard, identify the row above, preserve its reporting rule, and verify the
affected role in a real browser. Changes to calculations or source tables require an API test and
review of the corresponding query in `src/lib/reporting`.
