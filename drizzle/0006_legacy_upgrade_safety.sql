WITH latest_legacy_settings AS (
	SELECT payload, created_at
	FROM entries
	WHERE department = 'admin' AND form_type = 'org-settings'
	ORDER BY created_at DESC, id DESC
	LIMIT 1
)
UPDATE organization_settings settings
SET company_name = CASE
		WHEN jsonb_typeof(legacy.payload -> 'companyName') = 'string'
			AND btrim(legacy.payload ->> 'companyName') <> ''
			THEN legacy.payload ->> 'companyName'
		ELSE settings.company_name
	END,
	tagline = CASE
		WHEN jsonb_typeof(legacy.payload -> 'tagline') = 'string' THEN legacy.payload ->> 'tagline'
		ELSE settings.tagline
	END,
	currency = CASE
		WHEN jsonb_typeof(legacy.payload -> 'currency') = 'string'
			AND btrim(legacy.payload ->> 'currency') <> ''
			THEN legacy.payload ->> 'currency'
		ELSE settings.currency
	END,
	logo = CASE
		WHEN jsonb_typeof(legacy.payload -> 'logo') = 'string' THEN legacy.payload ->> 'logo'
		ELSE settings.logo
	END,
	week_start = CASE
		WHEN legacy.payload ->> 'weekStart' IN ('monday', 'sunday') THEN legacy.payload ->> 'weekStart'
		ELSE settings.week_start
	END,
	minimum_password_length = CASE
		WHEN legacy.payload #>> '{security,minPasswordLen}' ~ '^\d+$'
			AND (legacy.payload #>> '{security,minPasswordLen}')::integer BETWEEN 8 AND 128
			THEN (legacy.payload #>> '{security,minPasswordLen}')::integer
		ELSE settings.minimum_password_length
	END,
	session_days = CASE
		WHEN legacy.payload #>> '{security,sessionDays}' ~ '^\d+$'
			AND (legacy.payload #>> '{security,sessionDays}')::integer BETWEEN 1 AND 90
			THEN (legacy.payload #>> '{security,sessionDays}')::integer
		ELSE settings.session_days
	END,
	updated_at = greatest(settings.updated_at, legacy.created_at)
FROM latest_legacy_settings legacy
WHERE settings.id = 1;
--> statement-breakpoint
UPDATE users account
SET department = canonical.department,
	session_version = account.session_version + 1,
	updated_at = now()
FROM (
	VALUES
		('owner', 'executive'),
		('finance', 'finance'),
		('commercial', 'commercial'),
		('marketing', 'marketing'),
		('operations', 'operations'),
		('inventory', 'inventory'),
		('brand', 'brand'),
		('store-manager', 'commercial')
) AS canonical(role, department)
WHERE account.role = canonical.role
	AND account.department IS DISTINCT FROM canonical.department;
