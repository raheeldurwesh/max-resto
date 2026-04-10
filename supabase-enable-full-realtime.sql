-- =====================================================================
-- TableServe — Enable 100% Real-Time Replication (FIXED)
-- =====================================================================
-- Run this in your Supabase Dashboard -> SQL Editor
-- This allows every part of the app to reflect changes instantly.

DO $$
BEGIN
  -- 1. Enable for Orders
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'orders') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE orders;
  END IF;

  -- 2. Enable for Restaurants
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'restaurants') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE restaurants;
  END IF;

  -- 3. Enable for Profiles
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'profiles') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
  END IF;

  -- 4. Enable for Menu
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'menu') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE menu;
  END IF;

  -- 5. Enable for Config
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'config') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE config;
  END IF;
END $$;
