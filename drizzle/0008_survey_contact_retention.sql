ALTER TABLE "customer_feedback" ADD COLUMN "contact_redacted_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "customer_feedback"
SET
	"contact_name" = NULL,
	"contact_value" = NULL,
	"contact_consent" = false,
	"contact_redacted_at" = now()
WHERE ("contact_name" IS NOT NULL OR "contact_value" IS NOT NULL)
	AND ("retention_until" IS NULL OR "retention_until" < current_date);
--> statement-breakpoint
ALTER TABLE "customer_feedback" ADD CONSTRAINT "customer_feedback_contact_retention_check"
CHECK (
	("contact_name" IS NULL AND "contact_value" IS NULL)
	OR ("contact_consent" = true AND "retention_until" IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX "customer_feedback_retention_idx" ON "customer_feedback" USING btree ("retention_until")
WHERE "contact_name" IS NOT NULL OR "contact_value" IS NOT NULL;
--> statement-breakpoint
CREATE FUNCTION public.redact_expired_customer_feedback_contacts()
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SET search_path = pg_catalog, public
AS $$
DECLARE
	redacted_count integer;
BEGIN
	UPDATE public.customer_feedback
	SET
		contact_name = NULL,
		contact_value = NULL,
		contact_consent = false,
		contact_redacted_at = coalesce(contact_redacted_at, now())
	WHERE retention_until < current_date
		AND (contact_name IS NOT NULL OR contact_value IS NOT NULL);

	GET DIAGNOSTICS redacted_count = ROW_COUNT;
	RETURN redacted_count;
END;
$$;
