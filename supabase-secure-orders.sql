-- =====================================================================
-- TableServe — Secure Order Placement Migration
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- =====================================================================
-- This migration:
--   1. Creates a server-side function that validates items, looks up
--      real prices from the menu table, and calculates tax/total.
--   2. Revokes direct anonymous INSERT on orders (forces use of RPC).
-- =====================================================================

-- ── 1. Secure order placement function ────────────────────────────────
CREATE OR REPLACE FUNCTION place_order_secure(
  p_table_no      TEXT,
  p_customer_name TEXT DEFAULT '',
  p_items         JSONB DEFAULT '[]',
  p_note          TEXT DEFAULT '',
  p_instructions  TEXT DEFAULT ''
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER          -- runs with table-owner privileges, bypasses RLS
SET search_path = public  -- prevent search_path injection
AS $$
DECLARE
  v_order_id    TEXT;
  v_subtotal    NUMERIC(10,2) := 0;
  v_tax         NUMERIC(10,2) := 0;
  v_tax_pct     NUMERIC(5,2);
  v_item        JSONB;
  v_qty         INT;
  v_menu_row    RECORD;
  v_order_items JSONB := '[]'::JSONB;
  v_chars       TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_id_part     TEXT := '';
  v_i           INT;
BEGIN
  -- ── Validate inputs ─────────────────────────────────────────────────
  IF p_table_no IS NULL OR TRIM(p_table_no) = '' THEN
    RAISE EXCEPTION 'table_no is required';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order must contain at least one item';
  END IF;

  IF jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'Order cannot contain more than 50 items';
  END IF;

  -- ── Generate 6-char order ID (same charset as original) ─────────────
  FOR v_i IN 1..6 LOOP
    v_id_part := v_id_part || substr(v_chars, floor(random() * length(v_chars))::INT + 1, 1);
  END LOOP;
  v_order_id := v_id_part;

  -- ── Get tax percentage from config ──────────────────────────────────
  SELECT COALESCE(tax_percentage, 8) INTO v_tax_pct FROM config WHERE id = 1;
  IF v_tax_pct IS NULL THEN
    v_tax_pct := 8;
  END IF;

  -- ── Validate each item & compute subtotal ───────────────────────────
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Validate qty
    v_qty := (v_item ->> 'qty')::INT;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Invalid quantity for item: %', v_item ->> 'menu_item_id';
    END IF;
    IF v_qty > 99 THEN
      RAISE EXCEPTION 'Quantity too large for item: %', v_item ->> 'menu_item_id';
    END IF;

    -- Look up real price from menu table
    SELECT id, name, price, available
      INTO v_menu_row
      FROM menu
     WHERE id = (v_item ->> 'menu_item_id')::UUID;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Menu item not found: %', v_item ->> 'menu_item_id';
    END IF;

    IF v_menu_row.available = false THEN
      RAISE EXCEPTION 'Item is currently unavailable: %', v_menu_row.name;
    END IF;

    -- Accumulate subtotal using SERVER-SIDE price
    v_subtotal := v_subtotal + (v_menu_row.price * v_qty);

    -- Build order items array with trusted data
    v_order_items := v_order_items || jsonb_build_array(
      jsonb_build_object(
        'name',  v_menu_row.name,
        'price', v_menu_row.price,
        'qty',   v_qty
      )
    );
  END LOOP;

  -- ── Calculate tax & total on server ─────────────────────────────────
  v_tax := ROUND(v_subtotal * (v_tax_pct / 100.0), 2);

  -- Note: 'total' column stores the SUBTOTAL (pre-tax) for backward compatibility
  -- with the existing UI which computes grand = total + tax

  -- ── Insert the order ────────────────────────────────────────────────
  INSERT INTO orders (
    order_id, table_no, customer_name,
    items, total, tax,
    note, instructions, status
  ) VALUES (
    v_order_id,
    TRIM(p_table_no),
    TRIM(COALESCE(p_customer_name, '')),
    v_order_items,
    v_subtotal,        -- stored as 'total' (= subtotal, matching existing schema usage)
    v_tax,
    TRIM(COALESCE(p_note, '')),
    TRIM(COALESCE(p_instructions, '')),
    'pending'
  );

  RETURN v_order_id;
END;
$$;

-- ── 2. Grant execute permission to anonymous & authenticated users ────
GRANT EXECUTE ON FUNCTION place_order_secure(TEXT, TEXT, JSONB, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION place_order_secure(TEXT, TEXT, JSONB, TEXT, TEXT) TO authenticated;

-- ── 3. Revoke direct INSERT on orders from anonymous users ────────────
-- Orders can now only be placed through the secure RPC function.
-- Authenticated users (admin) can still insert directly if needed.
DROP POLICY IF EXISTS "orders_public_insert" ON orders;

-- ── Done! ─────────────────────────────────────────────────────────────
-- Test: SELECT place_order_secure('1', 'Test User', '[{"menu_item_id": "<uuid>", "qty": 2}]'::jsonb, 'No onions', '');
