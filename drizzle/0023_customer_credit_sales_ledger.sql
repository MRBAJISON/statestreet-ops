CREATE TABLE "customer_credit_sales" (
  "id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "customer_credit_sales_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
  "store_id" bigint NOT NULL,
  "daily_report_id" bigint,
  "business_date" date NOT NULL,
  "customer_name" text NOT NULL,
  "customer_phone" text,
  "receipt_number" text,
  "due_date" date,
  "total_value" numeric(14, 2) NOT NULL,
  "open_value" numeric(14, 2) NOT NULL,
  "status" text DEFAULT 'open' NOT NULL,
  "created_by_user_id" integer NOT NULL,
  "updated_by_user_id" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "customer_credit_sales_values_check" CHECK ("total_value" > 0 and "open_value" >= 0 and "open_value" <= "total_value"),
  CONSTRAINT "customer_credit_sales_status_check" CHECK ("status" in ('open', 'partial', 'settled'))
);
--> statement-breakpoint
ALTER TABLE "customer_credit_sales" ADD CONSTRAINT "customer_credit_sales_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "customer_credit_sales" ADD CONSTRAINT "customer_credit_sales_daily_report_id_daily_reports_id_fk" FOREIGN KEY ("daily_report_id") REFERENCES "public"."daily_reports"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "customer_credit_sales" ADD CONSTRAINT "customer_credit_sales_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "customer_credit_sales" ADD CONSTRAINT "customer_credit_sales_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "customer_credit_sales_store_date_idx" ON "customer_credit_sales" USING btree ("store_id", "business_date");
--> statement-breakpoint
CREATE INDEX "customer_credit_sales_status_due_idx" ON "customer_credit_sales" USING btree ("status", "due_date");
--> statement-breakpoint
CREATE INDEX "customer_credit_sales_customer_idx" ON "customer_credit_sales" USING btree ("customer_name", "customer_phone");
--> statement-breakpoint

CREATE TABLE "customer_credit_sale_items" (
  "id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "customer_credit_sale_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
  "credit_sale_id" bigint NOT NULL,
  "category_id" bigint NOT NULL,
  "product_id" bigint,
  "product_name" text NOT NULL,
  "quantity" integer NOT NULL,
  "unit_price" numeric(14, 2) NOT NULL,
  "line_value" numeric(14, 2) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "customer_credit_sale_items_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "customer_credit_sale_items_amounts_check" CHECK ("unit_price" > 0 and "line_value" > 0)
);
--> statement-breakpoint
ALTER TABLE "customer_credit_sale_items" ADD CONSTRAINT "customer_credit_sale_items_credit_sale_id_customer_credit_sales_id_fk" FOREIGN KEY ("credit_sale_id") REFERENCES "public"."customer_credit_sales"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "customer_credit_sale_items" ADD CONSTRAINT "customer_credit_sale_items_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "customer_credit_sale_items" ADD CONSTRAINT "customer_credit_sale_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "customer_credit_sale_items_sale_idx" ON "customer_credit_sale_items" USING btree ("credit_sale_id");
--> statement-breakpoint
CREATE INDEX "customer_credit_sale_items_category_idx" ON "customer_credit_sale_items" USING btree ("category_id");
--> statement-breakpoint
CREATE INDEX "customer_credit_sale_items_product_idx" ON "customer_credit_sale_items" USING btree ("product_id");
--> statement-breakpoint

CREATE TABLE "customer_credit_sale_payments" (
  "id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "customer_credit_sale_payments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
  "credit_sale_id" bigint NOT NULL,
  "store_id" bigint NOT NULL,
  "business_date" date NOT NULL,
  "amount" numeric(14, 2) NOT NULL,
  "payment_method_id" bigint NOT NULL,
  "reference" text,
  "created_by_user_id" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "customer_credit_sale_payments_amount_check" CHECK ("amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "customer_credit_sale_payments" ADD CONSTRAINT "customer_credit_sale_payments_credit_sale_id_customer_credit_sales_id_fk" FOREIGN KEY ("credit_sale_id") REFERENCES "public"."customer_credit_sales"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "customer_credit_sale_payments" ADD CONSTRAINT "customer_credit_sale_payments_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "customer_credit_sale_payments" ADD CONSTRAINT "customer_credit_sale_payments_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "customer_credit_sale_payments" ADD CONSTRAINT "customer_credit_sale_payments_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "customer_credit_sale_payments_sale_idx" ON "customer_credit_sale_payments" USING btree ("credit_sale_id", "business_date");
--> statement-breakpoint
CREATE INDEX "customer_credit_sale_payments_store_date_idx" ON "customer_credit_sale_payments" USING btree ("store_id", "business_date");
