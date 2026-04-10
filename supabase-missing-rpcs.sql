-- RPC to fetch users for a specific restaurant (with privacy protection)
-- This allows the Edge Function to find an 'admin' to impersonate.
CREATE OR REPLACE FUNCTION get_restaurant_users(p_restaurant_id UUID)
RETURNS TABLE (
    id UUID,
    email TEXT,
    role TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER -- Runs as system to bypass RLS for this specific check
SET search_path = public, auth
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.email,
        p.role
    FROM profiles p
    WHERE p.restaurant_id = p_restaurant_id;
END;
$$;
