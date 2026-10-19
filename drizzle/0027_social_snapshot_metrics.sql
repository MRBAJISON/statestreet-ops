-- New period metrics are unknown on historical snapshots. Do not backfill them
-- from audience balances or clicks: those measures have different meanings.
ALTER TABLE "social_metrics" ADD COLUMN "follows" integer;
--> statement-breakpoint
ALTER TABLE "social_metrics" ADD COLUMN "profile_activity" integer;
--> statement-breakpoint
ALTER TABLE "social_metrics" ADD CONSTRAINT "social_metrics_follows_check" CHECK ("follows" IS NULL OR "follows" >= 0);
--> statement-breakpoint
ALTER TABLE "social_metrics" ADD CONSTRAINT "social_metrics_profile_activity_check" CHECK ("profile_activity" IS NULL OR "profile_activity" >= 0);
--> statement-breakpoint
-- Omitted optional measurements are unknown, not measured zero. Existing values
-- (including historical zeroes) are preserved without rewriting any rows.
ALTER TABLE "social_metrics"
  ALTER COLUMN "followers" DROP NOT NULL,
  ALTER COLUMN "followers" DROP DEFAULT,
  ALTER COLUMN "posts" DROP NOT NULL,
  ALTER COLUMN "posts" DROP DEFAULT,
  ALTER COLUMN "reels" DROP NOT NULL,
  ALTER COLUMN "reels" DROP DEFAULT,
  ALTER COLUMN "stories" DROP NOT NULL,
  ALTER COLUMN "stories" DROP DEFAULT,
  ALTER COLUMN "clicks" DROP NOT NULL,
  ALTER COLUMN "clicks" DROP DEFAULT,
  ALTER COLUMN "website_visits" DROP NOT NULL,
  ALTER COLUMN "website_visits" DROP DEFAULT;
