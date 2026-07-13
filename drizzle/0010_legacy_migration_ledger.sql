ALTER TABLE "product_insights" ADD COLUMN IF NOT EXISTS "units_sold" integer;
--> statement-breakpoint
ALTER TABLE "product_insights" ADD COLUMN IF NOT EXISTS "current_stock" integer;
--> statement-breakpoint
ALTER TABLE "product_insights" ADD COLUMN IF NOT EXISTS "sell_through_percent" numeric(6, 2);
--> statement-breakpoint
ALTER TABLE "product_insights" ADD COLUMN IF NOT EXISTS "sales_value" numeric(14, 2);
--> statement-breakpoint
ALTER TABLE "product_insights" ADD COLUMN IF NOT EXISTS "days_in_stock" integer;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "product_insights" ADD CONSTRAINT "product_insights_metrics_check" CHECK (("units_sold" is null or "units_sold" >= 0) and ("current_stock" is null or "current_stock" >= 0) and ("sell_through_percent" is null or "sell_through_percent" between 0 and 100) and ("sales_value" is null or "sales_value" >= 0) and ("days_in_stock" is null or "days_in_stock" >= 0));
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_summary_snapshots" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "inventory_summary_snapshots_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"business_date" date NOT NULL,
	"store_id" bigint NOT NULL,
	"system_quantity" integer NOT NULL,
	"physical_quantity" integer NOT NULL,
	"stock_value" numeric(14, 2) DEFAULT '0' NOT NULL,
	"counted_by_name" text,
	"notes" text,
	"created_by_user_id" integer NOT NULL,
	"updated_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_summary_snapshots_values_check" CHECK ("inventory_summary_snapshots"."system_quantity" >= 0 and "inventory_summary_snapshots"."physical_quantity" >= 0 and "inventory_summary_snapshots"."stock_value" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_summary_snapshots_store_date_uidx" ON "inventory_summary_snapshots" USING btree ("store_id", "business_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_summary_snapshots_date_idx" ON "inventory_summary_snapshots" USING btree ("business_date");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_summary_snapshots" ADD CONSTRAINT "inventory_summary_snapshots_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_summary_snapshots" ADD CONSTRAINT "inventory_summary_snapshots_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_summary_snapshots" ADD CONSTRAINT "inventory_summary_snapshots_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "legacy_migration_records" (
	"entry_id" integer PRIMARY KEY NOT NULL,
	"disposition" text NOT NULL,
	"target_type" text,
	"target_id" bigint,
	"source_created_at" timestamp with time zone NOT NULL,
	"source_payload_hash" text NOT NULL,
	"note" text,
	"migrated_by_user_id" integer NOT NULL,
	"migrated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "legacy_migration_records_disposition_check" CHECK ("legacy_migration_records"."disposition" in ('converted', 'derived', 'retained', 'blocked')),
	CONSTRAINT "legacy_migration_records_target_check" CHECK (("legacy_migration_records"."disposition" = 'converted' and "legacy_migration_records"."target_type" is not null and "legacy_migration_records"."target_id" is not null) or "legacy_migration_records"."disposition" <> 'converted')
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "legacy_migration_records_disposition_idx" ON "legacy_migration_records" USING btree ("disposition", "target_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "legacy_migration_records_target_idx" ON "legacy_migration_records" USING btree ("target_type", "target_id");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "legacy_migration_records" ADD CONSTRAINT "legacy_migration_records_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "legacy_migration_records" ADD CONSTRAINT "legacy_migration_records_migrated_by_user_id_users_id_fk" FOREIGN KEY ("migrated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION reject_legacy_migration_record_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	RAISE EXCEPTION 'Legacy migration records are immutable' USING ERRCODE = '55000';
END;
$$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TRIGGER legacy_migration_records_immutable
 BEFORE UPDATE OR DELETE ON legacy_migration_records
 FOR EACH ROW EXECUTE FUNCTION reject_legacy_migration_record_mutation();
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION reject_migrated_legacy_entry_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF TG_OP = 'INSERT' THEN
		IF EXISTS (SELECT 1 FROM legacy_migration_records LIMIT 1) THEN
			RAISE EXCEPTION 'Legacy entry writes are closed after migration' USING ERRCODE = '55000';
		END IF;
		RETURN NEW;
	END IF;
	IF EXISTS (SELECT 1 FROM legacy_migration_records WHERE entry_id = OLD.id) THEN
		RAISE EXCEPTION 'Migrated legacy entries are immutable' USING ERRCODE = '55000';
	END IF;
	IF TG_OP = 'DELETE' THEN
		RETURN OLD;
	END IF;
	RETURN NEW;
END;
$$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TRIGGER entries_migrated_immutable
 BEFORE INSERT OR UPDATE OR DELETE ON entries
 FOR EACH ROW EXECUTE FUNCTION reject_migrated_legacy_entry_mutation();
EXCEPTION WHEN duplicate_object THEN null;
END $$;
