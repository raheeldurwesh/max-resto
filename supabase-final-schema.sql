-- ============================================================================
-- FINAL RESTAURANT MANAGEMENT SCHEMA FIX
-- ============================================================================

-- 1. UTILITY FUNCTIONS
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_slug(name TEXT)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  new_slug TEXT;
  counter INT := 1;
BEGIN
  -- Basic string normalization to slug
  base_slug := lower(regexp_replace(regexp_replace(name, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'));
  new_slug := base_slug;
  WHILE EXISTS (SELECT 1 FROM restaurants WHERE slug = new_slug) LOOP
    new_slug := base_slug || '-' || counter;
    counter := counter + 1;
  END LOOP;
  RETURN new_slug;
END;
$$ LANGUAGE plpgsql;

-- 2. RESTAURANTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS restaurants (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL,
    slug       TEXT UNIQUE NOT NULL,
    owner_id   UUID, -- Will be set via trigger
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger to auto-generate slug and set owner_id
CREATE OR REPLACE FUNCTION handle_new_restaurant()
RETURNS trigger AS $$
BEGIN
  IF NEW.slug IS NULL OR TRIM(NEW.slug) = '' THEN
    NEW.slug := generate_slug(NEW.name);
  END IF;
  IF NEW.owner_id IS NULL THEN
    NEW.owner_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS before_insert_restaurant ON restaurants;
CREATE TRIGGER before_insert_restaurant
  BEFORE INSERT ON restaurants
  FOR EACH ROW EXECUTE PROCEDURE handle_new_restaurant();

-- 3. PROFILES TABLE (Syncs with auth.users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS profiles (
    id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email         TEXT,
    role          TEXT DEFAULT 'customer',
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ DEFAULT now()
);

-- Backfill profile table with existing users to safely retain admin/waiter accounts
INSERT INTO public.profiles (id, email, role, restaurant_id)
SELECT 
    id, 
    email, 
    COALESCE(raw_user_meta_data->>'role', 'customer'), 
    NULLIF(raw_user_meta_data->>'restaurant_id', '')::uuid
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Trigger to auto-create profile on auth.users insert
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, restaurant_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer'),
    NULLIF(NEW.raw_user_meta_data->>'restaurant_id', '')::uuid
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- Trigger to keep profile synced if metadata changes (optional but good)
CREATE OR REPLACE FUNCTION handle_user_update()
RETURNS trigger AS $$
BEGIN
  UPDATE public.profiles SET
    role = COALESCE(NEW.raw_user_meta_data->>'role', role),
    restaurant_id = COALESCE(NULLIF(NEW.raw_user_meta_data->>'restaurant_id', '')::uuid, restaurant_id)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_user_update();

-- 4. DOMAIN TABLES
-- ============================================================================
-- NOTE: If these tables already existed before SaaS adoption, we must force the column addition
-- because CREATE TABLE IF NOT EXISTS ignores schema updates on pre-existing tables.

CREATE TABLE IF NOT EXISTS menu (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL,
    description   TEXT,
    price         NUMERIC(10,2) NOT NULL,
    category      TEXT,
    foodType      TEXT,
    available     BOOLEAN DEFAULT true,
    created_at    TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE menu ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE;


CREATE TABLE IF NOT EXISTS config (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_name TEXT,
    tax_percentage NUMERIC(5,2) DEFAULT 8.0,
    total_tables   INT DEFAULT 20,
    created_at     TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE config ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE;
-- Ensure uniqueness manually in case it already existed
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'config_restaurant_id_key') THEN
        ALTER TABLE config ADD CONSTRAINT config_restaurant_id_key UNIQUE (restaurant_id);
    END IF;
END $$;


CREATE TABLE IF NOT EXISTS orders (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id      TEXT NOT NULL,
    table_no      TEXT NOT NULL,
    customer_name TEXT,
    total         NUMERIC(10,2) DEFAULT 0,
    tax           NUMERIC(10,2) DEFAULT 0,
    note          TEXT,
    instructions  TEXT,
    status        TEXT DEFAULT 'pending',
    items         JSONB DEFAULT '[]', -- Kept for dual-write backward compatibility if needed natively
    created_at    TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE;

-- The newly requested order_items table for normalized relational data
CREATE TABLE IF NOT EXISTS order_items (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id      UUID REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id  UUID REFERENCES menu(id) ON DELETE SET NULL,
    name          TEXT, -- snapshot of name
    price         NUMERIC(10,2), -- snapshot of price
    qty           INT NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT now()
);

-- 5. RLS HELPER FUNCTIONS
-- ============================================================================
DROP FUNCTION IF EXISTS auth_role() CASCADE;
CREATE OR REPLACE FUNCTION auth_role() RETURNS TEXT AS $$
  SELECT role::TEXT FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE;

DROP FUNCTION IF EXISTS auth_restaurant_id() CASCADE;
CREATE OR REPLACE FUNCTION auth_restaurant_id() RETURNS UUID AS $$
  SELECT restaurant_id::UUID FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE;


-- 6. RLS POLICIES
-- ============================================================================

-- RESTAURANTS
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read restaurants" ON restaurants;
DROP POLICY IF EXISTS "Owner access restaurants" ON restaurants;
DROP POLICY IF EXISTS "Superadmin access restaurants" ON restaurants;

CREATE POLICY "Public read restaurants" ON restaurants FOR SELECT USING (true);
CREATE POLICY "Owner access restaurants" ON restaurants FOR ALL USING (owner_id = auth.uid());
CREATE POLICY "Superadmin access restaurants" ON restaurants FOR ALL USING (auth_role() = 'super_admin');


-- PROFILES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can read restaurant profiles" ON profiles;

CREATE POLICY "Users can read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can read restaurant profiles" ON profiles FOR SELECT USING (
  auth_role() IN ('admin', 'super_admin') AND (restaurant_id = auth_restaurant_id() OR auth_role() = 'super_admin')
);


-- MENU
ALTER TABLE menu ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read menu" ON menu;
DROP POLICY IF EXISTS "Admin write own menu" ON menu;
DROP POLICY IF EXISTS "Superadmin access menu" ON menu;

CREATE POLICY "Public read menu" ON menu FOR SELECT USING (true);
CREATE POLICY "Admin write own menu" ON menu FOR ALL USING (auth_role() = 'admin' AND restaurant_id = auth_restaurant_id());
CREATE POLICY "Superadmin access menu" ON menu FOR ALL USING (auth_role() = 'super_admin');


-- CONFIG
ALTER TABLE config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read config" ON config;
DROP POLICY IF EXISTS "Admin write own config" ON config;
DROP POLICY IF EXISTS "Superadmin access config" ON config;

CREATE POLICY "Public read config" ON config FOR SELECT USING (true);
CREATE POLICY "Admin write own config" ON config FOR ALL USING (auth_role() = 'admin' AND restaurant_id = auth_restaurant_id());
CREATE POLICY "Superadmin access config" ON config FOR ALL USING (auth_role() = 'super_admin');


-- ORDERS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
-- order_items
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Note for INSERT: Because Customer is not authenticated typically to place an order,
-- INSERTs need to be open to everyone (Public).
-- To prevent abuse, they should be done via `place_order_secure` RPC.
-- But we allow Public INSERT if they bypass RPC.
DROP POLICY IF EXISTS "Public insert orders" ON orders;
DROP POLICY IF EXISTS "Read orders" ON orders;
DROP POLICY IF EXISTS "Update orders" ON orders;
DROP POLICY IF EXISTS "Delete orders" ON orders;

CREATE POLICY "Public insert orders" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Read orders" ON orders FOR SELECT USING (
  (auth_role() IN ('admin', 'waiter') AND restaurant_id = auth_restaurant_id()) OR auth_role() = 'super_admin'
);
CREATE POLICY "Update orders" ON orders FOR UPDATE USING (
  (auth_role() IN ('admin', 'waiter') AND restaurant_id = auth_restaurant_id()) OR auth_role() = 'super_admin'
);
CREATE POLICY "Delete orders" ON orders FOR DELETE USING (
  (auth_role() = 'admin' AND restaurant_id = auth_restaurant_id()) OR auth_role() = 'super_admin'
);

-- order_items RLS
DROP POLICY IF EXISTS "Public insert order_items" ON order_items;
DROP POLICY IF EXISTS "Read order_items" ON order_items;
DROP POLICY IF EXISTS "Update order_items" ON order_items;

CREATE POLICY "Public insert order_items" ON order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Read order_items" ON order_items FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND (
      (auth_role() IN ('admin', 'waiter') AND orders.restaurant_id = auth_restaurant_id()) OR auth_role() = 'super_admin'
    )
  )
);
CREATE POLICY "Update order_items" ON order_items FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND (
      (auth_role() IN ('admin', 'waiter') AND orders.restaurant_id = auth_restaurant_id()) OR auth_role() = 'super_admin'
    )
  )
);


-- 7. UPDATED PLACE_ORDER_SECURE RPC
-- ============================================================================
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
  v_db_order_id UUID;
  v_short_id    TEXT;
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
  IF p_restaurant_id IS NULL THEN RAISE EXCEPTION 'restaurant_id is required'; END IF;
  IF p_table_no IS NULL OR TRIM(p_table_no) = '' THEN RAISE EXCEPTION 'table_no is required'; END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Order must contain at least one item'; END IF;

  IF NOT EXISTS (SELECT 1 FROM restaurants WHERE id = p_restaurant_id) THEN
    RAISE EXCEPTION 'Restaurant not found';
  END IF;

  FOR v_i IN 1..6 LOOP
    v_id_part := v_id_part || substr(v_chars, floor(random() * length(v_chars))::INT + 1, 1);
  END LOOP;
  v_short_id := v_id_part;

  SELECT COALESCE(tax_percentage, 8) INTO v_tax_pct
    FROM config WHERE restaurant_id = p_restaurant_id LIMIT 1;
  IF v_tax_pct IS NULL THEN v_tax_pct := 8; END IF;

  -- 1. Validate items and accumulate total
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (v_item ->> 'qty')::INT;
    SELECT id, name, price, available INTO v_menu_row
      FROM menu WHERE id = (v_item ->> 'menu_item_id')::UUID AND restaurant_id = p_restaurant_id;

    IF NOT FOUND THEN RAISE EXCEPTION 'Menu item not found'; END IF;
    IF v_menu_row.available = false THEN RAISE EXCEPTION 'Item unavailable'; END IF;

    v_subtotal := v_subtotal + (v_menu_row.price * v_qty);
    
    -- Legacy items array structure for backward compat
    v_order_items := v_order_items || jsonb_build_array(
      jsonb_build_object('name', v_menu_row.name, 'price', v_menu_row.price, 'qty', v_qty)
    );
  END LOOP;

  v_tax := ROUND(v_subtotal * (v_tax_pct / 100.0), 2);

  -- 2. Insert into orders table
  INSERT INTO orders (order_id, restaurant_id, table_no, customer_name, items, total, tax, note, instructions, status)
  VALUES (v_short_id, p_restaurant_id, TRIM(p_table_no), TRIM(COALESCE(p_customer_name, '')),
          v_order_items, v_subtotal, v_tax, TRIM(COALESCE(p_note, '')),
          TRIM(COALESCE(p_instructions, '')), 'pending')
  RETURNING id INTO v_db_order_id;

  -- 3. Insert into order_items table (Normalization requested by user)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (v_item ->> 'qty')::INT;
    SELECT id, name, price INTO v_menu_row
      FROM menu WHERE id = (v_item ->> 'menu_item_id')::UUID;
      
    INSERT INTO order_items (order_id, menu_item_id, name, price, qty)
    VALUES (v_db_order_id, v_menu_row.id, v_menu_row.name, v_menu_row.price, v_qty);
  END LOOP;

  RETURN v_short_id;
END;
$$;

-- 8. INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_profiles_restaurant_id ON profiles(restaurant_id);
