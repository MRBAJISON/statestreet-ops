ALTER TABLE "performance_targets"
  ADD COLUMN "recurring" boolean NOT NULL DEFAULT false;

ALTER TABLE "performance_targets"
  DROP CONSTRAINT IF EXISTS "targets_period_type_check";

ALTER TABLE "performance_targets"
  ADD CONSTRAINT "targets_period_type_check"
  CHECK ("period_type" IN ('day', 'week', 'month', 'quarter', 'year'));

ALTER TABLE "performance_targets"
  ADD CONSTRAINT "targets_recurring_period_check"
  CHECK ("recurring" = false OR "period_type" IN ('day', 'week', 'month'));
