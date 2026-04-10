-- ============================================================================
-- ADMIN USER MANAGEMENT RPCs
-- These use SECURITY DEFINER and access auth.users directly
-- Run AFTER supabase-saas-migration.sql
-- ============================================================================

-- 1. CREATE USER (for super_admin to create admin/waiter accounts)
-- ============================================================================
DROP FUNCTION IF EXISTS admin_create_user(TEXT, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS admin_create_user(TEXT, TEXT, UUID, TEXT);

CREATE OR REPLACE FUNCTION admin_create_user(
  p_email         TEXT,
  p_password      TEXT,
  p_role          TEXT,            -- 'admin' or 'waiter'
  p_restaurant_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Only super_admin can create admins; admin can create waiters
  IF auth_role() = 'super_admin' AND p_role IN ('admin', 'waiter') THEN
    -- OK
  ELSIF auth_role() = 'admin' AND p_role = 'waiter' AND p_restaurant_id = auth_restaurant_id() THEN
    -- Admin can only create waiters for own restaurant
  ELSE
    RAISE EXCEPTION 'Unauthorized: cannot create user with role %', p_role;
  END IF;

  -- Validate restaurant exists
  IF NOT EXISTS (SELECT 1 FROM restaurants WHERE id = p_restaurant_id) THEN
    RAISE EXCEPTION 'Restaurant not found';
  END IF;

  -- Insert into auth.users using native Postgres random UUID inline to prevent evaluation nulls
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, raw_user_meta_data,
    raw_app_meta_data, aud, role, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    jsonb_build_object('role', p_role, 'restaurant_id', p_restaurant_id),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    'authenticated',
    'authenticated',
    now(),
    now()
  ) RETURNING id INTO v_user_id;

  -- Create identity record
  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data,
    provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    p_email,
    jsonb_build_object('sub', v_user_id, 'email', p_email),
    'email',
    now(),
    now(),
    now()
  );

  RETURN v_user_id;
END;
$$;

-- 2. RESET PASSWORD
-- ============================================================================
CREATE OR REPLACE FUNCTION admin_reset_password(
  p_user_id  UUID,
  p_password TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_target_role TEXT;
  v_target_rid  UUID;
BEGIN
  -- Get target user info
  SELECT
    raw_user_meta_data ->> 'role',
    (raw_user_meta_data ->> 'restaurant_id')::UUID
  INTO v_target_role, v_target_rid
  FROM auth.users WHERE id = p_user_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;

  -- Authorization check
  IF auth_role() = 'super_admin' THEN
    -- Can reset anyone except other super_admins
    IF v_target_role = 'super_admin' THEN
      RAISE EXCEPTION 'Cannot reset another super admin password';
    END IF;
  ELSIF auth_role() = 'admin' THEN
    -- Can only reset waiters in own restaurant
    IF v_target_role != 'waiter' OR v_target_rid != auth_restaurant_id() THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(p_password, gen_salt('bf')),
      updated_at = now()
  WHERE id = p_user_id;
END;
$$;

-- 3. DISABLE/ENABLE USER (ban)
-- ============================================================================
CREATE OR REPLACE FUNCTION admin_toggle_user(
  p_user_id UUID,
  p_disable BOOLEAN
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_target_role TEXT;
BEGIN
  SELECT raw_user_meta_data ->> 'role' INTO v_target_role
  FROM auth.users WHERE id = p_user_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;

  -- Only super_admin can disable/enable
  IF auth_role() != 'super_admin' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_target_role = 'super_admin' THEN
    RAISE EXCEPTION 'Cannot disable a super admin';
  END IF;

  IF p_disable THEN
    UPDATE auth.users SET banned_until = '2099-12-31'::TIMESTAMPTZ, updated_at = now()
    WHERE id = p_user_id;
  ELSE
    UPDATE auth.users SET banned_until = NULL, updated_at = now()
    WHERE id = p_user_id;
  END IF;
END;
$$;

-- 4. FORCE LOGOUT (invalidate sessions)
-- ============================================================================
CREATE OR REPLACE FUNCTION admin_force_logout(
  p_user_id UUID DEFAULT NULL,
  p_restaurant_id UUID DEFAULT NULL
) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_count INT := 0;
BEGIN
  IF auth_role() != 'super_admin' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_user_id IS NOT NULL THEN
    -- Logout specific user
    DELETE FROM auth.sessions WHERE user_id = p_user_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  ELSIF p_restaurant_id IS NOT NULL THEN
    -- Logout all users of a restaurant
    DELETE FROM auth.sessions
    WHERE user_id IN (
      SELECT id FROM auth.users
      WHERE (raw_user_meta_data ->> 'restaurant_id')::UUID = p_restaurant_id
    );
    GET DIAGNOSTICS v_count = ROW_COUNT;
  ELSE
    RAISE EXCEPTION 'Provide user_id or restaurant_id';
  END IF;

  RETURN v_count;
END;
$$;

-- 5. DELETE USER
-- ============================================================================
CREATE OR REPLACE FUNCTION admin_delete_user(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_target_role TEXT;
BEGIN
  IF auth_role() != 'super_admin' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT raw_user_meta_data ->> 'role' INTO v_target_role
  FROM auth.users WHERE id = p_user_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
  IF v_target_role = 'super_admin' THEN
    RAISE EXCEPTION 'Cannot delete a super admin';
  END IF;

  -- Delete sessions first
  DELETE FROM auth.sessions WHERE user_id = p_user_id;
  DELETE FROM auth.identities WHERE user_id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;
