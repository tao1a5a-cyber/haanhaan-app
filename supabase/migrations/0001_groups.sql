-- ============================================================
-- HaanHaan migration 0001 — 2-person → multi-group
-- Upgrades an EXISTING old database (profiles + tao/ice
-- transactions) to the groups/members model, preserving data.
--
-- Fully defensive + IDEMPOTENT: safe to run multiple times and
-- safe to resume from a half-applied state. It detects what's
-- already there (e.g. a `notifications` table that may or may
-- not exist, a `payer_id` that may already be renamed) instead
-- of assuming a fixed starting shape.
-- ============================================================

create extension if not exists "pgcrypto";

-- ── 1. New tables ────────────────────────────────────────
create table if not exists public.groups (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  id         uuid        primary key default gen_random_uuid(),
  group_id   uuid        not null references public.groups (id) on delete cascade,
  name       text        not null,
  avatar_url text,
  tint       text,
  theme_id   text,
  pin_hash   text,
  pin_salt   text,
  legacy_id  text,                               -- old profiles.user_id ('tao'|'ice')
  created_at timestamptz not null default now()
);
create index if not exists members_group_idx on public.members (group_id, created_at);

-- ── 2. Extend transactions ───────────────────────────────
alter table public.transactions add column if not exists group_id uuid references public.groups (id) on delete cascade;
alter table public.transactions add column if not exists shares   jsonb not null default '{}';

-- payer_id was text ('tao'/'ice'). Rename to payer_legacy then add a uuid
-- payer_id — but only if that hasn't happened already.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'transactions'
      and column_name = 'payer_id' and data_type <> 'uuid'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'transactions' and column_name = 'payer_legacy'
  ) then
    alter table public.transactions rename column payer_id to payer_legacy;
  end if;
end $$;
alter table public.transactions add column if not exists payer_id uuid;

-- the app no longer writes `owed`; relax its NOT NULL if the column still exists
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'transactions' and column_name = 'owed'
  ) then
    alter table public.transactions alter column owed drop not null;
  end if;
end $$;

-- ── 3. Notifications: create fresh if missing, else migrate ─
do $$
begin
  if to_regclass('public.notifications') is null then
    -- never existed on this DB → create directly in the new (uuid) shape
    create table public.notifications (
      id           uuid        primary key default gen_random_uuid(),
      group_id     uuid        references public.groups (id) on delete cascade,
      recipient_id uuid        not null,
      from_name    text        not null,
      message      text        not null,
      tx_id        uuid,
      type         text        not null,
      read         boolean     not null default false,
      created_at   timestamptz not null default now()
    );
  else
    -- existed in the old (text recipient_id) shape → migrate it
    alter table public.notifications add column if not exists group_id uuid references public.groups (id) on delete cascade;
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'notifications'
        and column_name = 'recipient_id' and data_type <> 'uuid'
    ) and not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'notifications' and column_name = 'recipient_legacy'
    ) then
      alter table public.notifications rename column recipient_id to recipient_legacy;
      alter table public.notifications add column recipient_id uuid;
    end if;
  end if;
end $$;

create index if not exists notifications_recipient_idx on public.notifications (recipient_id, created_at desc);

-- ── 4. Seed the default group + its two members ──────────
insert into public.groups (name)
select 'บ้านเรา'
where not exists (select 1 from public.groups);

-- Seed Tao + Ice with their code defaults (only if missing), into the first group.
insert into public.members (group_id, name, avatar_url, tint, theme_id, legacy_id, pin_salt)
select g.id, v.name, v.avatar_url, v.tint, v.theme_id, v.legacy_id, v.legacy_id
from (select id from public.groups order by created_at limit 1) g
cross join (values
  ('เตา',  '/avatars/bear.png', 'oklch(0.93 0.05 70)',  'amber', 'tao'),
  ('ไอซ์', '/avatars/ice.png',  'oklch(0.93 0.05 195)', 'teal',  'ice')
) as v(name, avatar_url, tint, theme_id, legacy_id)
where not exists (select 1 from public.members m where m.legacy_id = v.legacy_id);

-- Overlay any saved profile overrides (name, avatar, tint, theme, pin), if profiles exists.
do $$
begin
  if to_regclass('public.profiles') is not null then
    update public.members m set
      name       = coalesce(p.name, m.name),
      tint       = coalesce(p.tint, m.tint),
      theme_id   = coalesce(p.theme_id, m.theme_id),
      avatar_url = coalesce(p.avatar_url, m.avatar_url),
      pin_hash   = coalesce(p.pin_hash, m.pin_hash)
    from public.profiles p
    where p.user_id = m.legacy_id;
  end if;
end $$;

-- ── 5. Backfill transactions (group, payer, shares) ──────
-- Only runs while payer_legacy still exists (i.e. not yet finalized).
-- shares = { payer: amount - owed, partner: owed } for the 2-member group.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'transactions' and column_name = 'payer_legacy'
  ) then
    update public.transactions t set
      group_id = (select id from public.groups order by created_at limit 1),
      payer_id = pm.id,
      shares   = jsonb_build_object(
                   pm.id::text, greatest(t.amount - coalesce(t.owed, 0), 0),
                   om.id::text, coalesce(t.owed, 0)
                 )
    from public.members pm, public.members om
    where pm.legacy_id = t.payer_legacy
      and om.legacy_id <> t.payer_legacy
      and pm.group_id = om.group_id;
  end if;
end $$;

-- ── 6. Backfill notifications (only if it has a legacy column) ─
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'notifications' and column_name = 'recipient_legacy'
  ) then
    update public.notifications n set
      group_id     = (select id from public.groups order by created_at limit 1),
      recipient_id = m.id
    from public.members m
    where m.legacy_id = n.recipient_legacy;
  end if;
end $$;

-- ── 7. Tighten constraints + drop legacy columns ─────────
-- Set NOT NULL only once every row is backfilled (avoids errors on partial data).
do $$
begin
  if not exists (select 1 from public.transactions where payer_id is null) then
    alter table public.transactions alter column payer_id set not null;
  end if;
  if not exists (select 1 from public.notifications where recipient_id is null) then
    alter table public.notifications alter column recipient_id set not null;
  end if;
end $$;

alter table public.transactions  drop column if exists payer_legacy;
alter table public.notifications drop column if exists recipient_legacy;

create index if not exists transactions_group_idx on public.transactions (group_id, created_at desc);

-- profiles is superseded by members; keep it for safety/audit. Drop manually if desired:
--   drop table public.profiles;

-- ── 8. RLS + realtime ────────────────────────────────────
alter table public.groups        enable row level security;
alter table public.members       enable row level security;
alter table public.notifications enable row level security;

do $$ begin
  create policy "household_groups" on public.groups for all using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "household_members" on public.members for all using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "household_notifications" on public.notifications for all using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null; end $$;
