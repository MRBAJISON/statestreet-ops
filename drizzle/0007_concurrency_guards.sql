CREATE FUNCTION public.expense_budget_position(
	p_business_date date,
	p_expense_category_id bigint,
	p_store_id bigint
)
RETURNS TABLE (budget numeric, actual numeric)
LANGUAGE plpgsql
VOLATILE
SET search_path = pg_catalog, public
AS $$
BEGIN
	PERFORM pg_advisory_xact_lock(
		hashtextextended(
			concat_ws(
				':',
				'statestreet-expense-budget',
				extract(year from p_business_date)::integer::text,
				p_expense_category_id::text,
				coalesce(p_store_id::text, 'group')
			),
			0
		)
	);

	RETURN QUERY
	SELECT
		coalesce((
			SELECT sum(entry.amount)
			FROM public.budgets entry
			WHERE entry.year = extract(year from p_business_date)::integer
				AND entry.expense_category_id = p_expense_category_id
				AND entry.store_id IS NOT DISTINCT FROM p_store_id
		), 0),
		coalesce((
			SELECT sum(entry.amount)
			FROM public.expenses entry
			WHERE extract(year from entry.business_date) = extract(year from p_business_date)
				AND entry.expense_category_id = p_expense_category_id
				AND entry.store_id IS NOT DISTINCT FROM p_store_id
		), 0);
END;
$$;
--> statement-breakpoint
CREATE FUNCTION public.inventory_store_balances(
	p_store_id bigint,
	p_product_ids bigint[]
)
RETURNS TABLE (product_id bigint, available bigint)
LANGUAGE plpgsql
VOLATILE
SET search_path = pg_catalog, public
AS $$
BEGIN
	PERFORM pg_advisory_xact_lock(
		hashtextextended(concat_ws(':', 'statestreet-inventory-store', p_store_id::text), 0)
	);

	RETURN QUERY
	SELECT requested.id,
		coalesce(sum(movement.quantity), 0)::bigint
	FROM unnest(p_product_ids) requested(id)
	LEFT JOIN public.inventory_movements movement
		ON movement.product_id = requested.id
		AND movement.store_id = p_store_id
		AND movement.business_date <= current_date
	GROUP BY requested.id;
END;
$$;
