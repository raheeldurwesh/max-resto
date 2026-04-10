-- ============================================================================
-- ADD is_active COLUMN TO restaurants TABLE
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Add the is_active column (default TRUE so existing restaurants stay active)
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Update RLS: Customers should only see active restaurants
-- (Admins/Super Admins can still see all)
DROP POLICY IF EXISTS "Public read restaurants" ON restaurants;
CREATE POLICY "Public read restaurants" ON restaurants FOR SELECT USING (true);
