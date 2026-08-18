CREATE TABLE "store_stock_levels" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "store_stock_levels_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"store_id" bigint NOT NULL,
	"product_id" bigint NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"as_of_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_stock_levels_quantity_check" CHECK ("store_stock_levels"."quantity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "store_groups" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "store_groups_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_group_members" (
	"store_group_id" bigint NOT NULL,
	"store_id" bigint NOT NULL,
	CONSTRAINT "store_group_members_pk" PRIMARY KEY("store_group_id","store_id")
);
--> statement-breakpoint
CREATE TABLE "user_stores" (
	"user_id" integer NOT NULL,
	"store_id" bigint NOT NULL,
	CONSTRAINT "user_stores_pk" PRIMARY KEY("user_id","store_id")
);
--> statement-breakpoint
ALTER TABLE "store_stock_levels" ADD CONSTRAINT "store_stock_levels_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "store_stock_levels" ADD CONSTRAINT "store_stock_levels_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "store_group_members" ADD CONSTRAINT "store_group_members_store_group_id_store_groups_id_fk" FOREIGN KEY ("store_group_id") REFERENCES "public"."store_groups"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "store_group_members" ADD CONSTRAINT "store_group_members_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_stores" ADD CONSTRAINT "user_stores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_stores" ADD CONSTRAINT "user_stores_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "store_stock_levels_store_product_uidx" ON "store_stock_levels" USING btree ("store_id","product_id");
--> statement-breakpoint
CREATE INDEX "store_stock_levels_product_idx" ON "store_stock_levels" USING btree ("product_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "store_groups_code_lower_uidx" ON "store_groups" USING btree (lower("code"));
--> statement-breakpoint
CREATE INDEX "store_group_members_store_idx" ON "store_group_members" USING btree ("store_id");
--> statement-breakpoint
CREATE INDEX "user_stores_store_idx" ON "user_stores" USING btree ("store_id");
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "barcode" text;
--> statement-breakpoint
CREATE UNIQUE INDEX "products_barcode_lower_uidx" ON "products" USING btree (lower("barcode")) WHERE "barcode" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "daily_report_products" ADD COLUMN "units" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "daily_report_products" ADD COLUMN "line_value" numeric(14, 2) DEFAULT '0' NOT NULL;
--> statement-breakpoint
ALTER TABLE "daily_report_products" ADD COLUMN "value_overridden" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "daily_report_products" ADD CONSTRAINT "daily_report_products_amounts_check" CHECK ("daily_report_products"."units" >= 0 and "daily_report_products"."line_value" >= 0);
--> statement-breakpoint
-- Existing single-store managers keep exactly the access they have today: their
-- users.store code becomes one membership row. users.store stays in place as the
-- source of truth until every read path has moved to user_stores.
INSERT INTO "user_stores" ("user_id", "store_id")
SELECT u."id", s."id"
FROM "users" u
JOIN "stores" s ON lower(s."code") = lower(u."store")
WHERE u."store" IS NOT NULL AND u."store" <> ''
ON CONFLICT DO NOTHING;
