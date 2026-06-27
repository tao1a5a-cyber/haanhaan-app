-- ============================================================
-- HaanHaan migration 0002 — Social Auth + Invite Links
-- Adds Supabase-Auth identity to members and a shareable invite
-- token to each group. Safe + idempotent: re-runnable any time.
--
-- After running, enable the Google provider in:
--   Supabase Dashboard → Authentication → Providers → Google
-- and add your site URL + /join/* to the allowed Redirect URLs.
-- ============================================================

create extension if not exists "pgcrypto";

-- ── 1. Link members to an auth user ──────────────────────
-- A member may exist without a user_id (a name-only placeholder),
-- but a logged-in person maps to exactly one member per group.
alter table public.members
  add column if not exists user_id uuid references auth.users (id) on delete set null;

-- One auth user → at most one member per group.
create unique index if not exists members_group_user_idx
  on public.members (group_id, user_id)
  where user_id is not null;

-- ── 2. Group ownership + invite token ────────────────────
alter table public.groups
  add column if not exists host_user_id uuid references auth.users (id) on delete set null;

alter table public.groups
  add column if not exists invite_token text;

-- Backfill any existing groups with a fresh URL-safe token.
update public.groups
  set invite_token = encode(gen_random_bytes(8), 'hex')
  where invite_token is null;

-- New groups get a token automatically.
alter table public.groups
  alter column invite_token set default encode(gen_random_bytes(8), 'hex');

alter table public.groups
  alter column invite_token set not null;

create unique index if not exists groups_invite_token_idx
  on public.groups (invite_token);

-- ── 3. RLS stays permissive (single shared deployment) ───
-- The existing "for all using(true)" policies already cover the
-- authenticated role, so logged-in users keep full access. For a
-- true multi-tenant lock-down, replace these with auth.uid()-based
-- policies (e.g. only members of a group may read its rows).
