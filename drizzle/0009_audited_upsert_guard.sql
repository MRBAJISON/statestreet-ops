CREATE FUNCTION public.lock_audited_upsert(
	p_table regclass,
	p_key jsonb,
	p_values jsonb,
	p_preserve jsonb
)
RETURNS TABLE (id bigint, before_snapshot jsonb, record jsonb)
LANGUAGE plpgsql
VOLATILE
SET search_path = pg_catalog, public
AS $$
DECLARE
	existing_record jsonb;
	assignment_list text;
	value_column_count integer;
BEGIN
	IF p_key IS NULL OR p_key = '{}'::jsonb THEN
		RAISE EXCEPTION 'An audited upsert key is required';
	END IF;
	IF p_values IS NULL OR p_values = '{}'::jsonb THEN
		RAISE EXCEPTION 'Audited upsert values are required';
	END IF;

	PERFORM pg_advisory_xact_lock(
		hashtextextended(
			concat_ws(
				':',
				'statestreet-audited-upsert',
				p_table::oid::text,
				p_key::text
			),
			0
		)
	);

	EXECUTE format(
		'SELECT to_jsonb(target) FROM %s target WHERE to_jsonb(target) @> $1 FOR UPDATE',
		p_table
	) USING p_key INTO existing_record;

	IF existing_record IS NULL THEN
		RETURN;
	END IF;

	SELECT
		count(*),
		string_agg(
			format(
				'%1$I = (jsonb_populate_record(NULL::%2$s, $1)).%1$I',
				attribute.attname,
				p_table
			),
			', ' ORDER BY attribute.attname
		) FILTER (WHERE NOT coalesce(p_preserve, '[]'::jsonb) ? attribute.attname)
	INTO value_column_count, assignment_list
	FROM jsonb_object_keys(p_values) AS value_key(column_name)
	JOIN pg_attribute attribute
		ON attribute.attrelid = p_table
		AND attribute.attname = value_key.column_name
		AND attribute.attnum > 0
		AND NOT attribute.attisdropped;

	IF value_column_count <> (SELECT count(*) FROM jsonb_object_keys(p_values)) THEN
		RAISE EXCEPTION 'Audited upsert contains an unknown column';
	END IF;
	IF assignment_list IS NULL THEN
		RAISE EXCEPTION 'Audited upsert has no mutable columns';
	END IF;

	before_snapshot := existing_record;
	EXECUTE format(
		'UPDATE %s target SET %s WHERE target.id = $2 RETURNING target.id::bigint, to_jsonb(target)',
		p_table,
		assignment_list
	) USING p_values, (existing_record ->> 'id')::bigint INTO id, record;
	RETURN NEXT;
END;
$$;
