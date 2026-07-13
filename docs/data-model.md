# Target Data Model

StateStreet stays as one Next.js application backed by one PostgreSQL database.
The target is a typed operational model with SQL reporting queries, not another
generic JSON submission layer.

## Modeling Principles

- Use header/line tables for business documents.
- Use foreign keys for shared references and session-derived ownership.
- Use `numeric(14,2)` for money, PostgreSQL `date` for business dates, and
  timezone-aware timestamps for events.
- Keep calculations out of stored client payloads when they can be reproduced.
- Keep JSON only for genuinely flexible audit snapshots or import summaries.
- Never hard-delete referenced master data; mark it inactive.
- Every mutable approval workflow has a status, lock version where concurrent
  editing matters, actor IDs, timestamps, and audit events.

## Existing Foundation Tables

### Identity and organization

- `users`
- `stores`
- `brands`
- `brand_stores`
- `categories`
- `brand_categories`
- `subcategories`
- `suppliers`
- `payment_methods`
- `expense_categories`

### Catalog and trading

- `products`
- `daily_reports`
- `daily_sales_lines`
- `daily_payment_lines`
- `daily_report_legacy_entries`

### Inventory documents

- `goods_receipts`
- `goods_receipt_lines`
- `stock_transfers`
- `stock_transfer_lines`
- `stock_counts`
- `stock_count_lines`
- `replenishment_requests`
- `replenishment_request_lines`

### Finance, CRM, and accountability

- `expenses`
- `budgets`
- `customers`
- `customer_interactions`
- `weekly_reviews`
- `weekly_review_actions`
- `audit_events`
- `import_batches`

## Additions Required For Parity

### Cross-department

- `performance_targets`: metric, scope type/id, period type/start/end, value,
  currency/unit, creator, and update actor.
- `action_items`: department, source entity, optional store/brand/category,
  title, detail, priority, owner user/name, due date, status, and completion.
- `product_insights`: product, period, commercial status, performance, campaign,
  and judgement note.

### Inventory ledger

- `inventory_movements`: immutable product/store quantity and value movements
  produced by receipts, transfers, stock-count adjustments, and future sales
  imports.

Current product/store balances and last movement are SQL views over the ledger.
Stock counts create adjustment movements only when approved. This keeps
inventory totals auditable and avoids a manually edited balance table.

### Finance

- `capital_snapshots`
- `cash_transactions`
- `working_capital_items`
- `financial_forecasts`

Approved daily reports and expenses feed reporting cash views directly. Manual
cash transactions represent only cash activity that is not already present in
those source tables.

### Marketing and customer insight

- `marketing_campaign_reports`
- `lead_metrics`
- `social_metrics`
- `clienteling_activities`
- `customer_feedback`

`customer_feedback` is shared by Marketing and Brand Health. It stores source,
type, category, NPS/recommendation, frequency, detail, optional store/brand, and
the follow-up action link.

### Operations

- `store_standard_reviews`
- `visual_merchandising_reviews`
- `store_experience_reviews`
- `maintenance_requests`
- `incidents`
- `sop_reviews`
- `people_snapshots`

The stable score dimensions are columns so dashboards can aggregate them in
SQL. Notes, findings, and corrective text remain text columns, not metric JSON.

### Brand health

- `brand_health_assessments`
- `brand_sentiment_snapshots`
- `competitor_activities`
- `digital_reputation_snapshots`

Customer voice and CEO attention use the shared feedback and action tables.

### Weekly review detail

- `weekly_review_category_notes`: review/category risk flags, weeks without
  movement, value at risk, comments, and optional corrective/action link.

Weekly figures are reporting data, not copied into the review record.

## Reporting Views

The application reads stable query functions backed by SQL CTEs or views. The
minimum reporting surfaces are:

- `reporting_daily_store_performance`
- `reporting_store_period_performance`
- `reporting_category_period_performance`
- `reporting_inventory_balance`
- `reporting_inventory_risk`
- `reporting_budget_vs_actual`
- `reporting_cash_position`
- `reporting_marketing_funnel`
- `reporting_store_health`
- `reporting_brand_health`
- `reporting_attention_queue`

API responses expose versioned Zod contracts. Dashboards never download all
records and aggregate arbitrary JSON in the browser.

## Legacy Boundary

`entries` and `audit_log` remain available as read-only migration evidence until
each workflow has count, amount, permission, and UI parity. They are not written
by rebuilt workflows and are not deleted during the local rebuild.

Production migration remains a separate release. Local migrations and demo data
must run only against an explicitly verified localhost database.
