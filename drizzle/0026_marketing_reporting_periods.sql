-- Existing daily summaries retain all original dates, values, and timestamps.
ALTER TABLE marketing_campaign_reports ADD COLUMN period_start date;
--> statement-breakpoint
ALTER TABLE marketing_campaign_reports ADD COLUMN period_end date;
--> statement-breakpoint
UPDATE marketing_campaign_reports SET period_start = business_date, period_end = business_date;
--> statement-breakpoint
ALTER TABLE marketing_campaign_reports ALTER COLUMN period_start SET NOT NULL;
--> statement-breakpoint
ALTER TABLE marketing_campaign_reports ALTER COLUMN period_end SET NOT NULL;
--> statement-breakpoint
ALTER TABLE marketing_campaign_reports ADD CONSTRAINT marketing_campaigns_period_check CHECK (
  period_end >= period_start AND date_trunc('month', period_start::timestamp) = date_trunc('month', period_end::timestamp)
);
--> statement-breakpoint
CREATE INDEX marketing_campaigns_period_idx ON marketing_campaign_reports (period_start, period_end);
--> statement-breakpoint
ALTER TABLE social_metrics ADD COLUMN period_start date;
--> statement-breakpoint
ALTER TABLE social_metrics ADD COLUMN period_end date;
--> statement-breakpoint
UPDATE social_metrics SET period_start = business_date, period_end = business_date;
--> statement-breakpoint
ALTER TABLE social_metrics ALTER COLUMN period_start SET NOT NULL;
--> statement-breakpoint
ALTER TABLE social_metrics ALTER COLUMN period_end SET NOT NULL;
--> statement-breakpoint
ALTER TABLE social_metrics ADD CONSTRAINT social_metrics_period_check CHECK (
  period_end >= period_start AND date_trunc('month', period_start::timestamp) = date_trunc('month', period_end::timestamp)
);
--> statement-breakpoint
CREATE INDEX social_metrics_period_idx ON social_metrics (period_start, period_end);
--> statement-breakpoint
ALTER TABLE clienteling_activities ADD COLUMN period_start date;
--> statement-breakpoint
ALTER TABLE clienteling_activities ADD COLUMN period_end date;
--> statement-breakpoint
UPDATE clienteling_activities SET period_start = business_date, period_end = business_date;
--> statement-breakpoint
ALTER TABLE clienteling_activities ALTER COLUMN period_start SET NOT NULL;
--> statement-breakpoint
ALTER TABLE clienteling_activities ALTER COLUMN period_end SET NOT NULL;
--> statement-breakpoint
ALTER TABLE clienteling_activities ADD CONSTRAINT clienteling_period_check CHECK (
  period_end >= period_start AND date_trunc('month', period_start::timestamp) = date_trunc('month', period_end::timestamp)
);
--> statement-breakpoint
CREATE INDEX clienteling_period_idx ON clienteling_activities (period_start, period_end);
--> statement-breakpoint
CREATE FUNCTION guard_marketing_reporting_period() RETURNS trigger LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  scope_key jsonb;
  previous_scope jsonb;
  scope_expression text;
  conflict_id bigint;
BEGIN
  NEW.period_start := coalesce(NEW.period_start, NEW.business_date);
  NEW.period_end := coalesce(NEW.period_end, NEW.period_start);
  NEW.business_date := NEW.period_start;

  IF TG_TABLE_NAME = 'marketing_campaign_reports' THEN
    scope_key := jsonb_build_array(lower(regexp_replace(btrim(NEW.name), '\s+', ' ', 'g')), lower(regexp_replace(btrim(NEW.platform), '\s+', ' ', 'g')), NEW.brand_id);
    scope_expression := $expr$jsonb_build_array(lower(regexp_replace(btrim(name), '\s+', ' ', 'g')), lower(regexp_replace(btrim(platform), '\s+', ' ', 'g')), brand_id)$expr$;
    IF TG_OP = 'UPDATE' THEN
      previous_scope := jsonb_build_array(lower(regexp_replace(btrim(OLD.name), '\s+', ' ', 'g')), lower(regexp_replace(btrim(OLD.platform), '\s+', ' ', 'g')), OLD.brand_id);
    END IF;
  ELSIF TG_TABLE_NAME = 'social_metrics' THEN
    scope_key := jsonb_build_array(lower(regexp_replace(btrim(NEW.platform), '\s+', ' ', 'g')), NEW.brand_id);
    scope_expression := $expr$jsonb_build_array(lower(regexp_replace(btrim(platform), '\s+', ' ', 'g')), brand_id)$expr$;
    IF TG_OP = 'UPDATE' THEN
      previous_scope := jsonb_build_array(lower(regexp_replace(btrim(OLD.platform), '\s+', ' ', 'g')), OLD.brand_id);
    END IF;
  ELSIF TG_TABLE_NAME = 'clienteling_activities' THEN
    scope_key := jsonb_build_array(lower(regexp_replace(btrim(NEW.type), '\s+', ' ', 'g')), NEW.store_id);
    scope_expression := $expr$jsonb_build_array(lower(regexp_replace(btrim(type), '\s+', ' ', 'g')), store_id)$expr$;
    IF TG_OP = 'UPDATE' THEN
      previous_scope := jsonb_build_array(lower(regexp_replace(btrim(OLD.type), '\s+', ' ', 'g')), OLD.store_id);
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported marketing period table';
  END IF;

  -- Leave legacy duplicates intact; existing count-only corrections still work.
  IF TG_OP = 'UPDATE' THEN
    IF NEW.period_start = OLD.period_start AND NEW.period_end = OLD.period_end AND scope_key = previous_scope THEN
      RETURN NEW;
    END IF;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(TG_TABLE_NAME || ':' || scope_key::text, 0));
  -- VOLATILE gives this query a fresh READ COMMITTED snapshot after waiting.
  -- Table and comparison expression come only from the fixed cases above.
  EXECUTE format('SELECT id FROM %I WHERE id <> $1 AND period_start <= $2 AND period_end >= $3 AND %s = $4 ORDER BY id LIMIT 1', TG_TABLE_NAME, scope_expression)
    INTO conflict_id USING NEW.id, NEW.period_end, NEW.period_start, scope_key;
  IF conflict_id IS NOT NULL THEN
    RAISE EXCEPTION 'Marketing reporting period overlaps an existing summary' USING ERRCODE = '23P01';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER marketing_campaign_period_guard BEFORE INSERT OR UPDATE ON marketing_campaign_reports
FOR EACH ROW EXECUTE FUNCTION guard_marketing_reporting_period();
--> statement-breakpoint
CREATE TRIGGER social_metric_period_guard BEFORE INSERT OR UPDATE ON social_metrics
FOR EACH ROW EXECUTE FUNCTION guard_marketing_reporting_period();
--> statement-breakpoint
CREATE TRIGGER clienteling_period_guard BEFORE INSERT OR UPDATE ON clienteling_activities
FOR EACH ROW EXECUTE FUNCTION guard_marketing_reporting_period();
