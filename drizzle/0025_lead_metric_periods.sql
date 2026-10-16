-- Additive: historical daily entries retain their dates and all original values.
ALTER TABLE lead_metrics ADD COLUMN period_start date;
ALTER TABLE lead_metrics ADD COLUMN period_end date;
ALTER TABLE lead_metrics ADD COLUMN lock_version integer NOT NULL DEFAULT 1;
UPDATE lead_metrics SET period_start = business_date, period_end = business_date;
ALTER TABLE lead_metrics ALTER COLUMN period_start SET NOT NULL;
ALTER TABLE lead_metrics ALTER COLUMN period_end SET NOT NULL;
ALTER TABLE lead_metrics ADD CONSTRAINT lead_metrics_period_check CHECK (
  period_end >= period_start AND date_trunc('month', period_start::timestamp) = date_trunc('month', period_end::timestamp)
);
ALTER TABLE lead_metrics ADD CONSTRAINT lead_metrics_version_check CHECK (lock_version > 0);
CREATE INDEX lead_metrics_period_idx ON lead_metrics (period_start, period_end);
--> statement-breakpoint
CREATE FUNCTION guard_lead_metric_period() RETURNS trigger LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  channel_key text;
  conflict_id bigint;
BEGIN
  -- Compatibility for existing seed/import scripts that write a single date.
  NEW.period_start := coalesce(NEW.period_start, NEW.business_date);
  NEW.period_end := coalesce(NEW.period_end, NEW.period_start);
  NEW.business_date := NEW.period_start;
  channel_key := lower(regexp_replace(btrim(NEW.channel), '\s+', ' ', 'g'));
  -- Preserve legacy duplicates without silently deleting or merging history.
  -- Count-only corrections remain possible; changing scope/dates is checked anew.
  IF TG_OP = 'UPDATE' THEN
    IF NEW.period_start = OLD.period_start AND NEW.period_end = OLD.period_end
       AND NEW.campaign_report_id IS NOT DISTINCT FROM OLD.campaign_report_id
       AND channel_key = lower(regexp_replace(btrim(OLD.channel), '\s+', ' ', 'g')) THEN
      RETURN NEW;
    END IF;
  END IF;
  -- Serialize overlapping writes for the same normalized channel/campaign.
  -- The following query takes a fresh READ COMMITTED snapshot after the lock.
  PERFORM pg_advisory_xact_lock(hashtextextended('lead-metric:' || channel_key || ':' || coalesce(NEW.campaign_report_id::text, 'group'), 0));
  SELECT id INTO conflict_id FROM lead_metrics
  WHERE id <> NEW.id
    AND lower(regexp_replace(btrim(channel), '\s+', ' ', 'g')) = channel_key
    AND campaign_report_id IS NOT DISTINCT FROM NEW.campaign_report_id
    AND period_start <= NEW.period_end AND period_end >= NEW.period_start
  ORDER BY id LIMIT 1;
  IF conflict_id IS NOT NULL THEN
    RAISE EXCEPTION 'Lead summary period overlaps an existing summary' USING ERRCODE = '23P01';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER lead_metrics_period_guard BEFORE INSERT OR UPDATE ON lead_metrics
FOR EACH ROW EXECUTE FUNCTION guard_lead_metric_period();
