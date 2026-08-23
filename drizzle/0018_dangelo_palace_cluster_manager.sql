-- The D'Angelo Palace manager is the one person responsible for both Palace
-- stores. Keep D'Angelo Palace as the account's primary store, and grant that
-- same account access to Carbon Shoes Palace through user_stores.
--
-- D'Angelo Stanbic (store code "d") is deliberately excluded.
DO $$
DECLARE
	manager_user_id integer;
	manager_count integer;
	palace_store_count integer;
BEGIN
	SELECT count(*)::integer, min("id")
	INTO manager_count, manager_user_id
	FROM "users"
	WHERE "role" = 'store-manager'
		AND "active" = true
		AND lower(coalesce("store", '')) = 'dangelo';

	IF manager_count <> 1 THEN
		RAISE EXCEPTION 'Expected exactly one active D''Angelo Palace store-manager account, found %', manager_count;
	END IF;

	SELECT count(*)::integer
	INTO palace_store_count
	FROM "stores"
	WHERE lower("code") IN ('dangelo', 'c')
		AND "type" = 'store'
		AND "active" = true;

	IF palace_store_count <> 2 THEN
		RAISE EXCEPTION 'Expected active Palace stores with codes dangelo and c, found %', palace_store_count;
	END IF;

	INSERT INTO "user_stores" ("user_id", "store_id")
	SELECT manager_user_id, "id"
	FROM "stores"
	WHERE lower("code") IN ('dangelo', 'c')
		AND "type" = 'store'
		AND "active" = true
	ON CONFLICT DO NOTHING;
END $$;
