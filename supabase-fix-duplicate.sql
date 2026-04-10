-- =====================================================================
-- FIX: Drop the duplicate function with p_session_id parameter
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- =====================================================================

-- Drop the conflicting overloaded function (the one with p_session_id)
DROP FUNCTION IF EXISTS public.place_order_secure(text, jsonb, text, text, text, text);

-- Verify: this should now work without ambiguity
-- SELECT place_order_secure('1', 'Test', '[]'::jsonb, '', '');
