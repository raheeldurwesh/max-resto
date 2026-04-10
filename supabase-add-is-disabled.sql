-- ============================================================================
-- ADD is_disabled COLUMN TO profiles TABLE
-- Run this in Supabase SQL Editor
-- This allows the client to detect when a user has been disabled
-- ============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN DEFAULT false;
