CREATE TABLE "customer_deposit_items" (
  "id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "customer_deposit_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
  "deposit_id" bigint NOT NULL,
  "product_id" bigint NOT NULL,
  "product_name" text NOT NULL,
  "sku" text,
  "barcode" text,
  "quantity" integer NOT NULL,
  "unit_price" numeric(14, 2) NOT NULL,
  "line_value" numeric(14, 2) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "customer_deposit_items_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "customer_deposit_items_amounts_check" CHECK ("unit_price" >= 0 and "line_value" > 0)
);
--> statement-breakpoint
ALTER TABLE "customer_deposit_items" ADD CONSTRAINT "customer_deposit_items_deposit_id_customer_deposits_id_fk" FOREIGN KEY ("deposit_id") REFERENCES "public"."customer_deposits"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "customer_deposit_items" ADD CONSTRAINT "customer_deposit_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "customer_deposit_items_deposit_idx" ON "customer_deposit_items" USING btree ("deposit_id");
--> statement-breakpoint
CREATE INDEX "customer_deposit_items_product_idx" ON "customer_deposit_items" USING btree ("product_id");
--> statement-breakpoint
ALTER TABLE "customer_credit_note_items" ADD COLUMN "unit_price" numeric(14, 2);
--> statement-breakpoint
ALTER TABLE "customer_credit_note_items" ADD CONSTRAINT "customer_credit_note_items_unit_price_check" CHECK ("unit_price" is null or "unit_price" >= 0);
--> statement-breakpoint
UPDATE "customer_credit_note_items"
SET "unit_price" = "original_value" / "quantity"
WHERE "quantity" > 0 and "unit_price" is null;
--> statement-breakpoint
INSERT INTO "customer_deposit_items" (
  "deposit_id", "product_id", "product_name", "sku", "barcode", "quantity", "unit_price", "line_value"
)
SELECT
  deposit."id", deposit."product_id", deposit."product_name", product."sku", product."barcode",
  deposit."quantity", deposit."total_value" / deposit."quantity", deposit."total_value"
FROM "customer_deposits" deposit
LEFT JOIN "products" product ON product."id" = deposit."product_id"
WHERE deposit."quantity" > 0
  AND NOT EXISTS (
    SELECT 1 FROM "customer_deposit_items" item WHERE item."deposit_id" = deposit."id"
  );
--> statement-breakpoint
DROP INDEX IF EXISTS "store_stock_reservations_deposit_uidx";
