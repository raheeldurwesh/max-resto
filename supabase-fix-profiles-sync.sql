-- ============================================================================
-- FIX: Sync profiles table with auth.users
-- Run this ONCE in Supabase SQL Editor to fix any waiters missing from profiles
-- ============================================================================

-- Backfill any auth.users that are missing from profiles table
INSERT INTO public.profiles (id, email, role, restaurant_id)
SELECT 
    id, 
    email, 
    COALESCE(raw_user_meta_data->>'role', 'customer'), 
    NULLIF(raw_user_meta_data->>'restaurant_id', '')::uuid
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- Fix any profiles that have NULL restaurant_id but the auth.users has it in metadata
UPDATE public.profiles p
SET restaurant_id = (u.raw_user_meta_data->>'restaurant_id')::uuid
FROM auth.users u
WHERE p.id = u.id
  AND p.restaurant_id IS NULL
  AND u.raw_user_meta_data->>'restaurant_id' IS NOT NULL
  AND u.raw_user_meta_data->>'restaurant_id' != '';

-- Fix any profiles that have wrong role
UPDATE public.profiles p
SET role = u.raw_user_meta_data->>'role'
FROM auth.users u
WHERE p.id = u.id
  AND p.role != COALESCE(u.raw_user_meta_data->>'role', p.role)
  AND u.raw_user_meta_data->>'role' IS NOT NULL;

-- Verify: show all users and their profile status
SELECT 
    u.id,
    u.email,
    u.raw_user_meta_data->>'role' as auth_role,
    u.raw_user_meta_data->>'restaurant_id' as auth_restaurant_id,
    p.role as profile_role,
    p.restaurant_id as profile_restaurant_id,
    CASE WHEN p.id IS NULL THEN '❌ MISSING PROFILE' ELSE '✅ OK' END as status
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
ORDER BY u.email;
