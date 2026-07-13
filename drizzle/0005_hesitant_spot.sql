CREATE TABLE "survey_rate_limits" (
	"fingerprint" text PRIMARY KEY NOT NULL,
	"window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submission_count" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "survey_rate_limits_count_check" CHECK ("survey_rate_limits"."submission_count" > 0)
);
--> statement-breakpoint
CREATE INDEX "survey_rate_limits_updated_idx" ON "survey_rate_limits" USING btree ("updated_at");
--> statement-breakpoint
INSERT INTO "organization_settings" ("id") VALUES (1) ON CONFLICT ("id") DO NOTHING;
