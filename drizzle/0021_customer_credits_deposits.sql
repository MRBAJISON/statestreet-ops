CREATE TABLE "customer_credit_notes" (
  "id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "customer_credit_notes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
  "store_id" bigint NOT NULL,
  "business_date" date NOT NULL,
  "customer_name" text NOT NULL,
  "customer_phone" text,
  "original_receipt_number" text,
  "original_purchase_date" date,
  "reason" text NOT NULL,
  "requested_value" numeric(14, 2) NOT NULL,
  "approved_value" numeric(14, 2),
  "status" text DEFAULT 'submitted' NOT NULL,
  "decision_reason" text,
  "submitted_by_user_id" integer NOT NULL,
  "approved_by_user_id" integer,
  "approved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "customer_credit_notes_values_check" CHECK ("requested_value" > 0 and ("approved_value" is null or "approved_value" > 0)),
  CONSTRAINT "customer_credit_notes_status_check" CHECK ("status" in ('submitted', 'approved', 'rejected', 'partially-redeemed', 'redeemed'))
);
--> statement-breakpoint
ALTER TABLE "customer_credit_notes" ADD CONSTRAINT "customer_credit_notes_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "customer_credit_notes" ADD CONSTRAINT "customer_credit_notes_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "customer_credit_notes" ADD CONSTRAINT "customer_credit_notes_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "customer_credit_notes_store_date_idx" ON "customer_credit_notes" USING btree ("store_id", "business_date");
--> statement-breakpoint
CREATE INDEX "customer_credit_notes_status_idx" ON "customer_credit_notes" USING btree ("status", "business_date");
--> statement-breakpoint

CREATE TABLE "customer_credit_note_items" (
  "id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "customer_credit_note_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
  "credit_note_id" bigint NOT NULL,
  "product_id" bigint,
  "product_name" text NOT NULL,
  "quantity" integer NOT NULL,
  "original_value" numeric(14, 2) NOT NULL,
  "unworn_unused" boolean NOT NULL,
  "original_tags_attached" boolean NOT NULL,
  "original_packaging" boolean NOT NULL,
  "inspected_approved" boolean NOT NULL,
  "inventory_status" text DEFAULT 'pending' NOT NULL,
  "inventory_decision" text,
  "inventory_decision_reason" text,
  "inventory_decided_by_user_id" integer,
  "inventory_decided_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "customer_credit_note_items_quantity_check" CHECK ("quantity" > 0 and "original_value" > 0),
  CONSTRAINT "customer_credit_note_items_name_check" CHECK ("product_id" is not null or length(trim("product_name")) > 0),
  CONSTRAINT "customer_credit_note_items_inventory_status_check" CHECK ("inventory_status" in ('pending', 'auto-restocked', 'pending-review', 'restocked', 'rejected'))
);
--> statement-breakpoint
ALTER TABLE "customer_credit_note_items" ADD CONSTRAINT "customer_credit_note_items_credit_note_id_customer_credit_notes_id_fk" FOREIGN KEY ("credit_note_id") REFERENCES "public"."customer_credit_notes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "customer_credit_note_items" ADD CONSTRAINT "customer_credit_note_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "customer_credit_note_items" ADD CONSTRAINT "customer_credit_note_items_inventory_decided_by_user_id_users_id_fk" FOREIGN KEY ("inventory_decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "customer_credit_note_items_note_idx" ON "customer_credit_note_items" USING btree ("credit_note_id");
--> statement-breakpoint
CREATE INDEX "customer_credit_note_items_product_idx" ON "customer_credit_note_items" USING btree ("product_id");
--> statement-breakpoint

CREATE TABLE "customer_credit_note_redemptions" (
  "id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "customer_credit_note_redemptions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
  "credit_note_id" bigint NOT NULL,
  "store_id" bigint NOT NULL,
  "business_date" date NOT NULL,
  "replacement_product_id" bigint,
  "replacement_description" text,
  "replacement_value" numeric(14, 2) NOT NULL,
  "credit_applied" numeric(14, 2) NOT NULL,
  "additional_payment" numeric(14, 2) NOT NULL,
  "payment_method_id" bigint,
  "created_by_user_id" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "customer_credit_note_redemptions_values_check" CHECK ("replacement_value" > 0 and "credit_applied" >= 0 and "additional_payment" >= 0)
);
--> statement-breakpoint
ALTER TABLE "customer_credit_note_redemptions" ADD CONSTRAINT "customer_credit_note_redemptions_credit_note_id_customer_credit_notes_id_fk" FOREIGN KEY ("credit_note_id") REFERENCES "public"."customer_credit_notes"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "customer_credit_note_redemptions" ADD CONSTRAINT "customer_credit_note_redemptions_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "customer_credit_note_redemptions" ADD CONSTRAINT "customer_credit_note_redemptions_replacement_product_id_products_id_fk" FOREIGN KEY ("replacement_product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "customer_credit_note_redemptions" ADD CONSTRAINT "customer_credit_note_redemptions_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "customer_credit_note_redemptions" ADD CONSTRAINT "customer_credit_note_redemptions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "customer_credit_note_redemptions_note_idx" ON "customer_credit_note_redemptions" USING btree ("credit_note_id");
--> statement-breakpoint

CREATE TABLE "customer_deposits" (
  "id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "customer_deposits_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
  "store_id" bigint NOT NULL,
  "business_date" date NOT NULL,
  "customer_name" text NOT NULL,
  "customer_phone" text,
  "product_id" bigint NOT NULL,
  "product_name" text NOT NULL,
  "quantity" integer NOT NULL,
  "total_value" numeric(14, 2) NOT NULL,
  "expected_collection_date" date,
  "status" text DEFAULT 'active' NOT NULL,
  "cancellation_reason" text,
  "cancellation_requested_at" timestamp with time zone,
  "cancellation_decision" text,
  "decision_reason" text,
  "decided_by_user_id" integer,
  "decided_at" timestamp with time zone,
  "collected_at" timestamp with time zone,
  "created_by_user_id" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "customer_deposits_values_check" CHECK ("quantity" > 0 and "total_value" > 0),
  CONSTRAINT "customer_deposits_status_check" CHECK ("status" in ('active', 'ready', 'collected', 'cancel-requested', 'refunded', 'forfeited', 'store-credit')),
  CONSTRAINT "customer_deposits_decision_check" CHECK ("cancellation_decision" is null or "cancellation_decision" in ('refund', 'forfeit', 'store-credit'))
);
--> statement-breakpoint
ALTER TABLE "customer_deposits" ADD CONSTRAINT "customer_deposits_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "customer_deposits" ADD CONSTRAINT "customer_deposits_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "customer_deposits" ADD CONSTRAINT "customer_deposits_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "customer_deposits" ADD CONSTRAINT "customer_deposits_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "customer_deposits_store_date_idx" ON "customer_deposits" USING btree ("store_id", "business_date");
--> statement-breakpoint
CREATE INDEX "customer_deposits_status_idx" ON "customer_deposits" USING btree ("status", "business_date");
--> statement-breakpoint

CREATE TABLE "customer_deposit_payments" (
  "id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "customer_deposit_payments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
  "deposit_id" bigint NOT NULL,
  "store_id" bigint NOT NULL,
  "business_date" date NOT NULL,
  "payment_type" text NOT NULL,
  "amount" numeric(14, 2) NOT NULL,
  "payment_method_id" bigint,
  "reference" text,
  "created_by_user_id" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "customer_deposit_payments_type_check" CHECK ("payment_type" in ('deposit', 'balance', 'refund')),
  CONSTRAINT "customer_deposit_payments_amount_check" CHECK ("amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "customer_deposit_payments" ADD CONSTRAINT "customer_deposit_payments_deposit_id_customer_deposits_id_fk" FOREIGN KEY ("deposit_id") REFERENCES "public"."customer_deposits"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "customer_deposit_payments" ADD CONSTRAINT "customer_deposit_payments_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "customer_deposit_payments" ADD CONSTRAINT "customer_deposit_payments_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "customer_deposit_payments" ADD CONSTRAINT "customer_deposit_payments_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "customer_deposit_payments_deposit_idx" ON "customer_deposit_payments" USING btree ("deposit_id");
--> statement-breakpoint
CREATE INDEX "customer_deposit_payments_store_date_idx" ON "customer_deposit_payments" USING btree ("store_id", "business_date");
--> statement-breakpoint

CREATE TABLE "store_stock_reservations" (
  "id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "store_stock_reservations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
  "deposit_id" bigint NOT NULL,
  "store_id" bigint NOT NULL,
  "product_id" bigint NOT NULL,
  "quantity" integer NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "released_at" timestamp with time zone,
  "fulfilled_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "store_stock_reservations_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "store_stock_reservations_status_check" CHECK ("status" in ('active', 'released', 'fulfilled'))
);
--> statement-breakpoint
ALTER TABLE "store_stock_reservations" ADD CONSTRAINT "store_stock_reservations_deposit_id_customer_deposits_id_fk" FOREIGN KEY ("deposit_id") REFERENCES "public"."customer_deposits"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "store_stock_reservations" ADD CONSTRAINT "store_stock_reservations_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "store_stock_reservations" ADD CONSTRAINT "store_stock_reservations_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "store_stock_reservations_deposit_uidx" ON "store_stock_reservations" USING btree ("deposit_id");
--> statement-breakpoint
CREATE INDEX "store_stock_reservations_store_product_idx" ON "store_stock_reservations" USING btree ("store_id", "product_id", "status");
--> statement-breakpoint
ALTER TABLE "audit_events" DROP CONSTRAINT IF EXISTS "audit_events_action_check";
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_action_check" CHECK ("action" in ('create', 'update', 'submit', 'approve', 'reject', 'reopen', 'cancel', 'complete', 'archive', 'restore', 'import', 'settle', 'authorize', 'receive', 'undo'));
