-- Schema only. Opening-stock allocation is a separately reviewed, idempotent step.
CREATE TABLE stock_history_baselines (
  store_id bigint NOT NULL REFERENCES stores(id), product_id bigint NOT NULL REFERENCES products(id),
  as_of_date date NOT NULL, quantity integer NOT NULL CHECK (quantity >= 0),
  lots jsonb NOT NULL DEFAULT '[]', assigned_receipt_date date NOT NULL DEFAULT '2026-07-01',
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(store_id, product_id)
);
CREATE TABLE stock_history_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_key text NOT NULL UNIQUE, store_id bigint NOT NULL REFERENCES stores(id),
  product_id bigint NOT NULL REFERENCES products(id), business_date date NOT NULL,
  quantity integer NOT NULL, requested_quantity integer NOT NULL, kind text NOT NULL,
  receipt_date date, transfer_key text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stock_history_scope_date_idx ON stock_history_events(store_id, product_id, business_date, id);
CREATE TABLE daily_report_stock_settlements (
  daily_report_id bigint NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
  product_id bigint NOT NULL REFERENCES products(id), units integer NOT NULL,
  applied_units integer NOT NULL DEFAULT 0,
  PRIMARY KEY(daily_report_id, product_id)
);
--> statement-breakpoint
-- Central serialized, idempotent stock posting. The requested delta is retained
-- when an inaccurate opening balance causes a shortfall; the report must flag it.
CREATE FUNCTION post_stock_history(p_key text, p_store bigint, p_product bigint, p_date date,
  p_quantity integer, p_kind text, p_receipt date DEFAULT NULL, p_transfer text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE balance integer; actual integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('stock:' || p_store || ':' || p_product, 0));
  IF EXISTS (SELECT 1 FROM stock_history_events WHERE source_key = p_key) THEN RETURN; END IF;
  SELECT quantity INTO balance FROM store_stock_levels WHERE store_id=p_store AND product_id=p_product FOR UPDATE;
  balance := coalesce(balance, 0);
  -- Existing stock requires the reviewed opening allocation before mutations.
  IF NOT EXISTS (SELECT 1 FROM stock_history_baselines WHERE store_id=p_store AND product_id=p_product) THEN
    IF balance > 0 THEN RAISE EXCEPTION 'Opening stock history has not been initialized' USING ERRCODE='P0001'; END IF;
    INSERT INTO stock_history_baselines(store_id, product_id, as_of_date, quantity)
      VALUES(p_store, p_product, least(current_date, p_date), 0);
  END IF;
  actual := greatest(balance + p_quantity, 0) - balance;
  INSERT INTO stock_history_events(source_key, store_id, product_id, business_date, quantity, requested_quantity, kind, receipt_date, transfer_key)
    VALUES(p_key, p_store, p_product, p_date, actual, p_quantity, p_kind, p_receipt, p_transfer);
  PERFORM set_config('statestreet.stock_posting', 'on', true);
  INSERT INTO store_stock_levels(store_id, product_id, quantity, as_of_date)
    VALUES(p_store, p_product, balance+actual, p_date)
    ON CONFLICT(store_id, product_id) DO UPDATE SET quantity=excluded.quantity, as_of_date=excluded.as_of_date, updated_at=now();
  PERFORM set_config('statestreet.stock_posting', 'off', true);
END $$;
--> statement-breakpoint
-- Direct balance changes are catalog imports/count corrections, not new receipts.
CREATE FUNCTION capture_stock_balance_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior integer; delta integer;
BEGIN
  IF current_setting('statestreet.stock_posting', true) = 'on' THEN RETURN NEW; END IF;
  prior := CASE WHEN TG_OP='INSERT' THEN 0 ELSE OLD.quantity END;
  delta := NEW.quantity-prior;
  IF delta=0 THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM stock_history_baselines WHERE store_id=NEW.store_id AND product_id=NEW.product_id) THEN
    IF prior>0 THEN RAISE EXCEPTION 'Opening stock history has not been initialized'; END IF;
    INSERT INTO stock_history_baselines(store_id,product_id,as_of_date,quantity) VALUES(NEW.store_id,NEW.product_id,least(current_date,NEW.as_of_date),0);
  END IF;
  INSERT INTO stock_history_events(source_key,store_id,product_id,business_date,quantity,requested_quantity,kind)
    VALUES('balance:' || NEW.id || ':' || txid_current() || ':' || gen_random_uuid(),NEW.store_id,NEW.product_id,NEW.as_of_date,delta,delta,'balance-adjustment');
  RETURN NEW;
END $$;
CREATE TRIGGER capture_stock_balance AFTER INSERT OR UPDATE OF quantity ON store_stock_levels
FOR EACH ROW EXECUTE FUNCTION capture_stock_balance_change();
--> statement-breakpoint
CREATE FUNCTION capture_inventory_stock() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM post_stock_history('movement:' || NEW.id, NEW.store_id, NEW.product_id, NEW.business_date,
    NEW.quantity, NEW.movement_type,
    CASE WHEN NEW.movement_type='receipt' THEN NEW.business_date ELSE NULL END,
    CASE WHEN NEW.source_type='stock-transfer' THEN NEW.source_type || ':' || NEW.source_id ELSE NULL END);
  RETURN NEW;
END $$;
CREATE TRIGGER capture_inventory_stock AFTER INSERT ON inventory_movements FOR EACH ROW EXECUTE FUNCTION capture_inventory_stock();
--> statement-breakpoint
CREATE FUNCTION settle_daily_report_history() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE report daily_reports%ROWTYPE; item record; change integer; actual_change integer; event_key text;
BEGIN
  SELECT * INTO report FROM daily_reports WHERE id=NEW.id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF report.status<>'draft' AND NOT EXISTS(SELECT 1 FROM daily_report_stock_settlements WHERE daily_report_id=report.id) THEN
    UPDATE daily_sales_lines line SET opening_stock=stock.quantity
    FROM (SELECT product.category_id,sum(baseline.quantity+coalesce(prior.delta,0))::integer AS quantity
      FROM store_stock_levels level JOIN products product ON product.id=level.product_id
      LEFT JOIN stock_history_baselines baseline ON baseline.store_id=level.store_id AND baseline.product_id=level.product_id
      LEFT JOIN LATERAL (SELECT sum(event.quantity) AS delta FROM stock_history_events event
        WHERE event.store_id=level.store_id AND event.product_id=level.product_id
          AND event.business_date<report.business_date) prior ON true
      WHERE level.store_id=report.store_id GROUP BY product.category_id
      HAVING bool_and(baseline.as_of_date<report.business_date)) stock
    WHERE line.daily_report_id=report.id AND line.category_id=stock.category_id AND line.opening_stock=0;
  END IF;
  FOR item IN
    SELECT coalesce(sold.product_id, posted.product_id) AS product_id,
      CASE WHEN report.status='draft' THEN 0 ELSE coalesce(sold.units,0) END::integer AS target_units,
      coalesce(posted.units,0)::integer AS posted_units,coalesce(posted.applied_units,0)::integer AS applied_units
    FROM (SELECT product_id,sum(units)::integer AS units FROM daily_report_products
      WHERE daily_report_id=report.id AND product_id IS NOT NULL GROUP BY product_id) sold
    FULL JOIN (SELECT product_id,units,applied_units FROM daily_report_stock_settlements WHERE daily_report_id=report.id) posted USING(product_id)
    ORDER BY product_id
  LOOP
    change := CASE WHEN item.target_units>=item.posted_units THEN item.posted_units-item.target_units ELSE greatest(item.applied_units-item.target_units,0) END;
    actual_change := 0;
    event_key := 'daily:' || report.id || ':' || report.lock_version || ':' || item.product_id;
    IF change<>0 THEN
      PERFORM post_stock_history(event_key,
        report.store_id,item.product_id,report.business_date,change,'daily-sale');
      SELECT quantity INTO actual_change FROM stock_history_events WHERE source_key=event_key;
    END IF;
    INSERT INTO daily_report_stock_settlements(daily_report_id,product_id,units,applied_units) VALUES(report.id,item.product_id,item.target_units,item.applied_units-coalesce(actual_change,0))
      ON CONFLICT(daily_report_id,product_id) DO UPDATE SET units=excluded.units,applied_units=excluded.applied_units;
  END LOOP;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER settle_daily_report_history AFTER INSERT OR UPDATE ON daily_reports
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION settle_daily_report_history();
--> statement-breakpoint
CREATE FUNCTION capture_credit_sale_stock() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sale customer_credit_sales%ROWTYPE;
BEGIN
  IF NEW.product_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO sale FROM customer_credit_sales WHERE id=NEW.credit_sale_id;
  PERFORM post_stock_history('credit-sale:' || NEW.id,sale.store_id,NEW.product_id,sale.business_date,-NEW.quantity,'credit-sale');
  RETURN NEW;
END $$;
CREATE TRIGGER capture_credit_sale_stock AFTER INSERT ON customer_credit_sale_items FOR EACH ROW EXECUTE FUNCTION capture_credit_sale_stock();
CREATE FUNCTION capture_collected_deposit_stock() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE item record;
BEGIN
  IF NEW.status<>'collected' OR OLD.status='collected' THEN RETURN NEW; END IF;
  FOR item IN SELECT * FROM customer_deposit_items WHERE deposit_id=NEW.id ORDER BY product_id LOOP
    PERFORM post_stock_history('deposit-collection:' || item.id,NEW.store_id,item.product_id,NEW.collected_at::date,-item.quantity,'deposit-collection');
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER capture_collected_deposit_stock AFTER UPDATE OF status ON customer_deposits FOR EACH ROW EXECUTE FUNCTION capture_collected_deposit_stock();
CREATE FUNCTION capture_replacement_stock() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.replacement_product_id IS NOT NULL THEN
    PERFORM post_stock_history('credit-replacement:' || NEW.id,NEW.store_id,NEW.replacement_product_id,NEW.business_date,-1,'credit-replacement');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER capture_replacement_stock AFTER INSERT ON customer_credit_note_redemptions FOR EACH ROW EXECUTE FUNCTION capture_replacement_stock();
--> statement-breakpoint
CREATE TABLE monthly_reviews (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  store_id bigint REFERENCES stores(id), group_id bigint REFERENCES store_groups(id),
  month date NOT NULL CHECK (extract(day FROM month)=1),
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted')),
  executive_summary text NOT NULL DEFAULT '', generated_summary text NOT NULL DEFAULT '',
  source_hash text, source_references jsonb NOT NULL DEFAULT '[]',
  confirmed_at timestamptz, management_outcomes text NOT NULL DEFAULT '',
  operational_assessment text NOT NULL DEFAULT '', conclusion text NOT NULL DEFAULT '',
  store_comments jsonb NOT NULL DEFAULT '{}', lock_version integer NOT NULL DEFAULT 1,
  created_by_user_id integer NOT NULL REFERENCES users(id), updated_by_user_id integer NOT NULL REFERENCES users(id),
  submitted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((store_id IS NOT NULL)::integer + (group_id IS NOT NULL)::integer = 1),
  UNIQUE(store_id,month), UNIQUE(group_id,month)
);
CREATE TABLE monthly_review_advisors (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, monthly_review_id bigint NOT NULL REFERENCES monthly_reviews(id) ON DELETE CASCADE,
  store_id bigint NOT NULL REFERENCES stores(id), name text NOT NULL,
  actual_sales numeric(14,2) NOT NULL CHECK(actual_sales>=0), target numeric(14,2) NOT NULL CHECK(target>=0)
);
CREATE TABLE monthly_review_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), monthly_review_id bigint NOT NULL REFERENCES monthly_reviews(id) ON DELETE RESTRICT,
  store_id bigint REFERENCES stores(id), action text NOT NULL, outcome text NOT NULL, owner_name text NOT NULL,
  due_date date NOT NULL, goal text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','in-progress','completed','cancelled')),
  progress text NOT NULL DEFAULT '', updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX monthly_review_advisors_review_idx ON monthly_review_advisors(monthly_review_id);
CREATE INDEX monthly_review_actions_review_idx ON monthly_review_actions(monthly_review_id);
--> statement-breakpoint
CREATE TABLE monthly_review_action_links (
  monthly_review_id bigint NOT NULL REFERENCES monthly_reviews(id) ON DELETE CASCADE,
  action_id uuid NOT NULL REFERENCES monthly_review_actions(id) ON DELETE RESTRICT,
  PRIMARY KEY (monthly_review_id,action_id)
);
--> statement-breakpoint
-- Transfers/counts must use the same on-hand balance as sales and imports.
-- Lock in product order to share the posting lock and protect reservations.
CREATE OR REPLACE FUNCTION public.inventory_store_balances(p_store_id bigint,p_product_ids bigint[])
RETURNS TABLE(product_id bigint,available bigint) LANGUAGE plpgsql VOLATILE
SET search_path=pg_catalog,public AS $$
DECLARE requested_id bigint;
BEGIN
  FOREACH requested_id IN ARRAY (SELECT array_agg(id ORDER BY id) FROM unnest(p_product_ids) id) LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended('stock:' || p_store_id || ':' || requested_id,0));
  END LOOP;
  RETURN QUERY SELECT requested.id,
    greatest(coalesce(level.quantity,0)-coalesce(reserved.quantity,0),0)::bigint
    FROM unnest(p_product_ids) requested(id)
    LEFT JOIN public.store_stock_levels level ON level.store_id=p_store_id AND level.product_id=requested.id
    LEFT JOIN LATERAL (SELECT sum(reservation.quantity) AS quantity FROM public.store_stock_reservations reservation
      WHERE reservation.store_id=p_store_id AND reservation.product_id=requested.id
        AND reservation.released_at IS NULL AND reservation.fulfilled_at IS NULL) reserved ON true;
END $$;
