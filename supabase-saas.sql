-- 1. Create Restaurants table
CREATE TABLE IF NOT EXISTS restaurants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Add restaurant_id to existing tables
ALTER TABLE menu ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE;
ALTER TABLE config ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE;

-- Drop single_row constraint on config as it's now per-restaurant
ALTER TABLE config DROP CONSTRAINT IF EXISTS single_row;

-- 3. RLS Helper Functions
CREATE OR REPLACE FUNCTION auth_role() RETURNS TEXT AS $$
  SELECT auth.jwt() -> 'user_metadata' ->> 'role';
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION auth_restaurant_id() RETURNS UUID AS $$
  SELECT (auth.jwt() -> 'user_metadata' ->> 'restaurant_id')::UUID;
$$ LANGUAGE sql STABLE;

-- 4. Enable RLS on Restaurants
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read restaurants" ON restaurants FOR SELECT USING (true);
CREATE POLICY "Super admin all restaurants" ON restaurants FOR ALL USING (auth_role() = 'super_admin');

-- 5. Update RLS on Menu
DROP POLICY IF EXISTS "menu_public_read" ON menu;
DROP POLICY IF EXISTS "menu_auth_write" ON menu;

CREATE POLICY "Public read menu" ON menu FOR SELECT USING (true);
CREATE POLICY "Super admin all menu" ON menu FOR ALL USING (auth_role() = 'super_admin');
CREATE POLICY "Admin write own menu" ON menu FOR ALL USING (
  auth_role() = 'admin' AND restaurant_id = auth_restaurant_id()
);

-- 6. Update RLS on Orders
DROP POLICY IF EXISTS "orders_public_insert" ON orders;
DROP POLICY IF EXISTS "orders_public_select" ON orders;
DROP POLICY IF EXISTS "orders_auth_update" ON orders;
DROP POLICY IF EXISTS "orders_auth_delete" ON orders;

CREATE POLICY "Public insert orders" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Super admin all orders" ON orders FOR ALL USING (auth_role() = 'super_admin');
CREATE POLICY "Admin and waiter read own orders" ON orders FOR SELECT USING (
  restaurant_id = auth_restaurant_id()
);
CREATE POLICY "Admin and waiter update own orders" ON orders FOR UPDATE USING (
  auth_role() IN ('admin', 'waiter') AND restaurant_id = auth_restaurant_id()
);
CREATE POLICY "Admin delete own orders" ON orders FOR DELETE USING (
  auth_role() = 'admin' AND restaurant_id = auth_restaurant_id()
);

-- 7. Update secure RPC for placing orders
CREATE OR REPLACE FUNCTION place_order_secure(
  p_restaurant_id UUID,
  p_table_no      TEXT,
  p_customer_name TEXT DEFAULT '',
  p_items         JSONB DEFAULT '[]',
  p_note          TEXT DEFAULT '',
  p_instructions  TEXT DEFAULT ''
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  -- Validate inputs
  IF p_restaurant_id IS NULL THEN RAISE EXCEPTION 'restaurant_id is required'; END IF;
  IF p_table_no IS NULL OR TRIM(p_table_no) = '' THEN RAISE EXCEPTION 'table_no is required'; END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Order must contain at least one item'; END IF;

  -- Generate ID
  FOR v_i IN 1..6 LOOP
    v_id_part := v_id_part || substr(v_chars, floor(random() * length(v_chars))::INT + 1, 1);
  END LOOP;
  v_order_id := v_id_part;

  -- Get tax percentage
  SELECT COALESCE(tax_percentage, 8) INTO v_tax_pct FROM config WHERE restaurant_id = p_restaurant_id LIMIT 1;
  IF v_tax_pct IS NULL THEN v_tax_pct := 8; END IF;

  -- Validate items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (v_item ->> 'qty')::INT;
    SELECT id, name, price, available INTO v_menu_row FROM menu WHERE id = (v_item ->> 'menu_item_id')::UUID AND restaurant_id = p_restaurant_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Menu item not found'; END IF;
    IF v_menu_row.available = false THEN RAISE EXCEPTION 'Item unavailable'; END IF;

    v_subtotal := v_subtotal + (v_menu_row.price * v_qty);
    v_order_items := v_order_items || jsonb_build_array(jsonb_build_object('name', v_menu_row.name, 'price', v_menu_row.price, 'qty', v_qty));
  END LOOP;

  v_tax := ROUND(v_subtotal * (v_tax_pct / 100.0), 2);

  INSERT INTO orders (order_id, restaurant_id, table_no, customer_name, items, total, tax, note, instructions, status)
  VALUES (v_order_id, p_restaurant_id, TRIM(p_table_no), TRIM(COALESCE(p_customer_name, '')), v_order_items, v_subtotal, v_tax, TRIM(COALESCE(p_note, '')), TRIM(COALESCE(p_instructions, '')), 'pending');

  RETURN v_order_id;
END;
$$;
