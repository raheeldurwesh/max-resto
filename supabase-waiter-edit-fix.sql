-- =====================================================================
-- Fix Waiter Edit Permission (RLS)
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- =====================================================================
-- The waiter page is accessed implicitly without logging in (public/anon).
-- This grants public UPDATE access to the orders table so waiters can change
-- status to 'preparing'/'done' and edit customer order items.

-- Drop the restrictive authenticated-only update policy
DROP POLICY IF EXISTS "orders_auth_update" ON orders;

-- Create a new public update policy
CREATE POLICY "orders_public_update" ON orders FOR UPDATE USING (true);
