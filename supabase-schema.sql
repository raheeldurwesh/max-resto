-- =====================================================================
-- TableServe — Supabase Schema  (v2 — with customer_name + instructions)
-- Run this entire file in: Supabase Dashboard → SQL Editor → New query
-- =====================================================================

-- 1. Menu items
create table if not exists menu (
  id          uuid          primary key default gen_random_uuid(),
  name        text          not null,
  description text          default '',
  price       numeric(10,2) not null,
  category    text          default 'Other',
  available   boolean       default true,
  image_url   text          default '',
  created_at  timestamptz   default now()
);

-- 2. Orders  (v2: added customer_name, instructions)
create table if not exists orders (
  id              uuid          primary key default gen_random_uuid(),
  order_id        text          not null,
  table_no        text          not null,
  customer_name   text          default '',
  items           jsonb         not null default '[]',
  total           numeric(10,2) not null,
  tax             numeric(10,2) not null default 0,
  note            text          default '',
  instructions    text          default '',
  status          text          not null default 'pending'
                  check (status in ('pending','preparing','done')),
  created_at      timestamptz   default now()
);

-- ⚠️  If the orders table already exists, run these migrations instead:
-- alter table orders add column if not exists customer_name text default '';
-- alter table orders add column if not exists instructions  text default '';

-- 3. Global config (single row, id must always be 1)
create table if not exists config (
  id              int          primary key default 1,
  restaurant_name text         default 'TableServe',
  tagline         text         default 'Restaurant Management System',
  address         text         default '',
  phone           text         default '',
  gst_number      text         default '',
  tax_percentage  numeric(5,2) default 8,
  currency        text         default '₹',
  constraint single_row check (id = 1)
);

-- Seed default config row
insert into config (id) values (1) on conflict (id) do nothing;

-- ── Row Level Security ────────────────────────────────────────────────
alter table menu   enable row level security;
alter table orders enable row level security;
alter table config enable row level security;

create policy "menu_public_read"     on menu   for select using (true);
create policy "menu_auth_write"      on menu   for all    using (auth.role() = 'authenticated');

create policy "orders_public_insert" on orders for insert with check (true);
create policy "orders_public_select" on orders for select using (true);
create policy "orders_auth_update"   on orders for update using (auth.role() = 'authenticated');
create policy "orders_auth_delete"   on orders for delete using (auth.role() = 'authenticated');

create policy "config_public_read"   on config for select using (true);
create policy "config_auth_write"    on config for all    using (auth.role() = 'authenticated');

-- ── Realtime ──────────────────────────────────────────────────────────
-- Enable in: Supabase Dashboard → Database → Replication → Source tables
-- Toggle ON for: menu, orders, config

-- ── Storage bucket ────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true)
on conflict (id) do nothing;

create policy "menu_images_public_read"
  on storage.objects for select using (bucket_id = 'menu-images');

create policy "menu_images_auth_write"
  on storage.objects for all
  using (bucket_id = 'menu-images' and auth.role() = 'authenticated');
