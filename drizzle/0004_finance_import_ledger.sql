CREATE TABLE "import_batch_rows" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "import_batch_rows_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"import_batch_id" bigint NOT NULL,
	"sheet" text NOT NULL,
	"source_row" integer NOT NULL,
	"operation" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" bigint NOT NULL,
	"before" jsonb,
	"after" jsonb NOT NULL,
	"undone_at" timestamp with time zone,
	"undone_by_user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "import_batch_rows_source_row_check" CHECK ("import_batch_rows"."source_row" >= 2),
	CONSTRAINT "import_batch_rows_sheet_check" CHECK ("import_batch_rows"."sheet" in ('expenses', 'budget')),
	CONSTRAINT "import_batch_rows_operation_check" CHECK ("import_batch_rows"."operation" in ('insert', 'update')),
	CONSTRAINT "import_batch_rows_entity_type_check" CHECK ("import_batch_rows"."entity_type" in ('expense', 'budget')),
	CONSTRAINT "import_batch_rows_before_check" CHECK (("import_batch_rows"."operation" = 'insert' and "import_batch_rows"."before" is null) or ("import_batch_rows"."operation" = 'update' and "import_batch_rows"."before" is not null)),
	CONSTRAINT "import_batch_rows_undo_check" CHECK (("import_batch_rows"."undone_at" is null and "import_batch_rows"."undone_by_user_id" is null) or ("import_batch_rows"."undone_at" is not null and "import_batch_rows"."undone_by_user_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "audit_events" DROP CONSTRAINT "audit_events_action_check";--> statement-breakpoint
ALTER TABLE "import_batches" DROP CONSTRAINT "import_batches_status_check";--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "import_batch_id" bigint;--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "import_source_row" integer;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "import_batch_id" bigint;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "import_source_row" integer;--> statement-breakpoint
ALTER TABLE "import_batches" ADD COLUMN "undone_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "import_batches" ADD COLUMN "undone_by_user_id" integer;--> statement-breakpoint
ALTER TABLE "import_batch_rows" ADD CONSTRAINT "import_batch_rows_import_batch_id_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."import_batches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batch_rows" ADD CONSTRAINT "import_batch_rows_undone_by_user_id_users_id_fk" FOREIGN KEY ("undone_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "import_batch_rows_batch_sheet_row_uidx" ON "import_batch_rows" USING btree ("import_batch_id","sheet","source_row");--> statement-breakpoint
CREATE INDEX "import_batch_rows_entity_idx" ON "import_batch_rows" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "import_batch_rows_undone_by_idx" ON "import_batch_rows" USING btree ("undone_by_user_id");--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_import_batch_id_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."import_batches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_import_batch_id_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."import_batches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_undone_by_user_id_users_id_fk" FOREIGN KEY ("undone_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "budgets_import_batch_source_uidx" ON "budgets" USING btree ("import_batch_id","import_source_row");--> statement-breakpoint
CREATE UNIQUE INDEX "expenses_import_batch_source_uidx" ON "expenses" USING btree ("import_batch_id","import_source_row");--> statement-breakpoint
CREATE INDEX "import_batches_undone_by_idx" ON "import_batches" USING btree ("undone_by_user_id");--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_action_check" CHECK ("audit_events"."action" in ('create', 'update', 'submit', 'approve', 'reopen', 'cancel', 'complete', 'archive', 'restore', 'import', 'settle', 'authorize', 'receive', 'undo'));--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_import_source_check" CHECK (("budgets"."import_batch_id" is null and "budgets"."import_source_row" is null) or ("budgets"."import_batch_id" is not null and "budgets"."import_source_row" >= 2));--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_import_source_check" CHECK (("expenses"."import_batch_id" is null and "expenses"."import_source_row" is null) or ("expenses"."import_batch_id" is not null and "expenses"."import_source_row" >= 2));--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_undo_check" CHECK (("import_batches"."status" = 'undone' and "import_batches"."undone_at" is not null and "import_batches"."undone_by_user_id" is not null) or ("import_batches"."status" <> 'undone' and "import_batches"."undone_at" is null and "import_batches"."undone_by_user_id" is null));--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_status_check" CHECK ("import_batches"."status" in ('pending', 'running', 'completed', 'failed', 'undone'));