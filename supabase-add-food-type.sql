-- =====================================================================
-- Add food_type column to menu table
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- =====================================================================
-- Adds a 'food_type' column for veg/non-veg tagging.
-- Backward compatible: defaults to empty string (unset).

ALTER TABLE menu ADD COLUMN IF NOT EXISTS food_type TEXT DEFAULT '';

-- Optional: Add a CHECK constraint for valid values
-- ALTER TABLE menu ADD CONSTRAINT chk_food_type CHECK (food_type IN ('', 'veg', 'non-veg'));
