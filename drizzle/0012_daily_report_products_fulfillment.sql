CREATE TABLE "daily_report_products" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "daily_report_products_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"daily_report_id" bigint NOT NULL,
	"category_id" bigint NOT NULL,
	"product_id" bigint,
	"custom_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_report_products_name_check" CHECK ("daily_report_products"."product_id" is not null or "daily_report_products"."custom_name" is not null)
);
--> statement-breakpoint
ALTER TABLE "daily_report_products" ADD CONSTRAINT "daily_report_products_daily_report_id_daily_reports_id_fk" FOREIGN KEY ("daily_report_id") REFERENCES "public"."daily_reports"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "daily_report_products" ADD CONSTRAINT "daily_report_products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "daily_report_products" ADD CONSTRAINT "daily_report_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "daily_report_products_report_idx" ON "daily_report_products" USING btree ("daily_report_id");
--> statement-breakpoint
CREATE INDEX "daily_report_products_category_idx" ON "daily_report_products" USING btree ("category_id");
--> statement-breakpoint
CREATE INDEX "daily_report_products_product_idx" ON "daily_report_products" USING btree ("product_id");
--> statement-breakpoint
ALTER TABLE "customer_interactions" ADD COLUMN "fulfillment_status" text;
--> statement-breakpoint
ALTER TABLE "customer_interactions" ADD CONSTRAINT "customer_interactions_fulfillment_status_check" CHECK ("fulfillment_status" is null or "fulfillment_status" in ('in_stock', 'stock_gap'));
