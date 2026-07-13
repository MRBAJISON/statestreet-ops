CREATE TABLE "audit_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"entity_type" text NOT NULL,
	"entity_id" bigint NOT NULL,
	"action" text NOT NULL,
	"actor_user_id" integer,
	"before" jsonb,
	"after" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_events_action_check" CHECK ("audit_events"."action" in ('create', 'update', 'submit', 'approve', 'reopen', 'cancel'))
);
--> statement-breakpoint
CREATE TABLE "brand_categories" (
	"brand_id" bigint NOT NULL,
	"category_id" bigint NOT NULL,
	CONSTRAINT "brand_categories_pk" PRIMARY KEY("brand_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "brand_stores" (
	"brand_id" bigint NOT NULL,
	"store_id" bigint NOT NULL,
	CONSTRAINT "brand_stores_pk" PRIMARY KEY("brand_id","store_id")
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "brands_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "budgets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"year" integer NOT NULL,
	"expense_category_id" bigint NOT NULL,
	"store_id" bigint,
	"amount" numeric(14, 2) NOT NULL,
	"notes" text,
	"created_by_user_id" integer NOT NULL,
	"updated_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budgets_year_check" CHECK ("budgets"."year" between 2000 and 2200),
	CONSTRAINT "budgets_amount_check" CHECK ("budgets"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_interactions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "customer_interactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"customer_id" bigint NOT NULL,
	"store_id" bigint NOT NULL,
	"business_date" date NOT NULL,
	"lifecycle" text NOT NULL,
	"source" text NOT NULL,
	"source_detail" text,
	"product_id" bigint,
	"interest_text" text,
	"notes" text,
	"captured_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_interactions_lifecycle_check" CHECK ("customer_interactions"."lifecycle" in ('lead', 'buyer'))
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "customers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"phone_normalized" text NOT NULL,
	"occupation" text,
	"size_preference" text,
	"created_by_user_id" integer NOT NULL,
	"updated_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_payment_lines" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "daily_payment_lines_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"daily_report_id" bigint NOT NULL,
	"payment_method_id" bigint NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_payment_lines_amount_check" CHECK ("daily_payment_lines"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "daily_report_legacy_entries" (
	"daily_report_id" bigint NOT NULL,
	"entry_id" integer NOT NULL,
	CONSTRAINT "daily_report_legacy_entries_pk" PRIMARY KEY("daily_report_id","entry_id")
);
--> statement-breakpoint
CREATE TABLE "daily_reports" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "daily_reports_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"store_id" bigint NOT NULL,
	"business_date" date NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"transactions" integer DEFAULT 0 NOT NULL,
	"footfall" integer DEFAULT 0 NOT NULL,
	"total_customers" integer DEFAULT 0 NOT NULL,
	"new_customers" integer DEFAULT 0 NOT NULL,
	"returning_customers" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"lock_version" integer DEFAULT 1 NOT NULL,
	"created_by_user_id" integer NOT NULL,
	"updated_by_user_id" integer NOT NULL,
	"submitted_by_user_id" integer,
	"submitted_at" timestamp with time zone,
	"approved_by_user_id" integer,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_reports_status_check" CHECK ("daily_reports"."status" in ('draft', 'submitted', 'approved')),
	CONSTRAINT "daily_reports_counts_check" CHECK ("daily_reports"."transactions" >= 0 and "daily_reports"."footfall" >= 0 and "daily_reports"."total_customers" >= 0 and "daily_reports"."new_customers" >= 0 and "daily_reports"."returning_customers" >= 0),
	CONSTRAINT "daily_reports_customer_breakdown_check" CHECK ("daily_reports"."new_customers" + "daily_reports"."returning_customers" <= "daily_reports"."total_customers"),
	CONSTRAINT "daily_reports_lock_version_check" CHECK ("daily_reports"."lock_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "daily_sales_lines" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "daily_sales_lines_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"daily_report_id" bigint NOT NULL,
	"category_id" bigint NOT NULL,
	"opening_stock" integer DEFAULT 0 NOT NULL,
	"units_sold" integer DEFAULT 0 NOT NULL,
	"gross_revenue" numeric(14, 2) NOT NULL,
	"cogs" numeric(14, 2) NOT NULL,
	"discounts" numeric(14, 2) DEFAULT '0' NOT NULL,
	"credit_sales" numeric(14, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_sales_lines_counts_check" CHECK ("daily_sales_lines"."opening_stock" >= 0 and "daily_sales_lines"."units_sold" >= 0),
	CONSTRAINT "daily_sales_lines_amounts_check" CHECK ("daily_sales_lines"."gross_revenue" >= 0 and "daily_sales_lines"."cogs" >= 0 and "daily_sales_lines"."discounts" >= 0 and "daily_sales_lines"."credit_sales" >= 0),
	CONSTRAINT "daily_sales_lines_discount_check" CHECK ("daily_sales_lines"."discounts" <= "daily_sales_lines"."gross_revenue"),
	CONSTRAINT "daily_sales_lines_credit_check" CHECK ("daily_sales_lines"."credit_sales" <= "daily_sales_lines"."gross_revenue" - "daily_sales_lines"."discounts")
);
--> statement-breakpoint
CREATE TABLE "expense_categories" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "expense_categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"name" text NOT NULL,
	"group" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expense_categories_group_check" CHECK ("expense_categories"."group" in ('operating', 'capital', 'below-line'))
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "expenses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"business_date" date NOT NULL,
	"expense_category_id" bigint NOT NULL,
	"store_id" bigint,
	"amount" numeric(14, 2) NOT NULL,
	"vendor" text,
	"invoice_reference" text,
	"payment_method_id" bigint,
	"description" text NOT NULL,
	"overspend_reason" text,
	"created_by_user_id" integer NOT NULL,
	"updated_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expenses_amount_check" CHECK ("expenses"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "goods_receipt_lines" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "goods_receipt_lines_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"goods_receipt_id" bigint NOT NULL,
	"product_id" bigint NOT NULL,
	"quantity" integer NOT NULL,
	"unit_cost" numeric(14, 2),
	"condition" text DEFAULT 'good' NOT NULL,
	"discrepancy" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goods_receipt_lines_quantity_check" CHECK ("goods_receipt_lines"."quantity" > 0),
	CONSTRAINT "goods_receipt_lines_unit_cost_check" CHECK ("goods_receipt_lines"."unit_cost" is null or "goods_receipt_lines"."unit_cost" >= 0),
	CONSTRAINT "goods_receipt_lines_condition_check" CHECK ("goods_receipt_lines"."condition" in ('good', 'damaged', 'partial'))
);
--> statement-breakpoint
CREATE TABLE "goods_receipts" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "goods_receipts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"business_date" date NOT NULL,
	"po_number" text,
	"supplier_id" bigint NOT NULL,
	"receiving_store_id" bigint NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"notes" text,
	"created_by_user_id" integer NOT NULL,
	"updated_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goods_receipts_status_check" CHECK ("goods_receipts"."status" in ('draft', 'received', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "import_batches" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "import_batches_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"type" text NOT NULL,
	"filename" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"imported_rows" integer DEFAULT 0 NOT NULL,
	"error_rows" integer DEFAULT 0 NOT NULL,
	"summary" jsonb,
	"created_by_user_id" integer NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "import_batches_status_check" CHECK ("import_batches"."status" in ('pending', 'running', 'completed', 'failed')),
	CONSTRAINT "import_batches_counts_check" CHECK ("import_batches"."total_rows" >= 0 and "import_batches"."imported_rows" >= 0 and "import_batches"."error_rows" >= 0 and "import_batches"."imported_rows" + "import_batches"."error_rows" <= "import_batches"."total_rows")
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "payment_methods_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "products_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"brand_id" bigint NOT NULL,
	"category_id" bigint NOT NULL,
	"subcategory_id" bigint,
	"size" text,
	"color" text,
	"unit_cost" numeric(14, 2),
	"selling_price" numeric(14, 2),
	"active" boolean DEFAULT true NOT NULL,
	"created_by_user_id" integer,
	"updated_by_user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_unit_cost_check" CHECK ("products"."unit_cost" is null or "products"."unit_cost" >= 0),
	CONSTRAINT "products_selling_price_check" CHECK ("products"."selling_price" is null or "products"."selling_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "replenishment_request_lines" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "replenishment_request_lines_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"replenishment_request_id" bigint NOT NULL,
	"product_id" bigint NOT NULL,
	"current_stock" integer NOT NULL,
	"reorder_quantity" integer NOT NULL,
	"urgency" text DEFAULT 'normal' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "replenishment_lines_quantities_check" CHECK ("replenishment_request_lines"."current_stock" >= 0 and "replenishment_request_lines"."reorder_quantity" > 0),
	CONSTRAINT "replenishment_lines_urgency_check" CHECK ("replenishment_request_lines"."urgency" in ('low', 'normal', 'high', 'critical'))
);
--> statement-breakpoint
CREATE TABLE "replenishment_requests" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "replenishment_requests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"business_date" date NOT NULL,
	"store_id" bigint NOT NULL,
	"supplier_id" bigint,
	"status" text DEFAULT 'requested' NOT NULL,
	"requested_by_user_id" integer NOT NULL,
	"reviewed_by_user_id" integer,
	"reviewed_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "replenishment_requests_status_check" CHECK ("replenishment_requests"."status" in ('requested', 'approved', 'ordered', 'fulfilled', 'rejected', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "stock_count_lines" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stock_count_lines_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"stock_count_id" bigint NOT NULL,
	"product_id" bigint NOT NULL,
	"system_quantity" integer NOT NULL,
	"physical_quantity" integer NOT NULL,
	"unit_cost" numeric(14, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_count_lines_quantities_check" CHECK ("stock_count_lines"."system_quantity" >= 0 and "stock_count_lines"."physical_quantity" >= 0),
	CONSTRAINT "stock_count_lines_unit_cost_check" CHECK ("stock_count_lines"."unit_cost" is null or "stock_count_lines"."unit_cost" >= 0)
);
--> statement-breakpoint
CREATE TABLE "stock_counts" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stock_counts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"business_date" date NOT NULL,
	"store_id" bigint NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"counted_by_user_id" integer NOT NULL,
	"approved_by_user_id" integer,
	"approved_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_counts_status_check" CHECK ("stock_counts"."status" in ('draft', 'submitted', 'approved', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "stock_transfer_lines" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stock_transfer_lines_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"stock_transfer_id" bigint NOT NULL,
	"product_id" bigint NOT NULL,
	"quantity" integer NOT NULL,
	"unit_cost" numeric(14, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_transfer_lines_quantity_check" CHECK ("stock_transfer_lines"."quantity" > 0),
	CONSTRAINT "stock_transfer_lines_unit_cost_check" CHECK ("stock_transfer_lines"."unit_cost" is null or "stock_transfer_lines"."unit_cost" >= 0)
);
--> statement-breakpoint
CREATE TABLE "stock_transfers" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stock_transfers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"business_date" date NOT NULL,
	"from_store_id" bigint NOT NULL,
	"to_store_id" bigint NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"reason" text NOT NULL,
	"requested_by_user_id" integer NOT NULL,
	"authorized_by_user_id" integer,
	"authorized_at" timestamp with time zone,
	"received_by_user_id" integer,
	"received_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_transfers_store_check" CHECK ("stock_transfers"."from_store_id" <> "stock_transfers"."to_store_id"),
	CONSTRAINT "stock_transfers_status_check" CHECK ("stock_transfers"."status" in ('requested', 'authorized', 'in-transit', 'received', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stores_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subcategories" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "subcategories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"category_id" bigint NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "suppliers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_review_actions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "weekly_review_actions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"weekly_review_id" bigint NOT NULL,
	"category_id" bigint,
	"product_id" bigint,
	"action" text NOT NULL,
	"owner_user_id" integer,
	"owner_name" text,
	"target_units" integer,
	"target_revenue" numeric(14, 2),
	"due_date" date,
	"status" text DEFAULT 'open' NOT NULL,
	"manager_comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weekly_review_actions_target_units_check" CHECK ("weekly_review_actions"."target_units" is null or "weekly_review_actions"."target_units" >= 0),
	CONSTRAINT "weekly_review_actions_target_revenue_check" CHECK ("weekly_review_actions"."target_revenue" is null or "weekly_review_actions"."target_revenue" >= 0),
	CONSTRAINT "weekly_review_actions_status_check" CHECK ("weekly_review_actions"."status" in ('open', 'in-progress', 'completed', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "weekly_reviews" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "weekly_reviews_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"store_id" bigint NOT NULL,
	"week_end" date NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"summary" text,
	"risks" text,
	"opportunities" text,
	"submitted_by_user_id" integer NOT NULL,
	"approved_by_user_id" integer,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weekly_reviews_status_check" CHECK ("weekly_reviews"."status" in ('draft', 'submitted', 'approved'))
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_categories" ADD CONSTRAINT "brand_categories_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_categories" ADD CONSTRAINT "brand_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_stores" ADD CONSTRAINT "brand_stores_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_stores" ADD CONSTRAINT "brand_stores_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_expense_category_id_expense_categories_id_fk" FOREIGN KEY ("expense_category_id") REFERENCES "public"."expense_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_interactions" ADD CONSTRAINT "customer_interactions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_interactions" ADD CONSTRAINT "customer_interactions_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_interactions" ADD CONSTRAINT "customer_interactions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_interactions" ADD CONSTRAINT "customer_interactions_captured_by_user_id_users_id_fk" FOREIGN KEY ("captured_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_payment_lines" ADD CONSTRAINT "daily_payment_lines_daily_report_id_daily_reports_id_fk" FOREIGN KEY ("daily_report_id") REFERENCES "public"."daily_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_payment_lines" ADD CONSTRAINT "daily_payment_lines_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_report_legacy_entries" ADD CONSTRAINT "daily_report_legacy_entries_daily_report_id_daily_reports_id_fk" FOREIGN KEY ("daily_report_id") REFERENCES "public"."daily_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_report_legacy_entries" ADD CONSTRAINT "daily_report_legacy_entries_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_reports" ADD CONSTRAINT "daily_reports_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_reports" ADD CONSTRAINT "daily_reports_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_reports" ADD CONSTRAINT "daily_reports_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_reports" ADD CONSTRAINT "daily_reports_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_reports" ADD CONSTRAINT "daily_reports_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_sales_lines" ADD CONSTRAINT "daily_sales_lines_daily_report_id_daily_reports_id_fk" FOREIGN KEY ("daily_report_id") REFERENCES "public"."daily_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_sales_lines" ADD CONSTRAINT "daily_sales_lines_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_expense_category_id_expense_categories_id_fk" FOREIGN KEY ("expense_category_id") REFERENCES "public"."expense_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_goods_receipt_id_goods_receipts_id_fk" FOREIGN KEY ("goods_receipt_id") REFERENCES "public"."goods_receipts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_receiving_store_id_stores_id_fk" FOREIGN KEY ("receiving_store_id") REFERENCES "public"."stores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_subcategory_id_subcategories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."subcategories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replenishment_request_lines" ADD CONSTRAINT "replenishment_request_lines_replenishment_request_id_replenishment_requests_id_fk" FOREIGN KEY ("replenishment_request_id") REFERENCES "public"."replenishment_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replenishment_request_lines" ADD CONSTRAINT "replenishment_request_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replenishment_requests" ADD CONSTRAINT "replenishment_requests_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replenishment_requests" ADD CONSTRAINT "replenishment_requests_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replenishment_requests" ADD CONSTRAINT "replenishment_requests_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replenishment_requests" ADD CONSTRAINT "replenishment_requests_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_stock_count_id_stock_counts_id_fk" FOREIGN KEY ("stock_count_id") REFERENCES "public"."stock_counts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_counted_by_user_id_users_id_fk" FOREIGN KEY ("counted_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer_lines" ADD CONSTRAINT "stock_transfer_lines_stock_transfer_id_stock_transfers_id_fk" FOREIGN KEY ("stock_transfer_id") REFERENCES "public"."stock_transfers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer_lines" ADD CONSTRAINT "stock_transfer_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_from_store_id_stores_id_fk" FOREIGN KEY ("from_store_id") REFERENCES "public"."stores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_to_store_id_stores_id_fk" FOREIGN KEY ("to_store_id") REFERENCES "public"."stores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_authorized_by_user_id_users_id_fk" FOREIGN KEY ("authorized_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_received_by_user_id_users_id_fk" FOREIGN KEY ("received_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subcategories" ADD CONSTRAINT "subcategories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_review_actions" ADD CONSTRAINT "weekly_review_actions_weekly_review_id_weekly_reviews_id_fk" FOREIGN KEY ("weekly_review_id") REFERENCES "public"."weekly_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_review_actions" ADD CONSTRAINT "weekly_review_actions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_review_actions" ADD CONSTRAINT "weekly_review_actions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_review_actions" ADD CONSTRAINT "weekly_review_actions_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_reviews" ADD CONSTRAINT "weekly_reviews_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_reviews" ADD CONSTRAINT "weekly_reviews_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_reviews" ADD CONSTRAINT "weekly_reviews_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_entity_idx" ON "audit_events" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_actor_idx" ON "audit_events" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "brand_categories_category_idx" ON "brand_categories" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "brand_stores_store_idx" ON "brand_stores" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "brands_code_lower_uidx" ON "brands" USING btree (lower("code"));--> statement-breakpoint
CREATE UNIQUE INDEX "budgets_store_year_category_uidx" ON "budgets" USING btree ("store_id","year","expense_category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "budgets_group_year_category_uidx" ON "budgets" USING btree ("year","expense_category_id") WHERE "budgets"."store_id" is null;--> statement-breakpoint
CREATE INDEX "budgets_category_idx" ON "budgets" USING btree ("expense_category_id");--> statement-breakpoint
CREATE INDEX "budgets_created_by_idx" ON "budgets" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "budgets_updated_by_idx" ON "budgets" USING btree ("updated_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_code_lower_uidx" ON "categories" USING btree (lower("code"));--> statement-breakpoint
CREATE INDEX "customer_interactions_customer_date_idx" ON "customer_interactions" USING btree ("customer_id","business_date");--> statement-breakpoint
CREATE INDEX "customer_interactions_store_date_idx" ON "customer_interactions" USING btree ("store_id","business_date");--> statement-breakpoint
CREATE INDEX "customer_interactions_product_idx" ON "customer_interactions" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "customer_interactions_captured_by_idx" ON "customer_interactions" USING btree ("captured_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_phone_normalized_uidx" ON "customers" USING btree ("phone_normalized");--> statement-breakpoint
CREATE INDEX "customers_created_by_idx" ON "customers" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "customers_updated_by_idx" ON "customers" USING btree ("updated_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_payment_lines_report_method_uidx" ON "daily_payment_lines" USING btree ("daily_report_id","payment_method_id");--> statement-breakpoint
CREATE INDEX "daily_payment_lines_method_idx" ON "daily_payment_lines" USING btree ("payment_method_id");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_report_legacy_entry_uidx" ON "daily_report_legacy_entries" USING btree ("entry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_reports_store_date_uidx" ON "daily_reports" USING btree ("store_id","business_date");--> statement-breakpoint
CREATE INDEX "daily_reports_date_status_idx" ON "daily_reports" USING btree ("business_date","status");--> statement-breakpoint
CREATE INDEX "daily_reports_created_by_idx" ON "daily_reports" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "daily_reports_updated_by_idx" ON "daily_reports" USING btree ("updated_by_user_id");--> statement-breakpoint
CREATE INDEX "daily_reports_submitted_by_idx" ON "daily_reports" USING btree ("submitted_by_user_id");--> statement-breakpoint
CREATE INDEX "daily_reports_approved_by_idx" ON "daily_reports" USING btree ("approved_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_sales_lines_report_category_uidx" ON "daily_sales_lines" USING btree ("daily_report_id","category_id");--> statement-breakpoint
CREATE INDEX "daily_sales_lines_category_idx" ON "daily_sales_lines" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "expense_categories_code_lower_uidx" ON "expense_categories" USING btree (lower("code"));--> statement-breakpoint
CREATE INDEX "expenses_category_date_idx" ON "expenses" USING btree ("expense_category_id","business_date");--> statement-breakpoint
CREATE INDEX "expenses_store_date_idx" ON "expenses" USING btree ("store_id","business_date");--> statement-breakpoint
CREATE INDEX "expenses_payment_method_idx" ON "expenses" USING btree ("payment_method_id");--> statement-breakpoint
CREATE INDEX "expenses_created_by_idx" ON "expenses" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "expenses_updated_by_idx" ON "expenses" USING btree ("updated_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "goods_receipt_lines_receipt_product_uidx" ON "goods_receipt_lines" USING btree ("goods_receipt_id","product_id");--> statement-breakpoint
CREATE INDEX "goods_receipt_lines_product_idx" ON "goods_receipt_lines" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "goods_receipts_store_date_idx" ON "goods_receipts" USING btree ("receiving_store_id","business_date");--> statement-breakpoint
CREATE INDEX "goods_receipts_supplier_idx" ON "goods_receipts" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "goods_receipts_created_by_idx" ON "goods_receipts" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "goods_receipts_updated_by_idx" ON "goods_receipts" USING btree ("updated_by_user_id");--> statement-breakpoint
CREATE INDEX "import_batches_type_created_idx" ON "import_batches" USING btree ("type","created_at");--> statement-breakpoint
CREATE INDEX "import_batches_created_by_idx" ON "import_batches" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_methods_code_lower_uidx" ON "payment_methods" USING btree (lower("code"));--> statement-breakpoint
CREATE UNIQUE INDEX "products_sku_lower_uidx" ON "products" USING btree (lower("sku"));--> statement-breakpoint
CREATE INDEX "products_brand_idx" ON "products" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "products_subcategory_idx" ON "products" USING btree ("subcategory_id");--> statement-breakpoint
CREATE INDEX "products_created_by_idx" ON "products" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "products_updated_by_idx" ON "products" USING btree ("updated_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "replenishment_lines_request_product_uidx" ON "replenishment_request_lines" USING btree ("replenishment_request_id","product_id");--> statement-breakpoint
CREATE INDEX "replenishment_lines_product_idx" ON "replenishment_request_lines" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "replenishment_requests_store_date_idx" ON "replenishment_requests" USING btree ("store_id","business_date");--> statement-breakpoint
CREATE INDEX "replenishment_requests_supplier_idx" ON "replenishment_requests" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "replenishment_requests_status_idx" ON "replenishment_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "replenishment_requests_requested_by_idx" ON "replenishment_requests" USING btree ("requested_by_user_id");--> statement-breakpoint
CREATE INDEX "replenishment_requests_reviewed_by_idx" ON "replenishment_requests" USING btree ("reviewed_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_count_lines_count_product_uidx" ON "stock_count_lines" USING btree ("stock_count_id","product_id");--> statement-breakpoint
CREATE INDEX "stock_count_lines_product_idx" ON "stock_count_lines" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "stock_counts_store_date_idx" ON "stock_counts" USING btree ("store_id","business_date");--> statement-breakpoint
CREATE INDEX "stock_counts_status_idx" ON "stock_counts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "stock_counts_counted_by_idx" ON "stock_counts" USING btree ("counted_by_user_id");--> statement-breakpoint
CREATE INDEX "stock_counts_approved_by_idx" ON "stock_counts" USING btree ("approved_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_transfer_lines_transfer_product_uidx" ON "stock_transfer_lines" USING btree ("stock_transfer_id","product_id");--> statement-breakpoint
CREATE INDEX "stock_transfer_lines_product_idx" ON "stock_transfer_lines" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "stock_transfers_from_date_idx" ON "stock_transfers" USING btree ("from_store_id","business_date");--> statement-breakpoint
CREATE INDEX "stock_transfers_to_date_idx" ON "stock_transfers" USING btree ("to_store_id","business_date");--> statement-breakpoint
CREATE INDEX "stock_transfers_status_idx" ON "stock_transfers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "stock_transfers_requested_by_idx" ON "stock_transfers" USING btree ("requested_by_user_id");--> statement-breakpoint
CREATE INDEX "stock_transfers_authorized_by_idx" ON "stock_transfers" USING btree ("authorized_by_user_id");--> statement-breakpoint
CREATE INDEX "stock_transfers_received_by_idx" ON "stock_transfers" USING btree ("received_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stores_code_lower_uidx" ON "stores" USING btree (lower("code"));--> statement-breakpoint
CREATE UNIQUE INDEX "subcategories_category_code_lower_uidx" ON "subcategories" USING btree ("category_id",lower("code"));--> statement-breakpoint
CREATE INDEX "subcategories_category_idx" ON "subcategories" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_code_lower_uidx" ON "suppliers" USING btree (lower("code"));--> statement-breakpoint
CREATE INDEX "weekly_review_actions_review_idx" ON "weekly_review_actions" USING btree ("weekly_review_id");--> statement-breakpoint
CREATE INDEX "weekly_review_actions_owner_idx" ON "weekly_review_actions" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "weekly_review_actions_category_idx" ON "weekly_review_actions" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "weekly_review_actions_product_idx" ON "weekly_review_actions" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_reviews_store_week_uidx" ON "weekly_reviews" USING btree ("store_id","week_end");--> statement-breakpoint
CREATE INDEX "weekly_reviews_week_status_idx" ON "weekly_reviews" USING btree ("week_end","status");--> statement-breakpoint
CREATE INDEX "weekly_reviews_submitted_by_idx" ON "weekly_reviews" USING btree ("submitted_by_user_id");--> statement-breakpoint
CREATE INDEX "weekly_reviews_approved_by_idx" ON "weekly_reviews" USING btree ("approved_by_user_id");