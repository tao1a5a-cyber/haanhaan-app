-- ============================================================
-- HaanHaan – Supabase schema (complete)
-- Run this in the Supabase SQL Editor after creating a project
-- Dashboard → SQL Editor → paste & run
-- ============================================================

-- ── Extensions ───────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ── Profiles ─────────────────────────────────────────────
create table if not exists public.profiles (
  user_id    text        primary key,        -- 'tao' | 'ice'
  name       text,                           -- display name (overrides default)
  tint       text,                           -- pastel background color (oklch string)
  theme_id   text,                           -- ThemePreset.id
  avatar_url text,                           -- Supabase Storage public URL
  pin_hash   text,                           -- SHA-256(userId:pin) hex string
  updated_at timestamptz not null default now()
);

-- ── Transactions ─────────────────────────────────────────
create table if not exists public.transactions (
  id          uuid        primary key default gen_random_uuid(),
  payer_id    text        not null,           -- 'tao' | 'ice'
  detail      text        not null,
  amount      numeric     not null check (amount > 0),
  owed        numeric     not null,           -- positive = partner owes payer
  category_id text        not null,
  split       text        not null,           -- 'split' | 'custom' | 'request'
  slip_path   text,                           -- path inside 'slips' bucket (private)
  settled     boolean     not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists transactions_created_idx
  on public.transactions (created_at desc);

-- ── Custom categories ────────────────────────────────────
create table if not exists public.custom_categories (
  id         text        primary key,
  label      text        not null,
  emoji      text        not null default '📦',
  sort_order integer     not null,
  created_at timestamptz not null default now()
);

-- ── Row Level Security ───────────────────────────────────
alter table public.profiles          enable row level security;
alter table public.transactions      enable row level security;
alter table public.custom_categories enable row level security;

-- Household-scoped: anon key grants full access (single private deployment).
-- For multi-user/multi-household, replace with JWT-based policies.
create policy "household_profiles" on public.profiles
  for all using (true) with check (true);

create policy "household_transactions" on public.transactions
  for all using (true) with check (true);

create policy "household_categories" on public.custom_categories
  for all using (true) with check (true);

-- ── Storage buckets ──────────────────────────────────────
-- Run these AFTER the schema above.

-- 1. Avatar bucket (public read — URLs can be embedded in the app)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars', 'avatars', true,
  2097152,                                    -- 2 MB max
  array['image/png','image/jpeg','image/webp']
)
on conflict (id) do nothing;

-- 2. Slip bucket (private — accessed via signed URL)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'slips', 'slips', false,
  10485760,                                   -- 10 MB max
  array['image/png','image/jpeg','image/webp','application/pdf']
)
on conflict (id) do nothing;

-- Storage policies for avatars (public bucket)
create policy "public_read_avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "anon_write_avatars"
  on storage.objects for insert
  with check (bucket_id = 'avatars');

create policy "anon_update_avatars"
  on storage.objects for update
  using (bucket_id = 'avatars');

create policy "anon_delete_avatars"
  on storage.objects for delete
  using (bucket_id = 'avatars');

-- Storage policies for slips (private bucket)
create policy "anon_read_slips"
  on storage.objects for select
  using (bucket_id = 'slips');

create policy "anon_write_slips"
  on storage.objects for insert
  with check (bucket_id = 'slips');

create policy "anon_update_slips"
  on storage.objects for update
  using (bucket_id = 'slips');

create policy "anon_delete_slips"
  on storage.objects for delete
  using (bucket_id = 'slips');
