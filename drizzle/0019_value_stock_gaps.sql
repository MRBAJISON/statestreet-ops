ALTER TABLE "customer_interactions"
  ADD COLUMN "stock_gap_quantity" integer,
  ADD COLUMN "stock_gap_value" numeric(14, 2),
  ADD COLUMN "stock_gap_cause" text;

ALTER TABLE "customer_interactions"
  ADD CONSTRAINT "customer_interactions_stock_gap_fields_check"
  CHECK (
    "fulfillment_status" = 'stock_gap'
    OR ("stock_gap_quantity" IS NULL AND "stock_gap_value" IS NULL AND "stock_gap_cause" IS NULL)
  );

ALTER TABLE "customer_interactions"
  ADD CONSTRAINT "customer_interactions_stock_gap_amounts_check"
  CHECK ("stock_gap_quantity" IS NULL OR "stock_gap_quantity" >= 1);
