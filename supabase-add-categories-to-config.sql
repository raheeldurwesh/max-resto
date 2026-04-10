-- =====================================================================
-- TableServe — Add Custom Categories to Config
-- =====================================================================
-- Run this in your Supabase Dashboard -> SQL Editor

-- 1. Add categories column
ALTER TABLE config 
ADD COLUMN IF NOT EXISTS categories TEXT 
DEFAULT 'Pizza, Burger, Pasta, Drinks, Desserts, Other';

-- 2. Populate existing rows with the default list if they are null
UPDATE config 
SET categories = 'Pizza, Burger, Pasta, Drinks, Desserts, Other' 
WHERE categories IS NULL;
