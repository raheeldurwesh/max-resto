-- =====================================================================
-- TableServe — Enable Real-Time for Orders
-- =====================================================================
-- Run this in your Supabase Dashboard -> SQL Editor -> New query
-- 
-- If your waiter dashboard isn't updating in real-time, it usually means 
-- the 'orders' table hasn't been added to the replication publication. 
-- This script does it automatically.

BEGIN;
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'orders'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE orders;
    END IF;
  END $$;
COMMIT;
