-- ============================================================================
-- ENABLE REALTIME on restaurants table
-- Run this in Supabase SQL Editor
-- Required for the real-time restaurant disable feature to work
-- ============================================================================

-- Add restaurants table to the Supabase Realtime publication
-- This allows the frontend to listen for is_active changes instantly
ALTER PUBLICATION supabase_realtime ADD TABLE restaurants;
