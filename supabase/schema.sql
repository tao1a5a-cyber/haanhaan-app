-- ============================================================
-- HaanHaan – Supabase schema (complete, multi-group)
-- Run this in the Supabase SQL Editor on a FRESH project.
-- Dashboard → SQL Editor → paste & run.
--
-- Already have the old 2-person (tao/ice) schema with data?
-- Run supabase/migrations/0001_groups.sql instead — it upgrades
-- in place and preserves your members + transactions.
-- ============================================================

-- ── Extensions ───────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ── Groups ───────────────────────────────────────────────
-- A group is one shared ledger (e.g. "บ้านเรา", "ทริปเชียงใหม่").
create table if not exists public.groups (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  created_at timestamptz not null default now()
);

-- ── Members ──────────────────────────────────────────────
-- A person inside a group. Replaces the old fixed 'profiles' table.
create table if not exists public.members (
  id         uuid        primary key default gen_random_uuid(),
  group_id   uuid        not null references public.groups (id) on delete cascade,
  name       text        not null,
  avatar_url text,                               -- Supabase Storage public URL
  tint       text,                               -- pastel background color (oklch string)
  theme_id   text,                               -- ThemePreset.id
  pin_hash   text,                               -- SHA-256(salt:pin) hex string (optional)
  pin_salt   text,                               -- salt used for pin_hash (defaults to id)
  created_at timestamptz not null default now()
);

create index if not exists members_group_idx
  on public.members (group_id, created_at);

-- ── Transactions ─────────────────────────────────────────
create table if not exists public.transactions (
  id          uuid        primary key default gen_random_uuid(),
  group_id    uuid        references public.groups (id) on delete cascade,
  payer_id    uuid        not null,              -- members.id of who paid
  detail      text        not null,
  amount      numeric     not null check (amount > 0),
  shares      jsonb       not null default '{}', -- { memberId: portionOwed }, sum = amount
  category_id text        not null,
  split       text        not null,             -- 'split' | 'custom' | 'request'
  slip_path   text,                             -- path inside 'slips' bucket (private)
  settled     boolean     not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists transactions_group_idx
  on public.transactions (group_id, created_at desc);

-- ── Custom categories (global, shared across groups) ─────
create table if not exists public.custom_categories (
  id         text        primary key,
  label      text        not null,
  emoji      text        not null default '📦',
  sort_order integer     not null,
  created_at timestamptz not null default now()
);

-- ── Notifications ────────────────────────────────────────
-- One row per recipient member who should be alerted about an event.
create table if not exists public.notifications (
  id           uuid        primary key default gen_random_uuid(),
  group_id     uuid        references public.groups (id) on delete cascade,
  recipient_id uuid        not null,             -- members.id who should see it
  from_name    text        not null,             -- display name of who triggered it
  message      text        not null,
  tx_id        uuid,                              -- related transaction (nullable)
  type         text        not null,             -- 'add' | 'edit' | 'delete'
  read         boolean     not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists notifications_recipient_idx
  on public.notifications (recipient_id, created_at desc);

-- ── Row Level Security ───────────────────────────────────
-- Household-scoped: anon key grants full access (single private deployment).
-- For true multi-tenant, replace with JWT-based policies.
alter table public.groups            enable row level security;
alter table public.members           enable row level security;
alter table public.transactions      enable row level security;
alter table public.custom_categories enable row level security;
alter table public.notifications     enable row level security;

create policy "household_groups" on public.groups
  for all using (true) with check (true);

create policy "household_members" on public.members
  for all using (true) with check (true);

create policy "household_transactions" on public.transactions
  for all using (true) with check (true);

create policy "household_categories" on public.custom_categories
  for all using (true) with check (true);

create policy "household_notifications" on public.notifications
  for all using (true) with check (true);

-- ── Realtime ─────────────────────────────────────────────
-- Live push of new notifications to each member's open app.
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;  -- already added
end $$;

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
